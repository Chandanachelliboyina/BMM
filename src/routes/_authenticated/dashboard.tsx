import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarCheck, CalendarX2, Clock, TrendingUp, ClipboardList, Activity, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const [stats, setStats] = useState({ present: 0, absent: 0, todayTime: null as string | null });

  useEffect(() => {
    if (!employee) return;
    (async () => {
      const { data } = await supabase
        .from("attendance")
        .select("login_date, login_time")
        .eq("user_id", employee.user_id)
        .order("login_date", { ascending: false });
      const present = data?.length ?? 0;
      const today = format(new Date(), "yyyy-MM-dd");
      const todayRow = data?.find((r) => r.login_date === today);
      const joined = employee.joining_date ? new Date(employee.joining_date) : new Date(employee.created_at);
      const daysSince = Math.max(1, Math.ceil((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24)));
      setStats({
        present,
        absent: Math.max(0, daysSince - present),
        todayTime: todayRow ? format(new Date(todayRow.login_time), "hh:mm a") : null,
      });
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
            <StatCard icon={Clock} label="Today's Login" value={stats.todayTime ?? "—"} sub={stats.todayTime ? "Present" : "Not marked"} tone={stats.todayTime ? "success" : "warn"} />
            <StatCard icon={CalendarCheck} label="Present Days" value={String(stats.present)} sub="This tenure" tone="primary" />
            <StatCard icon={CalendarX2} label="Absent Days" value={String(stats.absent)} sub="Estimated" tone="danger" />
            <StatCard icon={TrendingUp} label="Total Leaves" value="0" sub="Coming soon" tone="muted" />
          </div>

          {/* Sections */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-6 shadow-card lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Daily Updates</h3>
              </div>
              <p className="text-sm text-muted-foreground">Submit your field notes and progress. Coming soon.</p>
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
