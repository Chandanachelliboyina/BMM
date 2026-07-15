import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Camera, CheckCircle2, Loader2, RefreshCw, LogOut, Building2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmployee } from "@/hooks/useEmployee";
import { uploadSelfie } from "@/lib/storage";
import { compareFaces, loadFaceModels } from "@/lib/face-recognition";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GoogleMapEmbed } from "@/components/GoogleMapEmbed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type Location = { lat: number; lng: number; address?: string };

export const Route = createFileRoute("/_authenticated/logout")({
  head: () => ({ meta: [{ title: "Logout Attendance — Bheemabhai Mahila Mandali (BMM)" }] }),
  component: LogoutAttendancePage,
});

function LogoutAttendancePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { employee, photoUrl, loading } = useEmployee();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [now, setNow] = useState(new Date());
  
  const isAfter6PM = now.getHours() >= 18;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    loadFaceModels().catch(console.error); // Preload models
    return () => clearInterval(t);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      toast.error("Camera access denied. Please allow camera to log out.");
      console.error(err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const captureLocation = useCallback(() => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address: string | undefined;
        try {
          const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
          const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`);
          if (r.ok) {
            const j = await r.json();
            address = j?.results?.[0]?.formatted_address;
          }
        } catch { /* ignore */ }
        setLocation({ lat, lng, address });
      },
      (err) => setLocError(err.message || "Unable to get location"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  useEffect(() => { captureLocation(); }, [captureLocation]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Draw mirrored video
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Draw GPS/Name Watermark
    const padding = 15;
    const lineHeight = 20;
    const fontSize = 14;
    
    const empName = employee?.full_name || "Unknown Employee";
    const locText = location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "Location fetching...";
    const addressText = location?.address || "";
    const timeText = format(new Date(), "dd MMM yyyy, hh:mm a");

    ctx.font = `${fontSize}px sans-serif`;
    const lines = [empName, locText, addressText, timeText].filter(Boolean);
    const textWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
    const boxHeight = lines.length * lineHeight + padding;
    
    // Draw semi-transparent background box at top center
    const boxX = (canvas.width - textWidth - 10) / 2;
    const boxY = padding;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(boxX - 5, boxY - 5, textWidth + 10, boxHeight + 5);

    // Draw text
    ctx.fillStyle = "#ffffff";
    lines.forEach((line, index) => {
      ctx.fillText(line, boxX, boxY + (index + 1) * lineHeight - 5);
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      setSelfieBlob(blob);
      setSelfieUrl(URL.createObjectURL(blob));
      stopCamera();
    }, "image/jpeg", 0.85);
  };

  const retake = () => {
    setSelfieBlob(null);
    setSelfieUrl(null);
    startCamera();
  };

  const submitLogout = async () => {
    if (!employee || !selfieBlob) {
      toast.error("Please capture your logout selfie");
      return;
    }
    if (!location) {
      toast.error("Waiting for location — allow location access");
      return;
    }
    
    setVerifying(true);
    
    // 1. Face Verification
    if (!photoUrl) {
      toast.error("You don't have a profile photo. Please upload one in your profile first.");
      setVerifying(false);
      return;
    }
    
    const capturedImg = new Image();
    capturedImg.src = selfieUrl!;
    await new Promise((res) => { capturedImg.onload = res; });
    
    const result = await compareFaces(capturedImg, photoUrl);
    
    if (!result.match) {
      toast.error(result.error || `Face verification failed. Please try again. Distance: ${result.distance.toFixed(2)}`);
      setVerifying(false);
      return;
    }
    
    toast.success(`Face matched! Processing logout...`);

    setSubmitting(true);
    try {
      const path = await uploadSelfie(employee.user_id, selfieBlob);
      const today = format(new Date(), "yyyy-MM-dd");
      // Update today's attendance row with logout time + selfie + location
      const { error } = await supabase
        .from("attendance")
        .update({ 
          logout_time: new Date().toISOString(), 
          logout_selfie: path,
          logout_gps_latitude: location.lat,
          logout_gps_longitude: location.lng,
          logout_full_address: location.address ?? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
        } as never)
        .eq("user_id", employee.user_id)
        .eq("login_date", today);
      if (error) console.warn("Logout attendance update failed:", error.message);

      toast.success("Logout attendance recorded");

      // Full sign-out hygiene
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth/login", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log out");
    } finally {
      setSubmitting(false);
      setVerifying(false);
    }
  };

  const skip = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/login", replace: true });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!employee) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">No employee profile found.</div>;
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="h-14 border-b bg-background/80 backdrop-blur flex items-center gap-3 px-4 sticky top-0 z-30">
        <div className="w-8 h-8 rounded-md bg-gradient-primary flex items-center justify-center">
          <Building2 className="w-4 h-4 text-primary-foreground" />
        </div>
        <h1 className="font-semibold">Logout Attendance</h1>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => navigate({ to: "/dashboard" })}>
          Cancel
        </Button>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <Card className="p-6 shadow-card">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-primary/20">
              {photoUrl && <AvatarImage src={photoUrl} alt={employee.full_name} />}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {employee.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-lg font-semibold">{employee.full_name}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="secondary" className="font-mono">{employee.employee_id}</Badge>
                <Badge variant="outline">{employee.role}</Badge>
              </div>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Logout time</p>
              <p className="text-2xl font-bold tabular-nums">{format(now, "hh:mm:ss a")}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Logout Selfie</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Take a selfie to record your logout time. It will be compared with your profile photo.
          </p>
          
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Signing out as</p>
              <p className="font-semibold text-primary">{employee.full_name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium text-sm max-w-[200px] truncate" title={location?.address || "Fetching..."}>
                {location?.address || "Fetching..."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 text-center">Profile photo</p>
              <div className="aspect-square rounded-lg overflow-hidden bg-muted border-2 border-primary/20">
                {photoUrl ? (
                  <img src={photoUrl} alt={employee.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No photo</div>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 text-center">Logout selfie</p>
              <div className="aspect-square rounded-lg overflow-hidden bg-black/90 relative">
                {selfieUrl ? (
                  <img src={selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                ) : (
                  <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
                )}
                {!cameraOn && !selfieUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Button size="sm" onClick={startCamera} className="bg-white text-black hover:bg-white/90">
                      <Camera className="w-3.5 h-3.5 mr-1.5" /> Start
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {!selfieUrl && cameraOn && (
              <Button onClick={capture} className="flex-1 bg-gradient-primary">
                <Camera className="w-4 h-4 mr-2" /> Capture selfie
              </Button>
            )}
            {selfieUrl && (
              <Button variant="outline" onClick={retake} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" /> Retake
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Live Location</h3>
          </div>
          {location ? (
            <GoogleMapEmbed latitude={location.lat} longitude={location.lng} />
          ) : (
            <div className="h-[240px] rounded-lg border bg-muted flex items-center justify-center text-sm text-muted-foreground">
              {locError ?? "Fetching your location…"}
            </div>
          )}
          <div className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={captureLocation}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh location
            </Button>
          </div>
        </Card>

        {!isAfter6PM && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md text-sm font-medium flex items-center justify-center text-center">
            Sign out is only allowed after 6:00 PM. Please wait until your shift is over to log out.
          </div>
        )}
        <div className="flex justify-between gap-3">
          <Button variant="ghost" onClick={skip} disabled={submitting || verifying || !isAfter6PM}>
            Skip & sign out
          </Button>
          <Button
            onClick={submitLogout}
            disabled={submitting || verifying || !selfieBlob || !location || !isAfter6PM}
            className="h-12 px-8 bg-gradient-primary shadow-elegant"
          >
            {submitting || verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />} 
            {verifying ? "Verifying Face..." : submitting ? "Logging out..." : "Confirm Logout"}
            {!submitting && !verifying && <CheckCircle2 className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </main>
    </div>
  );
}
