import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { apiRequestResetLink } from "@/lib/api";
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
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [resetToken, setResetToken] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
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
      setLinkSent(true);
      setResetToken(res.reset_token);
      
      // Simulate sending email by showing the link in toast
      toast.success(
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">Simulated Email Received!</span>
          <span className="text-xs">In a real app, this would go to {email}.</span>
          <Link to="/auth/reset-password" search={{ token: res.reset_token }} className="text-xs text-blue-600 underline truncate">
            Click here to reset password
          </Link>
        </div>,
        { duration: 15000 }
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to send reset link");
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
            Verify your Employee ID and registered email to receive a secure password reset link.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">© {new Date().getFullYear()} Bheemabhai Mahila Mandali (BMM)</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <Link to="/auth/login" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to login
          </Link>
          
          <div className="lg:hidden flex items-center gap-2 mb-8 text-primary">
            <img src="/BMM_LOGO.jpg" alt="BMM Logo" className="w-8 h-8 object-cover rounded-md shadow-sm" />
            <span className="font-semibold text-lg">BMM Portal</span>
          </div>
          
          {linkSent ? (
            <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <MailCheck className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Check your email</h2>
                <p className="text-muted-foreground">
                  We've sent a secure password reset link to <span className="font-medium text-foreground">{email}</span>
                </p>
                
                <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm font-semibold mb-2">Simulated Email Received!</p>
                  <Link 
                    to="/auth/reset-password" 
                    search={{ token: resetToken }}
                    className="text-sm text-primary hover:underline block break-all"
                  >
                    Click here to reset your password
                  </Link>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setLinkSent(false)}>
                Try another email
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-bold tracking-tight">Reset Password</h2>
              <p className="mt-2 text-muted-foreground">Enter your details below to receive a reset link.</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
