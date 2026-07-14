import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Plus, Loader2, UploadCloud, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportType, setReportType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [image1, setImage1] = useState<File | null>(null);
  const [image2, setImage2] = useState<File | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const uploadImage = async (file: File, userId: string, suffix: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}_${suffix}.${fileExt}`;
    const filePath = `reports/${fileName}`;

    // Using the 'attendance' bucket since it is already configured for the user.
    const { error: uploadError, data } = await supabase.storage
      .from("attendance")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("attendance")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      
      if (!reportType) throw new Error("Please select a report type");

      let imgUrl1 = null;
      let imgUrl2 = null;

      if (reportType === "Medical") {
        if (image1) imgUrl1 = await uploadImage(image1, user.user.id, "1");
        if (image2) imgUrl2 = await uploadImage(image2, user.user.id, "2");
      }

      const { error } = await supabase.from("reports").insert({
        user_id: user.user.id,
        date: date,
        report_type: reportType,
        description: description,
        image_url_1: imgUrl1,
        image_url_2: imgUrl2,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setReportType("");
      setDescription("");
      setImage1(null);
      setImage2(null);
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    submitMutation.mutate();
  };

  return (
    <AppShell title="Reports">
      <div className="p-4 md:p-8 pt-6 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
            <p className="text-muted-foreground mt-1">
              Submit and view your daily or incident reports.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form Section */}
          <Card className="md:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Report
              </CardTitle>
              <CardDescription>Submit a new report.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Medical">Medical</SelectItem>
                      <SelectItem value="Incident">Incident</SelectItem>
                      <SelectItem value="Financial">Financial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {reportType === "Medical" && (
                  <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                    <p className="text-xs text-muted-foreground font-medium">Medical Reports allow up to 2 image attachments.</p>
                    <div className="space-y-2">
                      <Label>Image 1</Label>
                      <Input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setImage1(e.target.files?.[0] || null)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Image 2 (Optional)</Label>
                      <Input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setImage2(e.target.files?.[0] || null)} 
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Provide report details..." 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    rows={4}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Submit Report
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* History Section */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Report History</CardTitle>
              <CardDescription>Your previously submitted reports.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : reports && reports.length > 0 ? (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div key={report.id} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold">{new Date(report.date).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Submitted on {new Date(report.created_at).toLocaleString()}</div>
                        </div>
                        <div className="text-sm bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded-md font-medium">
                          {report.report_type}
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-sm whitespace-pre-wrap">{report.description}</p>
                      </div>

                      {(report.image_url_1 || report.image_url_2) && (
                        <div className="flex gap-4 mt-4 pt-4 border-t">
                          {report.image_url_1 && (
                            <a href={report.image_url_1} target="_blank" rel="noopener noreferrer" className="block relative w-24 h-24 rounded-md overflow-hidden border group">
                              <img src={report.image_url_1} alt="Report 1" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ImageIcon className="text-white h-5 w-5" />
                              </div>
                            </a>
                          )}
                          {report.image_url_2 && (
                            <a href={report.image_url_2} target="_blank" rel="noopener noreferrer" className="block relative w-24 h-24 rounded-md overflow-hidden border group">
                              <img src={report.image_url_2} alt="Report 2" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ImageIcon className="text-white h-5 w-5" />
                              </div>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  No reports submitted yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
