import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Bheemabhai Mahila Mandali (BMM)" },
      { name: "description", content: "Sign in with your Employee ID to access the BMM attendance and management dashboard." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !password) {
      toast.error("Enter Employee ID and password");
      return;
    }
    setLoading(true);
    try {
      const { data: email, error: rpcErr } = await supabase.rpc("get_login_email", {
        p_employee_id: employeeId.trim().toUpperCase(),
      });
      if (rpcErr) throw rpcErr;
      if (!email) {
        toast.error("Invalid Employee ID");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message || "Invalid credentials");
        return;
      }
      if (remember && typeof window !== "undefined") {
        localStorage.setItem("ngo_last_employee_id", employeeId.trim().toUpperCase());
      }
      toast.success("Signed in successfully");
      navigate({ to: "/attendance", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-hero text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Bheemabhai Mahila Mandali (BMM)</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight">Empowering our field teams, one check-in at a time.</h1>
          <p className="mt-4 text-primary-foreground/80 leading-relaxed">
            Register once, verify attendance with a live selfie & GPS, and manage the BMM workforce from a single, modern dashboard.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">© {new Date().getFullYear()} Bheemabhai Mahila Mandali (BMM)</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 text-primary">
            <Building2 className="w-6 h-6" />
            <span className="font-semibold text-lg">Bheemabhai Mahila Mandali (BMM)</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-muted-foreground">Sign in to mark your attendance and access your dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="empid">Employee ID</Label>
              <Input
                id="empid"
                placeholder="NGO001"
                autoComplete="username"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="uppercase"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="text-primary hover:underline font-medium"
                onClick={() => toast.info("Please contact your BMM administrator to reset your password.")}
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary shadow-elegant">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            New employee?{" "}
            <Link to="/auth/register" className="text-primary font-semibold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
