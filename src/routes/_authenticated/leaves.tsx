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
import { apiMe, getToken, apiAttendanceHistory, BASE_URL } from "@/lib/api";
import { useEmployee } from "@/hooks/useEmployee";
import { toast } from "sonner";
import { CalendarDays, Plus, Loader2, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaves")({
  component: LeavesPage,
});

function LeavesPage() {
  const queryClient = useQueryClient();
  const { employee } = useEmployee();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveType, setLeaveType] = useState<string>("");
  const [reason, setReason] = useState("");
  const [reportImage, setReportImage] = useState<File | null>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;

  const { data: leaves, isLoading } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const emp = await apiMe();
      if (!emp) throw new Error("Not authenticated");
      const BASE = BASE_URL;
      const token = getToken();
      const res = await fetch(`${BASE}/api/leaves`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendanceHistory"],
    queryFn: apiAttendanceHistory
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const emp = await apiMe();
      if (!emp) throw new Error("Not authenticated");
      if (!leaveDate) throw new Error("Please select a date");
      if (!leaveType) throw new Error("Please select a leave type");
      
      let image_b64 = undefined;
      if (leaveType === "Sick" && reportImage) {
        image_b64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(reportImage);
        });
      }

      const BASE = BASE_URL;
      const token = getToken();
      const res = await fetch(`${BASE}/api/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ leave_date: leaveDate, leave_type: leaveType, reason: reason, status: "Approved", image_b64 }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.detail || "Failed"); }
    },
    onSuccess: () => {
      toast.success("Leave recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      setLeaveDate("");
      setLeaveType("");
      setReason("");
      setReportImage(null);
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate || !leaveType || !reason.trim() || (leaveType === "Sick" && !reportImage)) {
      toast.error("Please fill all required details before submitting.");
      return;
    }
    setIsSubmitting(true);
    submitMutation.mutate();
  };

  const passedMonthsInFinYear = currentMonth >= 3 ? currentMonth - 3 : currentMonth + 9;
  const initialLeaves = 12;
  const totalLeaves = initialLeaves - passedMonthsInFinYear;
  
  let takenCasual = 0;
  let takenSick = 0;

  if (leaves) {
    leaves.forEach((l) => {
      if (l.leave_type === "Casual") takenCasual++;
      if (l.leave_type === "Sick") takenSick++;
    });
  }

  let absentDays = 0;
  if (employee && attendance) {
    const present = attendance.filter((r: any) => r.login_time && r.logout_time).length;
    const joined = employee.joining_date ? new Date(employee.joining_date) : new Date(employee.created_at || Date.now());
    const daysSince = Math.max(1, Math.ceil((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24)));
    absentDays = Math.max(0, daysSince - present);
  }

  const remainingCasual = Math.max(0, totalLeaves - takenCasual - absentDays);
  const remainingSick = Math.max(0, totalLeaves - takenSick);

  return (
    <AppShell title="Leave Management">
      <div className="p-4 md:p-8 pt-6 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Leave Management</h2>
            <p className="text-muted-foreground mt-1">
              Track your leave balances and submit leave requests.
            </p>
          </div>
        </div>

        {/* Balance Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-blue-800 dark:text-blue-300">Casual Leaves</CardTitle>
              <CardDescription className="text-blue-600/80 dark:text-blue-400/80">April {startYear} to March {endYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center mt-2">
                <div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalLeaves}</div>
                  <div className="text-xs text-blue-700 dark:text-blue-400">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{takenCasual + absentDays}</div>
                  <div className="text-xs text-blue-700 dark:text-blue-400">Taken</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{remainingCasual}</div>
                  <div className="text-xs text-blue-700 dark:text-blue-400">Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-purple-800 dark:text-purple-300">Sick Leaves</CardTitle>
              <CardDescription className="text-purple-600/80 dark:text-purple-400/80">April {startYear} to March {endYear}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center mt-2">
                <div>
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{totalLeaves}</div>
                  <div className="text-xs text-purple-700 dark:text-purple-400">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{takenSick}</div>
                  <div className="text-xs text-purple-700 dark:text-purple-400">Taken</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{remainingSick}</div>
                  <div className="text-xs text-purple-700 dark:text-purple-400">Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
          <Info className="h-5 w-5 shrink-0 text-blue-500" />
          <p>Since {passedMonthsInFinYear} months of the financial year are already over, you have {totalLeaves} Casual Leaves and {totalLeaves} Sick Leaves remaining for the period of April {startYear} to March {endYear}.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form Section */}
          <Card className="md:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Apply for Leave
              </CardTitle>
              <CardDescription>Record a new leave day.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date" 
                    value={leaveDate} 
                    onChange={(e) => setLeaveDate(e.target.value)} 
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Select value={leaveType} onValueChange={setLeaveType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Casual">Casual</SelectItem>
                      <SelectItem value="Sick">Sick</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {leaveType === "Sick" && (
                  <div className="space-y-2">
                    <Label>Medical Report (Image)</Label>
                    {!reportImage ? (
                      <Input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setReportImage(e.target.files?.[0] || null)}
                      />
                    ) : (
                      <div className="flex items-center justify-between p-2 border rounded-md">
                        <span className="text-sm truncate max-w-[200px]">{reportImage.name}</span>
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="sm"
                          onClick={() => setReportImage(null)}
                        >
                          Remove Report
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea 
                    placeholder="Briefly explain the reason..." 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)} 
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CalendarDays className="h-4 w-4 mr-2" />
                  )}
                  Submit Leave
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* History Section */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Leave History ({new Date().getFullYear()})</CardTitle>
              <CardDescription>Your taken leaves for the current year.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : leaves && leaves.length > 0 ? (
                <div className="space-y-4">
                  {leaves.map((leave) => (
                    <div key={leave.id} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{new Date(leave.leave_date).toLocaleDateString()}</div>
                        <div className="text-sm text-muted-foreground mt-1">{leave.reason || "No reason provided"}</div>
                        {leave.image_b64 && (
                          <div className="mt-3">
                            <a href={leave.image_b64} target="_blank" rel="noreferrer">
                              <img src={leave.image_b64} alt="Medical Report" className="w-16 h-16 object-cover rounded-md border shadow-sm hover:opacity-80 transition" />
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={`text-sm px-2 py-1 rounded-md font-medium ${
                          leave.leave_type === "Casual" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                        }`}>
                          {leave.leave_type}
                        </div>
                        <div className={`text-xs px-2 py-0.5 rounded-full border ${
                          leave.status === "Rejected" 
                            ? "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                            : leave.status === "Pending"
                            ? "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900"
                            : "text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                        }`}>
                          {leave.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  No leaves taken this year.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
