import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarCheck, CalendarX2, Clock, TrendingUp, ClipboardList, Activity, User } from "lucide-react";
import { apiAttendanceHistory, apiEmployeeCount } from "@/lib/api";
import { useEmployee } from "@/hooks/useEmployee";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Bheemabhai Mahila Mandali (BMM)" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { employee, photoUrl, loading } = useEmployee();
  const [stats, setStats] = useState({ 
    totalOrgEmployees: 0,
    present: 0, 
    absent: 0, 
    todayTime: null as string | null,
    todayLogout: null as string | null,
    status: "Absent"
  });
  const [latestCard, setLatestCard] = useState<any>(null);

  useEffect(() => {
    if (!employee) return;
    (async () => {
      const data = await apiAttendanceHistory();
      const totalEmp = await apiEmployeeCount();

      const present = data?.length ?? 0;
      const today = format(new Date(), "yyyy-MM-dd");
      const todayRow = data?.find((r) => r.login_date === today);
      const joined = employee.joining_date ? new Date(employee.joining_date) : new Date(employee.created_at || Date.now());
      const daysSince = Math.max(1, Math.ceil((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24)));

      setStats({
        totalOrgEmployees: totalEmp || 0,
        present,
        absent: Math.max(0, daysSince - present),
        todayTime: todayRow ? format(new Date(todayRow.login_time), "hh:mm a") : null,
        todayLogout: todayRow?.logout_time ? format(new Date(todayRow.logout_time), "hh:mm a") : null,
        status: todayRow ? (todayRow.logout_time ? "Checked Out" : "Checked In") : "Absent"
      });

      if (data && data.length > 0) {
        const latest = data[0];
        setLatestCard({ ...latest, signedSelfie: latest.selfie_b64 ?? null });
      }
    })();
  }, [employee]);

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

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={User} label="Total Employees" value={String(stats.totalOrgEmployees || 1)} sub="In Organization" tone="muted" />
            <StatCard icon={Clock} label="Today's Status" value={stats.status} sub={stats.todayTime ? `In: ${stats.todayTime}` + (stats.todayLogout ? ` | Out: ${stats.todayLogout}` : "") : "Not marked"} tone={stats.todayTime ? (stats.todayLogout ? "muted" : "success") : "warn"} />
            <StatCard icon={CalendarCheck} label="Present Days" value={String(stats.present)} sub="This tenure" tone="primary" />
            <StatCard icon={CalendarX2} label="Absent Days" value={String(stats.absent)} sub="Estimated" tone="danger" />
          </div>

          {/* Sections */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-6 shadow-card lg:col-span-2 bg-gradient-to-br from-background to-secondary/20">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Latest Attendance Card</h3>
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
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Activity Reports</h3>
              </div>
              <p className="text-sm text-muted-foreground">Weekly summaries land here.</p>
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
