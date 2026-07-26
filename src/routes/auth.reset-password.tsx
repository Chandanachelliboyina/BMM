import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { apiResetPasswordWithToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Create New Password — Bheemabhai Mahila Mandali (BMM)" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  // Get token from URL search params manually since we aren't using strict validateSearch here for simplicity
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
    } else {
      toast.error("Invalid or missing reset token.");
      navigate({ to: "/auth/forgot-password", replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await apiResetPasswordWithToken({
        token,
        new_password: newPassword,
      });
      setSuccess(true);
      toast.success("Password reset successfully. You can now log in.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-hero text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/90 shadow-sm flex items-center justify-center overflow-hidden p-0.5">
            <img src="/BMM_LOGO.jpg" alt="BMM Logo" className="w-full h-full object-cover rounded-lg" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Bheemabhai Mahila Mandali (BMM)</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight">Almost there.</h1>
          <p className="mt-4 text-primary-foreground/80 leading-relaxed">
            Create a strong, secure new password to protect your account.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">© {new Date().getFullYear()} Bheemabhai Mahila Mandali (BMM)</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          
          <div className="lg:hidden flex items-center gap-2 mb-8 text-primary">
            <img src="/BMM_LOGO.jpg" alt="BMM Logo" className="w-8 h-8 object-cover rounded-md shadow-sm" />
            <span className="font-semibold text-lg">BMM Portal</span>
          </div>
          
          {success ? (
            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Password Reset Complete</h2>
                <p className="text-muted-foreground">
                  Your password has been changed successfully.
                </p>
              </div>
              <Link to="/auth/login" className="w-full inline-block">
                <Button className="w-full h-11">
                  Return to Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold tracking-tight">Create New Password</h2>
              <p className="mt-2 text-muted-foreground">Enter a new password for your account.</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary shadow-elegant mt-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
