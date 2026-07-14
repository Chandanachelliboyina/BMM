import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Building2, Loader2, Upload, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadProfilePhoto } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/auth/register")({
  head: () => ({
    meta: [
      { title: "Create Account — Bheemabhai Mahila Mandali (BMM)" },
      { name: "description", content: "Register as a BMM employee to receive your Employee ID and start marking selfie + GPS attendance." },
    ],
  }),
  component: RegisterPage,
});

const ROLES = ["Field Officer", "Coordinator", "Supervisor", "Manager", "Admin", "Volunteer"];

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name required").max(100),
  mobile_number: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  confirm_password: z.string(),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  village: z.string().trim().max(100).optional().or(z.literal("")),
  mandal: z.string().trim().max(100).optional().or(z.literal("")),
  district: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pin_code: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit PIN").optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  role: z.string().min(1, "Role required"),
  employee_id: z.string().trim().regex(/^[A-Za-z0-9]+$/, "Employee ID must contain only letters and numbers").min(3, "Employee ID must be at least 3 characters").max(20),
  office_location: z.string().trim().max(150).optional().or(z.literal("")),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords do not match", path: ["confirm_password"],
});

function RegisterPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "", mobile_number: "", email: "", password: "", confirm_password: "",
    address: "", village: "", mandal: "", district: "", state: "", pin_code: "",
    gender: "", date_of_birth: "",
    role: "", employee_id: "", office_location: "",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (!photoFile) {
      toast.error("Profile photo is required — it's used for face verification at attendance");
      return;
    }
    setLoading(true);
    try {
      // 1. Sign up (email confirmation must be OFF in project auth settings for smooth UX)
      const { data: signUp, error: signErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/attendance`,
          data: { full_name: form.full_name },
        },
      });
      if (signErr) throw signErr;
      const userId = signUp.user?.id;
      if (!userId) throw new Error("Unable to create account");

      // 2. Upload profile photo (required — used as reference for attendance selfies)
      let photoPath: string | null = null;
      try {
        const ext = (photoFile.name.split(".").pop() ?? "jpg").toLowerCase();
        photoPath = await uploadProfilePhoto(userId, photoFile, ext);
      } catch (err) {
        console.warn("Photo upload failed", err);
      }

      // 3. Insert employee row (trigger assigns employee_id)
      const { data: emp, error: insErr } = await supabase.from("employees").insert({
        user_id: userId,
        employee_id: form.employee_id.trim().toUpperCase(),
        full_name: form.full_name.trim(),
        mobile_number: form.mobile_number.trim(),
        email: form.email.trim().toLowerCase(),
        address: form.address || null,
        village: form.village || null,
        mandal: form.mandal || null,
        district: form.district || null,
        state: form.state || null,
        pin_code: form.pin_code || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        role: form.role,
        office_location: form.office_location || null,
        profile_photo: photoPath,
      }).select("employee_id").single();

      if (insErr) {
        if (insErr.message.toLowerCase().includes("employee_id")) toast.error("This Employee ID is already taken");
        else if (insErr.message.toLowerCase().includes("mobile")) toast.error("This mobile number is already registered");
        else if (insErr.message.toLowerCase().includes("email")) toast.error("This email is already registered");
        else toast.error(insErr.message);
        return;
      }

      setSuccess(emp.employee_id);
      toast.success(`Registered! Your Employee ID is ${emp.employee_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9 text-success" />
          </div>
          <h1 className="text-2xl font-bold mt-6">Registration Successful</h1>
          <p className="mt-2 text-muted-foreground">Your Bheemabhai Mahila Mandali (BMM) account is ready.</p>
          <div className="mt-6 rounded-xl border bg-secondary/60 p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your Employee ID</p>
            <p className="text-3xl font-bold text-primary mt-1 tracking-widest">{success}</p>
            <p className="text-xs text-muted-foreground mt-2">Use this ID with your password to sign in.</p>
          </div>
          <Button className="w-full mt-6 bg-gradient-primary" onClick={() => navigate({ to: "/auth/login" })}>
            Continue to Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6 text-primary">
          <img src="/logo.png" alt="BMM Logo" className="w-9 h-9 object-cover rounded-md shadow-sm" />
          <span className="text-xl font-semibold">Bheemabhai Mahila Mandali (BMM)</span>
        </div>
        <Card className="p-6 sm:p-8 shadow-card">
          <h1 className="text-2xl font-bold">Create New Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register to receive your Employee ID and access the attendance system.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* Personal */}
            <section>
              <h2 className="font-semibold text-lg mb-4 pb-2 border-b">Personal Information</h2>

              <div className="flex items-center gap-6 mb-6">
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-24 h-24 rounded-full border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-primary/10 transition"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Profile Photo <span className="text-destructive">*</span></p>
                  <p className="text-sm text-muted-foreground">Required — used to verify your face when marking attendance. JPG or PNG, up to 5MB.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileRef.current?.click()}>
                    {photoPreview ? "Change photo" : "Upload photo"}
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full Name *"><Input required value={form.full_name} onChange={(e) => set("full_name")(e.target.value)} /></Field>
                <Field label="Mobile Number *"><Input required inputMode="numeric" maxLength={10} value={form.mobile_number} onChange={(e) => set("mobile_number")(e.target.value.replace(/\D/g, ""))} /></Field>
                <Field label="Email Address *"><Input required type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} /></Field>
                <Field label="Gender">
                  <Select value={form.gender} onValueChange={set("gender")}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of Birth"><Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth")(e.target.value)} /></Field>
                <Field label="PIN Code"><Input inputMode="numeric" maxLength={6} value={form.pin_code} onChange={(e) => set("pin_code")(e.target.value.replace(/\D/g, ""))} /></Field>
                <Field label="Address" className="sm:col-span-2"><Textarea rows={2} value={form.address} onChange={(e) => set("address")(e.target.value)} /></Field>
                <Field label="Village"><Input value={form.village} onChange={(e) => set("village")(e.target.value)} /></Field>
                <Field label="Mandal"><Input value={form.mandal} onChange={(e) => set("mandal")(e.target.value)} /></Field>
                <Field label="District"><Input value={form.district} onChange={(e) => set("district")(e.target.value)} /></Field>
                <Field label="State"><Input value={form.state} onChange={(e) => set("state")(e.target.value)} /></Field>
              </div>
            </section>

            {/* Employment */}
            <section>
              <h2 className="font-semibold text-lg mb-4 pb-2 border-b">Employment Information</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Role *">
                  <Select value={form.role} onValueChange={set("role")}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Employee ID *"><Input required value={form.employee_id} placeholder="e.g. NGO001" maxLength={20} onChange={(e) => set("employee_id")(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} /></Field>
                <Field label="NGO Office Location"><Input value={form.office_location} onChange={(e) => set("office_location")(e.target.value)} /></Field>
              </div>
            </section>

            {/* Account */}
            <section>
              <h2 className="font-semibold text-lg mb-4 pb-2 border-b">Account Information</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Password *"><Input type="password" required minLength={6} value={form.password} onChange={(e) => set("password")(e.target.value)} /></Field>
                <Field label="Confirm Password *"><Input type="password" required minLength={6} value={form.confirm_password} onChange={(e) => set("confirm_password")(e.target.value)} /></Field>
              </div>
            </section>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button type="submit" disabled={loading} className="flex-1 h-11 bg-gradient-primary shadow-elegant">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
              </Button>
              <Link to="/auth/login" className="flex-1">
                <Button type="button" variant="outline" className="w-full h-11">Already registered? Sign in</Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
