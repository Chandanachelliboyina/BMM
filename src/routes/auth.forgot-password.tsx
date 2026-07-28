import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ShieldCheck, Clock, CheckCircle2, KeyRound, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { apiRequestPasswordReset, apiCheckPasswordResetStatus, apiResetPasswordWithApproval } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — Bheemabhai Mahila Mandali (BMM)" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Approval and set new password state
  const [isApproved, setIsApproved] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !email.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await apiRequestPasswordReset({
        employee_id: employeeId.trim().toUpperCase(),
        email: email.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckApproval = async () => {
    if (!employeeId.trim()) {
      toast.error("Please enter your Employee ID");
      return;
    }
    setCheckingStatus(true);
    try {
      const res = await apiCheckPasswordResetStatus(employeeId.trim().toUpperCase());
      if (res.approved) {
        setIsApproved(true);
        toast.success(`Admin has approved your request! Set your new password below.`);
      } else {
        toast.info(res.message || "Request is still pending Admin approval. Please try again in a few moments.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to check status");
    } finally {
      setCheckingStatus(false);
    }
  };

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
      await apiResetPasswordWithApproval(employeeId.trim().toUpperCase(), newPassword);
      toast.success("Password updated successfully! Redirecting to login...");
      setTimeout(() => {
        navigate({ to: "/auth/login" });
      }, 1500);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-hero text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/90 shadow-sm flex items-center justify-center overflow-hidden p-0.5">
            <img src="/BMM_LOGO.jpg" alt="BMM Logo" className="w-full h-full object-cover rounded-lg" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Bheemabhai Mahila Mandali (BMM)</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight">Password Reset via Admin Approval</h1>
          <p className="mt-4 text-primary-foreground/80 leading-relaxed">
            Submit your Employee ID and registered email. Once admin approves your request, set your new password directly here or on your dashboard.
          </p>
          <div className="mt-8 space-y-4">
            {[
              { step: "1", label: "Submit Request", desc: "Enter your Employee ID & registered email" },
              { step: "2", label: "Admin Reviews", desc: "Admin approves your request in the Database portal" },
              { step: "3", label: "Set New Password", desc: "Enter NEW PASSWORD and CONFIRM PASSWORD to log in" },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="font-semibold text-sm">{item.label}</p>
                  <p className="text-primary-foreground/70 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-primary-foreground/70">© {new Date().getFullYear()} Bheemabhai Mahila Mandali (BMM)</p>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate({ to: "/auth/login" })}
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to login
          </button>

          <div className="lg:hidden flex items-center gap-2 mb-8 text-primary">
            <img src="/BMM_LOGO.jpg" alt="BMM Logo" className="w-8 h-8 object-cover rounded-md shadow-sm" />
            <span className="font-semibold text-lg">BMM Portal</span>
          </div>

          {/* ── STATE 1: Admin Approved — Show NEW PASSWORD and CONFIRM PASSWORD ── */}
          {isApproved ? (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-success/15 rounded-full flex items-center justify-center">
                  <KeyRound className="w-8 h-8 text-success" />
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-center">Admin Approved!</h2>
              <p className="mt-1 text-sm text-muted-foreground text-center">
                Set your new password below for Employee ID: <strong className="font-mono text-foreground">{employeeId.toUpperCase()}</strong>
              </p>

              <form onSubmit={handleSetNewPassword} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-pw-public" className="text-sm font-semibold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-primary" /> NEW PASSWORD
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-pw-public"
                      type={showNew ? "text" : "password"}
                      placeholder="Enter new password (min 6 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-pw-public" className="text-sm font-semibold flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-primary" /> CONFIRM PASSWORD
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-pw-public"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full h-11 bg-gradient-primary shadow-elegant mt-4"
                >
                  {pwLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Updating Password...</>
                  ) : (
                    <><KeyRound className="w-4 h-4 mr-2" />Set New Password & Login</>
                  )}
                </Button>
              </form>
            </div>
          ) : submitted ? (
            /* ── STATE 2: Submitted & Waiting for Approval ── */
            <div className="animate-in fade-in zoom-in duration-500 text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Request Submitted!</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
                Your password reset request for <strong className="font-mono text-foreground">{employeeId.toUpperCase()}</strong> has been sent to the admin.
              </p>

              <div className="mt-6 p-4 rounded-xl bg-warning/10 border border-warning/25 flex items-start gap-3 text-left">
                <Clock className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-warning-foreground">Waiting for Admin Approval</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Once the admin approves your request, click the button below to open the <strong>NEW PASSWORD</strong> & <strong>CONFIRM PASSWORD</strong> fields!
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <Button
                  onClick={handleCheckApproval}
                  disabled={checkingStatus}
                  className="w-full h-11 bg-gradient-primary shadow-elegant font-semibold"
                >
                  {checkingStatus ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Checking Status...</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4 mr-2" />Check Admin Approval Status & Set Password</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/auth/login" })}
                  className="w-full"
                >
                  Go to Login
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSubmitted(false)}
                  className="w-full text-xs text-muted-foreground"
                >
                  Submit Another Request
                </Button>
              </div>
            </div>
          ) : (
            /* ── STATE 3: Request Form ── */
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-center">Forgot Password</h2>
              <p className="mt-2 text-muted-foreground text-center text-sm">
                Enter your Employee ID and registered email to request Admin approval.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="empid">Employee ID</Label>
                  <Input
                    id="empid"
                    placeholder="e.g. NGO001"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="uppercase font-mono"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Registered Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-primary shadow-elegant mt-2 font-semibold"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Password Reset"}
                </Button>

                <div className="pt-2 border-t">
                  <button
                    type="button"
                    onClick={handleCheckApproval}
                    disabled={checkingStatus || !employeeId.trim()}
                    className="w-full text-xs text-primary hover:underline font-medium text-center bg-transparent border-none cursor-pointer py-1 disabled:opacity-50"
                  >
                    {checkingStatus ? "Checking Admin Approval..." : "Already requested? Check Admin Approval Status"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
