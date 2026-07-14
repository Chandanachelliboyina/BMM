import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Mail, Phone, MapPin, Building2, IdCard, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmployee } from "@/hooks/useEmployee";
import { uploadProfilePhoto } from "@/lib/storage";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — NGO Connect" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { employee, photoUrl, loading, refresh } = useEmployee();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", mobile_number: "", address: "", village: "" });

  useEffect(() => {
    if (employee) {
      setForm({
        email: employee.email,
        mobile_number: employee.mobile_number,
        address: employee.address ?? "",
        village: employee.village ?? "",
      });
    }
  }, [employee]);

  const save = async () => {
    if (!employee) return;
    setSaving(true);
    const { error } = await supabase.from("employees").update({
      email: form.email.trim().toLowerCase(),
      mobile_number: form.mobile_number.trim(),
      address: form.address || null,
      village: form.village || null,
    }).eq("user_id", employee.user_id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); refresh(); }
  };

  const onPhoto = async (file: File | null) => {
    if (!file || !employee) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = await uploadProfilePhoto(employee.user_id, file, ext);
      await supabase.from("employees").update({ profile_photo: path }).eq("user_id", employee.user_id);
      toast.success("Photo updated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <AppShell title="My Profile">
      {loading || !employee ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl">
          <Card className="p-6 shadow-card lg:col-span-1 text-center">
            <div className="relative inline-block">
              <Avatar className="w-28 h-28 border-4 border-primary/15 mx-auto">
                {photoUrl && <AvatarImage src={photoUrl} />}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {employee.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-elegant hover:opacity-90"
                title="Change photo"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} />
            </div>
            <h2 className="mt-4 text-xl font-bold">{employee.full_name}</h2>
            <div className="flex justify-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" className="font-mono">{employee.employee_id}</Badge>
              <Badge variant="outline">{employee.role}</Badge>
            </div>
            <div className="mt-6 space-y-3 text-sm text-left">
              <Row icon={IdCard} label="Employee ID (locked)" value={employee.employee_id} />
              <Row icon={Briefcase} label="Role (locked)" value={employee.role} />
              <Row icon={Building2} label="Department" value={employee.department ?? "—"} />
              <Row icon={MapPin} label="Office" value={employee.office_location ?? "—"} />
            </div>
          </Card>

          <Card className="p-6 shadow-card lg:col-span-2">
            <h3 className="font-semibold text-lg">Editable Information</h3>
            <p className="text-sm text-muted-foreground">Update your contact details, address and profile photo.</p>

            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email <Mail className="w-3 h-3 inline text-muted-foreground" /></Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile <Phone className="w-3 h-3 inline text-muted-foreground" /></Label>
                <Input inputMode="numeric" maxLength={10} value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="space-y-1.5">
                <Label>Village</Label>
                <Input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Read only</h4>
              <dl className="mt-3 grid sm:grid-cols-2 gap-4 text-sm">
                <ReadOnly label="Mandal" value={employee.mandal} />
                <ReadOnly label="District" value={employee.district} />
                <ReadOnly label="State" value={employee.state} />
                <ReadOnly label="PIN Code" value={employee.pin_code} />
                <ReadOnly label="Gender" value={employee.gender} />
                <ReadOnly label="Date of Birth" value={employee.date_of_birth} />
                <ReadOnly label="Joining Date" value={employee.joining_date} />
              </dl>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={save} disabled={saving} className="bg-gradient-primary shadow-elegant">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value ?? "—"}</dd>
    </div>
  );
}
