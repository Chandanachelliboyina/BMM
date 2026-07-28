import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarCheck, CalendarX2, Clock, TrendingUp, ClipboardList, Activity, User, CalendarDays, KeyRound, Eye, EyeOff, CheckCircle2, ShieldAlert } from "lucide-react";
import { apiAttendanceHistory, apiEmployeeCount, getToken, BASE_URL, apiGetHolidays, apiSetNewPassword, type Holiday } from "@/lib/api";
import { useEmployee } from "@/hooks/useEmployee";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Bheemabhai Mahila Mandali (BMM)" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { employee, photoUrl, loading, refresh } = useEmployee();
  const [stats, setStats] = useState({ 
    totalOrgEmployees: 0,
    present: 0, 
    absent: 0, 
    todayTime: null as string | null,
    todayLogout: null as string | null,
    status: "Absent",
    casualLeaveBalance: 0,
    sickLeaveBalance: 0
  });
  const [latestCard, setLatestCard] = useState<any>(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState<Holiday[]>([]);

  // Set new password state (shown when password_reset_approved)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwUpdated, setPwUpdated] = useState(false);

  useEffect(() => {
    if (!employee) return;
    (async () => {
      const [data, totalEmp, hols] = await Promise.all([
        apiAttendanceHistory(),
        apiEmployeeCount(),
        apiGetHolidays()
      ]);

      // Only count as present if both login and logout exist
      const present = data?.filter((r) => r.login_time && r.logout_time).length ?? 0;
      const today = format(new Date(), "yyyy-MM-dd");
      const todayRow = data?.find((r) => r.login_date === today);
      const joined = employee.joining_date ? new Date(employee.joining_date) : new Date(employee.created_at || Date.now());
      const daysSince = Math.max(1, Math.ceil((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24)));

      let numSundays = 0;
      for (let i = 0; i < daysSince; i++) {
        const d = new Date(joined.getTime() + i * 24 * 60 * 60 * 1000);
        if (d.getDay() === 0) numSundays++;
      }

      setStats({
        totalOrgEmployees: totalEmp || 0,
        present,
        absent: Math.max(0, daysSince - present - numSundays),
        todayTime: todayRow ? format(new Date(todayRow.login_time), "hh:mm a") : null,
        todayLogout: todayRow?.logout_time ? format(new Date(todayRow.logout_time), "hh:mm a") : null,
        status: new Date().getDay() === 0 ? "Sunday" : (todayRow ? (todayRow.logout_time ? "Present" : "Check-in (Absent)") : "Absent"),
        casualLeaveBalance: employee.casual_leaves ?? 0,
        sickLeaveBalance: employee.sick_leaves ?? 0
      });

      if (data && data.length > 0) {
        const latest = data[0];
        setLatestCard({ ...latest, signedSelfie: latest.selfie_b64 ?? null });
      }

      if (hols) {
        // Filter to only show upcoming/current holidays safely
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const upcoming = hols
          .filter(h => (h.end_date || h.start_date || "") >= todayStr)
          .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""))
          .slice(0, 3);
        setUpcomingHolidays(upcoming);
      }
    })();
  }, [employee]);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setPwLoading(true);
    try {
      await apiSetNewPassword(newPassword);
      toast.success("Password updated successfully!");
      setPwUpdated(true);
      setNewPassword("");
      setConfirmPassword("");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <AppShell title="Dashboard">
      {loading || !employee ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hero */}
          <Card className="p-6 sm:p-8 bg-gradient-hero text-primary-foreground shadow-elegant border-0 overflow-hidden relative">
            <div className="flex flex-wrap items-center gap-5 relative z-10">
              <Avatar className="w-20 h-20 border-4 border-white/25">
                {photoUrl && <AvatarImage src={photoUrl} />}
                <AvatarFallback className="bg-white/20 text-primary-foreground text-xl font-bold">
                  {employee.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm text-primary-foreground/80">Welcome back,</p>
                <h2 className="text-2xl sm:text-3xl font-bold">{employee.full_name}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-white/15 hover:bg-white/20 text-primary-foreground border-0 font-mono">{employee.employee_id}</Badge>
                  <Badge className="bg-white/15 hover:bg-white/20 text-primary-foreground border-0">{employee.role}</Badge>
                  {employee.department && <Badge className="bg-white/15 hover:bg-white/20 text-primary-foreground border-0">{employee.department}</Badge>}
                </div>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm text-primary-foreground/80">Today</p>
                <p className="text-lg font-semibold">{format(new Date(), "EEE, dd MMM")}</p>
              </div>
            </div>
          </Card>

          {/* Set New Password Banner — only shown when admin has approved password reset */}
          {employee.password_reset_approved && !pwUpdated && (
            <Card className="p-6 shadow-elegant border-2 border-warning/50 bg-gradient-to-br from-warning/10 to-warning/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-warning/10 rounded-full -translate-y-8 translate-x-8" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Admin Approved — Set Your New Password</h3>
                    <p className="text-xs text-muted-foreground">Your password reset request has been approved by Admin. Please enter your new password below to update your account credentials.</p>
                  </div>
                </div>
                <form onSubmit={handleSetNewPassword} className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="new-pw" className="text-sm font-semibold flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-primary" /> NEW PASSWORD
                    </label>
                    <div className="relative">
                      <input
                        id="new-pw"
                        type={showNew ? "text" : "password"}
                        placeholder="Enter new password (min. 6 characters)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0">
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="confirm-pw" className="text-sm font-semibold flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-primary" /> CONFIRM PASSWORD
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-pw"
                        type={showConfirm ? "text" : "password"}
                        placeholder="Re-enter confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full h-10 px-3 pr-10 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer border-none"
                    >
                      {pwLoading ? (
                        <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Updating Password...</>
                      ) : (
                        <><KeyRound className="w-4 h-4" />Update Password</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </Card>
          )}

          {/* Success state after password update */}
          {pwUpdated && (
            <Card className="p-5 border-2 border-success/40 bg-success/5 flex items-center gap-4">
              <CheckCircle2 className="w-7 h-7 text-success shrink-0" />
              <div>
                <p className="font-semibold text-success">Password updated successfully!</p>
                <p className="text-xs text-muted-foreground">You can now log in with your new password next time.</p>
              </div>
            </Card>
          )}

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={User} label="Total Employees" value={String(stats.totalOrgEmployees || 1)} sub="In Organization" tone="muted" />
            <StatCard icon={Clock} label="Today's Status" value={stats.status} sub={stats.todayTime ? `In: ${stats.todayTime}` + (stats.todayLogout ? ` | Out: ${stats.todayLogout}` : "") : "Not marked"} tone={stats.todayTime ? (stats.todayLogout ? "muted" : "success") : "warn"} />
            <StatCard icon={CalendarCheck} label="Present Days" value={String(stats.present)} sub="This tenure" tone="primary" />
            <StatCard icon={CalendarX2} label="Absent Days" value={String(stats.absent)} sub="Estimated" tone="danger" />
          </div>

          {/* Leave Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-4 shadow-card bg-warning/5 border-warning/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2"><CalendarX2 className="w-5 h-5 text-warning" /> Casual Leave</h3>
                  <p className="text-sm text-muted-foreground mt-1">Current Balance: <span className="font-bold text-foreground">{stats.casualLeaveBalance} Days</span> remaining</p>
                  <p className="text-xs text-muted-foreground mt-0.5">-1 day deducted every month</p>
                </div>
                <Button asChild variant="outline" className="border-warning text-warning hover:bg-warning/10">
                  <Link to="/leaves">Apply</Link>
                </Button>
              </div>
            </Card>

            <Card className="p-4 shadow-card bg-destructive/5 border-destructive/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-destructive" /> Sick Leave</h3>
                  <p className="text-sm text-muted-foreground mt-1">Current Balance: <span className="font-bold text-foreground">{stats.sickLeaveBalance} Days</span> remaining</p>
                  <p className="text-xs text-muted-foreground mt-0.5">-1 day deducted every month</p>
                </div>
                <Button asChild variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
                  <Link to="/leaves">Apply</Link>
                </Button>
              </div>
            </Card>
          </div>

          {/* Sections */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-6 shadow-card lg:col-span-2 bg-gradient-to-br from-background to-secondary/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Latest Attendance Card</h3>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/history">View Attendance History</Link>
                </Button>
              </div>
              {latestCard ? (
                <div className="flex flex-col sm:flex-row gap-6">
                  {latestCard.signedSelfie ? (
                     <img src={latestCard.signedSelfie} alt="Latest Selfie" className="w-32 h-32 rounded-xl object-cover border-4 border-primary/20 shadow-sm" />
                  ) : (
                     <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center border text-xs text-muted-foreground">No Photo</div>
                  )}
                  <div className="space-y-3 flex-1">
                    <div>
                      <p className="text-lg font-bold text-foreground">{latestCard.employee_name}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(latestCard.login_date), "EEEE, dd MMMM yyyy")}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider">Login Time</p>
                        <p className="font-medium text-success">{format(new Date(latestCard.login_time), "hh:mm a")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider">Logout Time</p>
                        <p className="font-medium text-warning">{latestCard.logout_time ? format(new Date(latestCard.logout_time), "hh:mm a") : "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs uppercase tracking-wider">Check In Location</p>
                        <p className="font-medium truncate" title={latestCard.full_address}>{latestCard.full_address || "Unknown"}</p>
                      </div>
                      {latestCard.logout_time && (
                        <div className="col-span-2 mt-1">
                          <p className="text-muted-foreground text-xs uppercase tracking-wider">Check Out Location</p>
                          <p className="font-medium truncate" title={latestCard.logout_full_address}>{latestCard.logout_full_address || "Unknown"}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attendance records found yet.</p>
              )}
            </Card>
            <Card className="p-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Upcoming Holidays</h3>
              </div>
              {upcomingHolidays.length > 0 ? (
                <div className="space-y-4">
                  {upcomingHolidays.map(hol => (
                    <div key={hol.id} className="flex justify-between items-start text-sm border-b pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium">{hol.name || "Holiday"}</p>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          {hol.start_date && (
                            <p><span className="font-medium text-foreground/70">From:</span> {format(new Date(hol.start_date), "MMM dd, yyyy")}</p>
                          )}
                          {hol.end_date && hol.end_date !== hol.start_date && (
                            <p><span className="font-medium text-foreground/70">To:</span> {format(new Date(hol.end_date), "MMM dd, yyyy")}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs bg-primary/5">{hol.remarks || "Holiday"}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming holidays scheduled.</p>
              )}
            </Card>
            <Card className="p-6 shadow-card lg:col-span-3">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Quick Info</h3>
              </div>
              <dl className="grid sm:grid-cols-3 gap-4 text-sm">
                <Info label="Mobile" value={employee.mobile_number} />
                <Info label="Email" value={employee.email} />
                <Info label="Office" value={employee.office_location ?? "—"} />
                <Info label="Joining Date" value={employee.joining_date ? format(new Date(employee.joining_date), "dd MMM yyyy") : "—"} />
                <Info label="Department" value={employee.department ?? "—"} />
                <Info label="Location" value={[employee.village, employee.district, employee.state].filter(Boolean).join(", ") || "—"} />
              </dl>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string; tone: "primary" | "success" | "danger" | "warn" | "muted" }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    danger: "bg-destructive/10 text-destructive",
    warn: "bg-warning/20 text-warning-foreground",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-5 shadow-card">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mt-4">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
