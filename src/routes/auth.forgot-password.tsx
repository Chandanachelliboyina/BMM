import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";
import { apiRequestResetLink, apiResetPasswordWithToken } from "@/lib/api";
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
  const [step, setStep] = useState<"request" | "reset">("request");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Reset step state
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !email.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequestResetLink({
        employee_id: employeeId.trim().toUpperCase(),
        email: email.trim(),
      });
      setStep("reset");
      
      // Let the user know the OTP was sent to their email
      toast.success(
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">OTP Sent!</span>
          <span className="text-xs">We have sent a 6-digit verification code to {email}.</span>
        </div>,
        { duration: 5000 }
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || !newPassword || !confirmPassword) {
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
        token: otp.trim(),
        new_password: newPassword,
      });
      toast.success("Password reset successfully. You can now log in.");
      navigate({ to: "/auth/login", replace: true });
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
          <h1 className="text-4xl font-bold leading-tight">Secure your account easily.</h1>
          <p className="mt-4 text-primary-foreground/80 leading-relaxed">
            Verify your Employee ID and registered email to receive a secure OTP for resetting your password.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">© {new Date().getFullYear()} Bheemabhai Mahila Mandali (BMM)</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <button 
            onClick={() => step === "reset" ? setStep("request") : navigate({ to: "/auth/login" })}
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === "reset" ? "Back to email" : "Back to login"}
          </button>
          
          <div className="lg:hidden flex items-center gap-2 mb-8 text-primary">
            <img src="/BMM_LOGO.jpg" alt="BMM Logo" className="w-8 h-8 object-cover rounded-md shadow-sm" />
            <span className="font-semibold text-lg">BMM Portal</span>
          </div>
          
          {step === "reset" ? (
            <div className="animate-in fade-in zoom-in duration-500">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-center">Verify & Reset</h2>
              <p className="mt-2 text-muted-foreground text-center">
                Enter the 6-digit OTP sent to <span className="font-medium text-foreground">{email}</span>
              </p>
              
              <form onSubmit={handleResetPassword} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="otp">6-Digit OTP</Label>
                  <Input
                    id="otp"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    className="font-mono tracking-widest text-lg h-12"
                    required
                  />
                </div>
                
                <div className="space-y-2 pt-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
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
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary shadow-elegant mt-4">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
                </Button>
              </form>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold tracking-tight">Reset Password</h2>
              <p className="mt-2 text-muted-foreground">Enter your details below to receive a secure OTP.</p>

              <form onSubmit={handleRequestOtp} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="empid">Employee ID</Label>
                  <Input
                    id="empid"
                    placeholder="NGO001"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="uppercase"
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

                <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-primary shadow-elegant mt-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

