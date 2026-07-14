import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activities")({
  component: ActivitiesPage,
});

function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [villages, setVillages] = useState("");
  const [villageNames, setVillageNames] = useState("");
  const [meetings, setMeetings] = useState("");
  const [remarks, setRemarks] = useState("");

  const { data: activities, isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { error } = await supabase.from("activities").insert({
        user_id: user.user.id,
        date: date,
        villages_visited: parseInt(villages) || 0,
        village_names: villageNames,
        meetings_conducted: meetings,
        remarks: remarks,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity logged successfully!");
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      setVillages("");
      setVillageNames("");
      setMeetings("");
      setRemarks("");
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
    <AppShell title="Activities">
      <div className="p-4 md:p-8 pt-6 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Daily Activities</h2>
            <p className="text-muted-foreground mt-1">
              Log your village visits, meetings conducted, and daily remarks.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form Section */}
          <Card className="md:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Activity
              </CardTitle>
              <CardDescription>Record what you did today.</CardDescription>
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
                  <Label>Villages Visited (Number)</Label>
                  <Input 
                    type="number" 
                    min="0"
                    placeholder="e.g. 3" 
                    value={villages} 
                    onChange={(e) => setVillages(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Villages Names</Label>
                  <Input 
                    placeholder="e.g. Village A, Village B" 
                    value={villageNames} 
                    onChange={(e) => setVillageNames(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Meetings Conducted</Label>
                  <Input 
                    placeholder="Which meetings? (e.g. SHG meeting)" 
                    value={meetings} 
                    onChange={(e) => setMeetings(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea 
                    placeholder="Any notes for today..." 
                    value={remarks} 
                    onChange={(e) => setRemarks(e.target.value)} 
                    rows={4}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Activity className="h-4 w-4 mr-2" />
                  )}
                  Save Activity
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* History Section */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>Your recently logged activities.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activities && activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((act) => (
                    <div key={act.id} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold">{new Date(act.date).toLocaleDateString()}</div>
                        <div className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-md flex flex-col items-end">
                          <span>{act.villages_visited || 0} Villages</span>
                        </div>
                      </div>

                      {act.village_names && (
                        <div className="mb-2">
                          <span className="text-sm font-medium text-muted-foreground block mb-1">Villages Names:</span>
                          <p className="text-sm">{act.village_names}</p>
                        </div>
                      )}
                      
                      {act.meetings_conducted && (
                        <div className="mb-2">
                          <span className="text-sm font-medium text-muted-foreground block mb-1">Meetings:</span>
                          <p className="text-sm">{act.meetings_conducted}</p>
                        </div>
                      )}

                      {act.remarks && (
                        <div>
                          <span className="text-sm font-medium text-muted-foreground block mb-1">Remarks:</span>
                          <p className="text-sm whitespace-pre-wrap">{act.remarks}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  No activities logged yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
