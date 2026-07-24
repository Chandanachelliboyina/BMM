import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Camera, MapPin, Clock, CheckCircle2, Loader2, RefreshCw, Building2, AlertTriangle } from "lucide-react";
import { useEmployee } from "@/hooks/useEmployee";
import { apiCheckin, apiCheckout, apiAttendanceToday, type AttendanceRecord } from "@/lib/api";
import { compareFaces, loadFaceModels } from "@/lib/face-recognition";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GoogleMapEmbed } from "@/components/GoogleMapEmbed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance Verification — Bheemabhai Mahila Mandali (BMM)" }] }),
  component: AttendancePage,
});

type Location = { lat: number; lng: number; address?: string };

function AttendancePage() {
  const navigate = useNavigate();
  const { employee, photoUrl, loading } = useEmployee();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [cameraOn, setCameraOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [alreadyMarked, setAlreadyMarked] = useState<{ time: string; selfie: string | null; checkoutTime?: string | null } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    loadFaceModels().catch(console.error);
    return () => clearInterval(t);
  }, []);

  // Check if today's attendance already exists
  useEffect(() => {
    if (!employee) return;
    apiAttendanceToday().then((data: AttendanceRecord | null) => {
      if (data) {
        setAlreadyMarked({ time: data.login_time, selfie: data.selfie_b64 ?? null, checkoutTime: data.logout_time });
      }
    });
  }, [employee]);

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
      toast.error("Camera access denied. Please allow camera to mark attendance.");
      console.error(err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const captureSelfie = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const padding = 15;
    const lineHeight = 20;
    const fontSize = 14;
    const empName = employee?.full_name || "Unknown Employee";
    const locText = location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "Location fetching...";
    const addressText = location?.address || "";
    const timeText = format(new Date(), "dd MMM yyyy, hh:mm a");

    ctx.font = `${fontSize}px sans-serif`;
    const lines = [empName, locText, addressText, timeText].filter(Boolean);
    const textWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const boxHeight = lines.length * lineHeight + padding;
    const boxX = (canvas.width - textWidth - 10) / 2;
    const boxY = padding;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(boxX - 5, boxY - 5, textWidth + 10, boxHeight + 5);
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

  const retakeSelfie = () => {
    setSelfieBlob(null);
    setSelfieUrl(null);
    startCamera();
  };

  const captureLocation = useCallback(() => {
    setLocError(null);
    if (!navigator.geolocation) { setLocError("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address: string | undefined;
        try {
          const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
          const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`);
          if (r.ok) { const j = await r.json(); address = j?.results?.[0]?.formatted_address; }
        } catch { /* ignore */ }
        setLocation({ lat, lng, address });
      },
      (err) => setLocError(err.message || "Unable to get location"),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => { captureLocation(); }, [captureLocation]);

  const isCheckedIn = !!alreadyMarked;
  const isCheckedOut = isCheckedIn && !!alreadyMarked.checkoutTime;
  const needsAction = !isCheckedIn || (isCheckedIn && !isCheckedOut);
  
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const timeInMinutes = currentHour * 60 + currentMinute;
  
  const isWithinCheckinWindow = timeInMinutes >= (9 * 60) && timeInMinutes <= (10 * 60) || !!employee?.allow_late_signin;
  const isAfterCheckoutTime = timeInMinutes >= (18 * 60);

  const canSubmit = (!isCheckedIn && isWithinCheckinWindow) || (isCheckedIn && !isCheckedOut && isAfterCheckoutTime);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error(isCheckedIn ? "Sign out is only allowed after 06:00 PM." : "Sign-in is only allowed between 09:00 AM and 10:00 AM.");
      return;
    }
    if (!selfieBlob) { toast.error("Please capture your selfie"); return; }
    if (!location) { toast.error("Waiting for location — allow location access"); return; }

    setVerifying(true);

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
      toast.error(result.error || `Face verification failed. Distance: ${result.distance.toFixed(2)}`);
      setVerifying(false);
      return;
    }
    toast.success(`Face matched! Welcome, ${employee!.full_name}`);

    setSubmitting(true);
    try {
      if (alreadyMarked && !alreadyMarked.checkoutTime) {
        // Handle Checkout
        await apiCheckout({
          gps_latitude: location.lat,
          gps_longitude: location.lng,
          full_address: location.address ?? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
          selfieBlob,
        });
        toast.success("Checkout marked successfully");
      } else {
        // Handle Checkin
        await apiCheckin({
          employee_name: employee!.full_name,
          role: employee!.role,
          gps_latitude: location.lat,
          gps_longitude: location.lng,
          full_address: location.address ?? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
          selfieBlob,
        });
        toast.success("Attendance marked successfully");
      }
      setTimeout(() => navigate({ to: "/dashboard" }), 700);
    } catch (err: any) {
      if (err?.message?.includes("409") || err?.message?.toLowerCase().includes("already")) {
        toast.error("Attendance already marked for today");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to mark attendance");
      }
    } finally {
      setSubmitting(false);
      setVerifying(false);
    }
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
        <h1 className="font-semibold">Attendance Verification</h1>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => navigate({ to: "/dashboard" })}>
          Skip to dashboard
        </Button>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
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
              <p className="text-xs text-muted-foreground">Current time</p>
              <p className="text-2xl font-bold tabular-nums">{format(now, "hh:mm:ss a")}</p>
              <p className="text-xs text-muted-foreground">{format(now, "EEEE, dd MMM yyyy")}</p>
            </div>
          </div>
        </Card>

        {isCheckedOut ? (
          <Card className="p-8 text-center shadow-card border-success/30 bg-success/5">
            <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
            <h2 className="text-2xl font-bold mt-4">Attendance fully marked today</h2>
            <p className="text-muted-foreground mt-1">
              Checked in at {format(new Date(alreadyMarked.time), "hh:mm a")} <br/>
              Checked out at {format(new Date(alreadyMarked.checkoutTime!), "hh:mm a")}
            </p>
            {alreadyMarked.selfie && (
              <img src={alreadyMarked.selfie} alt="Today's selfie" className="w-32 h-32 rounded-full mx-auto mt-6 object-cover border-2 border-success/30" />
            )}
            <Button className="mt-6 bg-gradient-primary" onClick={() => navigate({ to: "/dashboard" })}>
              Continue to Dashboard
            </Button>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">{isCheckedIn ? "Sign Out Verification" : "Selfie Face Verification"}</h3>
                </div>
              </div>
              
              {!isCheckedIn && !isWithinCheckinWindow && (
                <div className="mb-4 bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Sign-in is only allowed between 09:00 AM and 10:00 AM.
                </div>
              )}
              
              {isCheckedIn && !isCheckedOut && (
                <div className={`mb-4 ${isAfterCheckoutTime ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning-foreground"} text-sm p-3 rounded-md flex items-center gap-2`}>
                  {isAfterCheckoutTime ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      You are checked in. Please capture your selfie and location again to sign out.
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 shrink-0" />
                      You are checked in. Sign out is only allowed after 06:00 PM.
                    </>
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-4">
                Please ensure your face is clearly visible to verify your identity.
              </p>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Signing in as</p>
                  <p className="font-semibold text-primary">{employee.full_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium text-sm max-w-[200px] truncate">{location?.address || "Fetching..."}</p>
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
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 text-center">Live selfie</p>
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
                  <Button onClick={captureSelfie} className="flex-1 bg-gradient-primary">
                    <Camera className="w-4 h-4 mr-2" /> Capture selfie
                  </Button>
                )}
                {selfieUrl && (
                  <Button variant="outline" onClick={retakeSelfie} className="flex-1">
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
              <div className="mt-4 space-y-2 text-sm">
                {location && (
                  <>
                    <p className="text-muted-foreground">
                      <span className="font-mono">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
                    </p>
                    {location.address && <p className="text-foreground">{location.address}</p>}
                  </>
                )}
                <Button variant="outline" size="sm" onClick={captureLocation}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh location
                </Button>
              </div>
              <div className="mt-5 pt-5 border-t flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {isCheckedIn ? "Checkout" : "Login"} will be recorded at {format(now, "hh:mm:ss a")} on {format(now, "dd MMM yyyy")}
              </div>
            </Card>
          </div>
        )}

        {needsAction && (
          <div className="flex justify-end">
            <Button 
              onClick={handleSubmit} 
              disabled={submitting || verifying}
              className="w-full h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              {submitting || verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {verifying ? "Verifying Face..." : submitting ? "Submitting..." : (isCheckedIn ? "Mark Checkout" : "Mark Attendance")}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
