import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, Send, X, ClipboardList, ImageIcon, SwitchCamera, MapPin } from "lucide-react";
import { getToken, BASE_URL } from "@/lib/api";
import { useEmployee } from "@/hooks/useEmployee";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/updates")({
  head: () => ({ meta: [{ title: "Daily Updates — Bheemabhai Mahila Mandali" }] }),
  component: UpdatesPage,
});

type UpdateRecord = {
  id: string;
  notes: string | null;
  images: string[];
  created_at: string;
  signedUrls?: string[];
};

const MAX_IMAGES = 6;

function UpdatesPage() {
  const { employee, loading } = useEmployee();
  const fileRef = useRef<HTMLInputElement>(null);
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const [history, setHistory] = useState<UpdateRecord[]>([]);
  const [fetchingHistory, setFetchingHistory] = useState(true);

  // Camera & GPS State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">(
    typeof window !== "undefined" && window.innerWidth < 768 ? "environment" : "user"
  );
  const [location, setLocation] = useState<{lat: number; lng: number, address?: string} | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Lightbox state
  const [viewImage, setViewImage] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!employee) return;
    setFetchingHistory(true);
    try {
      const BASE = BASE_URL;
      const token = getToken();
      const res = await fetch(`${BASE}/api/daily-updates`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        // images are now base64 data URLs — use directly
        const populated = data.map((r: any) => ({ ...r, signedUrls: r.images || [] }));
        setHistory(populated);
      }
    } catch { /* ignore */ }
    setFetchingHistory(false);
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

  const getLocation = async () => {
    setGettingLocation(true);
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setGettingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        let address = "";
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`);
          const data = await res.json();
          const addr = data.address || {};
          const conciseName = addr.village || addr.suburb || addr.neighbourhood || addr.town || addr.city || addr.county || data.name;
          address = conciseName ? conciseName : (data.display_name || "");
        } catch(e) { }
        
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: address
        });
        setGettingLocation(false);
      },
      (error) => {
        console.error("Error getting location", error);
        toast.error("Failed to get location. Please ensure location services are enabled.");
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const startCamera = async (mode = facingMode) => {
    setIsCameraOpen(true);
    setCameraError("");
    if (!location) getLocation();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setCameraError("Could not access camera. Please check permissions.");
      toast.error("Camera access denied.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraOpen(false);
  };

  const toggleCamera = () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    stopCamera();
    setTimeout(() => startCamera(newMode), 300);
  };

  const capturePhoto = () => {
    if (selectedFiles.length >= MAX_IMAGES) {
      toast.error(`You can only upload up to ${MAX_IMAGES} images.`);
      return;
    }

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Add Watermark
      const now = new Date();
      const dateStr = format(now, "dd/MM/yyyy");
      const timeStr = format(now, "hh:mm:ss a");
      let locStr = location ? `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}` : "Location: Unknown";
      if (location?.address) {
          locStr = location.address.substring(0, 80); // Truncate if too long
      }

      // Calculate dynamic font size based on the smaller dimension to be readable on portrait and landscape
      const fontSize = Math.max(20, Math.floor(Math.min(canvas.width, canvas.height) * 0.035));
      context.font = `bold ${fontSize}px sans-serif`;
      
      const padding = Math.floor(fontSize * 0.8);
      const lineHeight = fontSize * 1.5;
      const barHeight = (lineHeight * 2.5) + (padding * 2);

      // Draw semi-transparent background bar at the bottom
      context.fillStyle = "rgba(0, 0, 0, 0.6)";
      context.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

      // Draw text
      context.fillStyle = "white";
      context.textBaseline = "top";
      context.textAlign = "left"; // Left align is safer for long text
      
      const startY = canvas.height - barHeight + padding;
      const startX = padding;
      context.fillText(`Date: ${dateStr}   Time: ${timeStr}`, startX, startY);
      context.fillText(locStr, startX, startY + lineHeight);

      // Convert canvas to Data URL
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
          const dt = new DataTransfer();
          dt.items.add(file);
          handleFiles(dt.files);
          stopCamera();
        });
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    
    // Check total limit
    if (selectedFiles.length + incoming.length > MAX_IMAGES) {
      toast.error(`You can only upload up to ${MAX_IMAGES} images per update.`);
      return;
    }
    
    // Check sizes
    const valid = incoming.filter(f => {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name} is larger than 5MB.`);
        return false;
      }
      return true;
    });

    const newFiles = [...selectedFiles, ...valid];
    setSelectedFiles(newFiles);
    
    // Create preview URLs
    const newPreviews = valid.map(f => URL.createObjectURL(f));
    setPreviewUrls([...previewUrls, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
    
    const newPreviews = [...previewUrls];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviewUrls(newPreviews);
  };

  const submitUpdate = async () => {
    if (!employee) return;
    if (selectedFiles.length === 0 && !notes.trim()) {
      toast.error("Please add some notes or images to submit an update.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Convert all images to base64 data URLs
      const uploadPromises = selectedFiles.map((file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });
      
      const uploadedPaths = await Promise.all(uploadPromises);

      // 2. Save record to DB via API
      const BASE = BASE_URL;
      const token = getToken();
      const res = await fetch(`${BASE}/api/daily-updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          employee_id: employee.employee_id,
          employee_name: employee.full_name,
          notes: notes.trim() || null,
          images: uploadedPaths,
        }),
      });

      if (!res.ok) throw new Error("Failed to save update");
      
      toast.success("Daily update submitted successfully!");
      
      // Clear form
      setSelectedFiles([]);
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
      setNotes("");
      
      // Refresh history
      fetchHistory();
      
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit update.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Daily Updates">
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-6 shadow-card border-t-4 border-t-primary">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">New Daily Update</h2>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              Share your field progress, reports, or daily activity. You can upload up to 6 images.
            </p>

            <div className="space-y-6">
              {/* Image Upload Area */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold">Images ({selectedFiles.length}/{MAX_IMAGES})</label>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => startCamera()}
                      disabled={selectedFiles.length >= MAX_IMAGES || submitting}
                      type="button"
                    >
                      <Camera className="w-4 h-4 mr-2" /> Take Photo
                    </Button>
                  </div>
                </div>
                
                {previewUrls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                    {previewUrls.map((url, i) => (
                      <div key={url} className="relative aspect-square rounded-lg border overflow-hidden group bg-black/5 dark:bg-black/40">
                        <img src={url} alt={`Preview ${i}`} className="w-full h-full object-contain" />
                        <button
                          onClick={() => removeFile(i)}
                          className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {selectedFiles.length < MAX_IMAGES && (
                      <button 
                        onClick={() => startCamera()}
                        className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors"
                        type="button"
                      >
                        <Camera className="w-6 h-6 mb-2 opacity-50" />
                        <span className="text-xs font-medium">Add more</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={() => startCamera()}
                    className="w-full py-12 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors"
                    type="button"
                  >
                    <Camera className="w-10 h-10 mb-3 opacity-40" />
                    <p className="font-medium text-foreground/80 mb-1">Click to take a photo</p>
                    <p className="text-xs">Capture up to {MAX_IMAGES} images</p>
                  </button>
                )}
              </div>

              {/* Notes Area */}
              <div>
                <label className="text-sm font-semibold mb-2 block">Additional Notes</label>
                <Textarea 
                  placeholder="Describe your progress or field work..."
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={submitting}
                  className="resize-none"
                />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={submitUpdate} 
                  disabled={submitting || (selectedFiles.length === 0 && !notes.trim())}
                  className="bg-gradient-primary shadow-elegant h-12 px-8"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {submitting ? "Submitting..." : "Submit Update"}
                </Button>
              </div>
            </div>
          </Card>

          {/* History */}
          <div className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Recent Updates</h3>
            {fetchingHistory ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 bg-muted/30 rounded-xl border border-dashed">
                <p className="text-muted-foreground">No recent updates found.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {history.map((record) => (
                  <Card key={record.id} className="p-5 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-semibold">{format(new Date(record.created_at), "EEEE, dd MMMM yyyy")}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(record.created_at), "hh:mm a")}</p>
                      </div>
                    </div>
                    
                    {record.notes && (
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap mb-4 bg-muted/30 p-3 rounded-md border border-muted">
                        {record.notes}
                      </p>
                    )}
                    
                    {record.signedUrls && record.signedUrls.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {record.signedUrls.map((url, i) => (
                          <button 
                            key={i} 
                            onClick={() => setViewImage(url)} 
                            className="block aspect-square rounded-md overflow-hidden border hover:opacity-90 transition-opacity bg-black/5 dark:bg-black/40"
                          >
                            <img src={url} alt={`Update ${i}`} className="w-full h-full object-contain" />
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera Fullscreen Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black">
          <div className="flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10 text-white">
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <MapPin className={`w-4 h-4 ${gettingLocation ? "animate-pulse text-yellow-400" : location ? "text-green-400" : "text-red-400"}`} />
              <span className="text-xs font-medium">
                {gettingLocation ? "Locating..." : location ? "Location Acquired" : "Location Unknown"}
              </span>
            </div>
            <button onClick={stopCamera} className="p-2 bg-black/40 rounded-full hover:bg-black/60 backdrop-blur-sm transition">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-cover max-h-[90vh]"
              playsInline
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-20">
                <div className="bg-white p-6 rounded-xl max-w-sm w-full mx-auto shadow-2xl">
                  <p className="text-red-500 font-semibold mb-4">{cameraError}</p>
                  <Button onClick={stopCamera} variant="outline" className="w-full text-black">Close Camera</Button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-gradient-to-t from-black via-black/80 to-transparent absolute bottom-0 left-0 right-0 flex justify-center items-center gap-12 pb-12 z-10">
            <button 
              onClick={toggleCamera}
              className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 backdrop-blur-md transition"
              title="Switch Camera"
            >
              <SwitchCamera className="w-7 h-7" />
            </button>

            <button 
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-white border-2 border-black/10"></div>
            </button>
            
            <div className="w-14"></div> {/* Placeholder for balance */}
          </div>
        </div>
      )}

      {/* Image Viewer Lightbox */}
      {viewImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4">
          <button 
            onClick={() => setViewImage(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={viewImage} 
            alt="Full view" 
            className="max-w-full max-h-full object-contain rounded-md" 
          />
        </div>
      )}
    </AppShell>
  );
}
