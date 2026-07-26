import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiMe, getToken, BASE_URL } from "@/lib/api";
import { useEmployee } from "@/hooks/useEmployee";
import { toast } from "sonner";
import { CalendarDays, Plus, Loader2, CheckCircle2, XCircle, Clock, TrendingUp, Minus, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaves")({
  component: LeavesPage,
});

interface BalanceSummary {
  financial_year: string;
  fy_label: string;
  fy_start_year: number;
  is_current_fy: boolean;
  months_earned: number;
  total_casual_earned: number;
  total_sick_earned: number;
  total_casual_used: number;
  total_sick_used: number;
  remaining_casual: number;
  remaining_sick: number;
}

/** Get the current FY start year */
function getCurrentFYStart(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Generate a list of FY options: from 2025 up to current FY */
function getFYOptions(): { value: number; label: string }[] {
  const currentFY = getCurrentFYStart();
  const options: { value: number; label: string }[] = [];
  // Show from 2025 (FY 2025-26) through current + 0
  const startYear = 2025;
  for (let y = startYear; y <= currentFY; y++) {
    options.push({
      value: y,
      label: `FY ${y}-${String(y + 1).slice(-2)}`,
    });
  }
  return options;
}

function LeavesPage() {
  const queryClient = useQueryClient();
  const { employee, refresh: refreshEmployee } = useEmployee();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Year selector — default to current FY
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentFYStart);
  const fyOptions = useMemo(() => getFYOptions(), []);
  const isCurrentFY = selectedYear === getCurrentFYStart();
  
  // Status Filter
  const [filterStatus, setFilterStatus] = useState<string>("All");
  
  // Form State
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveType, setLeaveType] = useState<string>("");
  const [reason, setReason] = useState("");
  const [reportImage, setReportImage] = useState<File | null>(null);

  // Fetch leave balance summary (month-wise) for selected year
  const { data: balanceSummary } = useQuery<BalanceSummary>({
    queryKey: ["leaveBalanceSummary", selectedYear],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/api/leaves/balance-summary?year=${selectedYear}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load balance");
      return res.json();
    },
  });

  // Fetch leaves for selected year
  const { data: leaves, isLoading } = useQuery({
    queryKey: ["leaves", selectedYear],
    queryFn: async () => {
      const emp = await apiMe();
      if (!emp) throw new Error("Not authenticated");
      const token = getToken();
      const res = await fetch(`${BASE_URL}/api/leaves?year=${selectedYear}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
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

      const token = getToken();
      const res = await fetch(`${BASE_URL}/api/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ leave_date: leaveDate, leave_type: leaveType, reason: reason, status: "Pending", image_b64 }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.detail || "Failed"); }
    },
    onSuccess: () => {
      toast.success("Leave request submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaveBalanceSummary"] });
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/api/leaves/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.detail || "Failed to update status");
      }
    },
    onSuccess: () => {
      toast.success("Leave status updated!");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaveBalanceSummary"] });
      refreshEmployee();
    },
    onError: (error) => {
      toast.error(error.message);
    }
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

  const earnedCL = balanceSummary?.total_casual_earned ?? 0;
  const earnedSL = balanceSummary?.total_sick_earned ?? 0;
  const usedCL = balanceSummary?.total_casual_used ?? 0;
  const usedSL = balanceSummary?.total_sick_used ?? 0;
  const remainingCL = balanceSummary?.remaining_casual ?? 0;
  const remainingSL = balanceSummary?.remaining_sick ?? 0;
  const fyLabel = balanceSummary?.fy_label ?? "";
  const fyTitle = balanceSummary?.financial_year ?? "";

  const canGoPrev = selectedYear > 2025;
  const canGoNext = selectedYear < getCurrentFYStart();

  const filteredLeaves = useMemo(() => {
    if (!leaves) return [];
    if (filterStatus === "All") return leaves;
    return leaves.filter((l: any) => l.status === filterStatus || (filterStatus === "Approve" && l.status === "Approved") || (filterStatus === "Reject" && l.status === "Rejected"));
  }, [leaves, filterStatus]);

  return (
    <AppShell title="Leave Management">
      <div className="p-4 md:p-8 pt-6 max-w-6xl mx-auto space-y-8">
        {/* Header with Year Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Leave Management</h2>
            <p className="text-muted-foreground mt-1">
              Track leave balances and submit requests year-wise.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px] h-9 font-medium">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-sm"
                onClick={() => setSelectedYear((y) => y - 1)}
                disabled={!canGoPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(Number(val))}
              >
                <SelectTrigger className="w-[130px] h-8 font-semibold border-0 shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fyOptions.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-sm"
                onClick={() => setSelectedYear((y) => y + 1)}
                disabled={!canGoNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* FY Sub-label */}
        {fyLabel && (
          <div className="flex items-center gap-2 -mt-4">
            <span className="text-sm font-medium text-primary">{fyTitle}</span>
            <span className="text-sm text-muted-foreground">({fyLabel})</span>
            {isCurrentFY && (
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">CURRENT YEAR</span>
            )}
          </div>
        )}

        {/* Balance Dashboard — Earned / Used / Remaining */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Casual Leave Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Casual Leave (CL)
              </CardTitle>
              <CardDescription className="text-blue-600/70 dark:text-blue-400/70">1 CL earned per month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center mt-2">
                <div className="p-3 rounded-lg bg-blue-100/60 dark:bg-blue-900/30">
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{earnedCL}</div>
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-400">Total</div>
                </div>
                <div className="p-3 rounded-lg bg-red-100/60 dark:bg-red-900/20">
                  <div className="flex items-center justify-center gap-1">
                    <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{usedCL}</div>
                  <div className="text-xs font-medium text-red-600/80 dark:text-red-400/80">Used</div>
                </div>
                <div className="p-3 rounded-lg bg-green-100/60 dark:bg-green-900/20">
                  <div className="flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{remainingCL}</div>
                  <div className="text-xs font-medium text-green-600/80 dark:text-green-400/80">Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sick Leave Card */}
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-purple-800 dark:text-purple-300 flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Sick Leave (SL)
              </CardTitle>
              <CardDescription className="text-purple-600/70 dark:text-purple-400/70">1 SL earned per month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center mt-2">
                <div className="p-3 rounded-lg bg-purple-100/60 dark:bg-purple-900/30">
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">{earnedSL}</div>
                  <div className="text-xs font-medium text-purple-700 dark:text-purple-400">Total</div>
                </div>
                <div className="p-3 rounded-lg bg-red-100/60 dark:bg-red-900/20">
                  <div className="flex items-center justify-center gap-1">
                    <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{usedSL}</div>
                  <div className="text-xs font-medium text-red-600/80 dark:text-red-400/80">Used</div>
                </div>
                <div className="p-3 rounded-lg bg-green-100/60 dark:bg-green-900/20">
                  <div className="flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{remainingSL}</div>
                  <div className="text-xs font-medium text-green-600/80 dark:text-green-400/80">Remaining</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form Section — only show for current FY */}
          {isCurrentFY && (
            <Card className="md:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Apply for Leave
                </CardTitle>
                <CardDescription>Submit a new leave request.</CardDescription>
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
                        <SelectItem value="Casual">Casual Leave (CL)</SelectItem>
                        <SelectItem value="Sick">Sick Leave (SL)</SelectItem>
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
          )}

          {/* History Section */}
          <Card className={isCurrentFY ? "md:col-span-2" : "md:col-span-3"}>
            <CardHeader>
              <CardTitle>Leave History — {fyTitle}</CardTitle>
              <CardDescription>
                {isCurrentFY 
                  ? "Your leave requests for the current financial year." 
                  : `Viewing historical leave data for ${fyTitle}.`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredLeaves && filteredLeaves.length > 0 ? (
                <div className="space-y-3">
                  {filteredLeaves.map((leave: any) => (
                    <div key={leave.id} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold flex items-center gap-2 flex-wrap">
                          {new Date(leave.leave_date).toLocaleDateString("en-IN", { 
                            weekday: "short", day: "numeric", month: "short", year: "numeric" 
                          })}
                          {employee?.role?.toUpperCase() === "ADMIN" && employee.employee_id !== leave.employee_id && (
                            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                              {leave.employee_name || leave.employee_id}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{leave.reason || "No reason provided"}</div>
                        {leave.image_b64 && (
                          <div className="mt-3">
                            <a href={leave.image_b64} target="_blank" rel="noreferrer">
                              <img src={leave.image_b64} alt="Medical Report" className="w-16 h-16 object-cover rounded-md border shadow-sm hover:opacity-80 transition" />
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className={`text-sm px-2.5 py-1 rounded-md font-medium ${
                          leave.leave_type === "Casual" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                        }`}>
                          {leave.leave_type === "Casual" ? "CL" : "SL"}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${
                          leave.status === "Rejected" 
                            ? "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                            : leave.status === "Pending"
                            ? "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900"
                            : "text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
                        }`}>
                          {leave.status === "Approved" && <CheckCircle2 className="h-3 w-3" />}
                          {leave.status === "Rejected" && <XCircle className="h-3 w-3" />}
                          {leave.status === "Pending" && <Clock className="h-3 w-3" />}
                          {leave.status}
                        </div>
                        {employee?.role?.toUpperCase() === "ADMIN" && leave.status === "Pending" && isCurrentFY && (
                          <div className="flex gap-2 mt-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950/50" 
                              onClick={() => updateStatusMutation.mutate({ id: leave.id, status: "Approved" })}
                              disabled={updateStatusMutation.isPending}
                            >
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50" 
                              onClick={() => updateStatusMutation.mutate({ id: leave.id, status: "Rejected" })}
                              disabled={updateStatusMutation.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  No leaves match the selected filter.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
