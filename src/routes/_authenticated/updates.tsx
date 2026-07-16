import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, Send, X, ClipboardList, ImageIcon } from "lucide-react";
import { getToken } from "@/lib/api";
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

  const fetchHistory = async () => {
    if (!employee) return;
    setFetchingHistory(true);
    try {
      const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
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
      const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fileRef.current?.click()}
                    disabled={selectedFiles.length >= MAX_IMAGES || submitting}
                  >
                    <ImagePlus className="w-4 h-4 mr-2" /> Add Images
                  </Button>
                  <input 
                    type="file" 
                    ref={fileRef} 
                    hidden 
                    multiple 
                    accept="image/*" 
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
                
                {previewUrls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                    {previewUrls.map((url, i) => (
                      <div key={url} className="relative aspect-square rounded-lg border overflow-hidden group bg-muted">
                        <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
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
                        onClick={() => fileRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors"
                      >
                        <Camera className="w-6 h-6 mb-2 opacity-50" />
                        <span className="text-xs font-medium">Add more</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-12 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 hover:border-primary/50 transition-colors"
                  >
                    <ImageIcon className="w-10 h-10 mb-3 opacity-40" />
                    <p className="font-medium text-foreground/80 mb-1">Click to browse images</p>
                    <p className="text-xs">Upload up to 6 images (Max 5MB each)</p>
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
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-md overflow-hidden border hover:opacity-90 transition-opacity">
                            <img src={url} alt={`Update ${i}`} className="w-full h-full object-cover" />
                          </a>
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
    </AppShell>
  );
}
