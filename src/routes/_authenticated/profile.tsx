import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Mail, Phone, MapPin, Building2, IdCard, Briefcase, Edit2, X } from "lucide-react";
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
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ 
    email: "", mobile_number: "", address: "", village: "",
    head: "", donor_name: "", department: "", 
    target_villages: "", target_mandals: "", targets: "" 
  });

  useEffect(() => {
    if (employee) {
      setForm({
        email: employee.email,
        mobile_number: employee.mobile_number,
        address: employee.address ?? "",
        village: employee.village ?? "",
        head: employee.head ?? "",
        donor_name: employee.donor_name ?? "",
        department: employee.department ?? "",
        target_villages: employee.target_villages ?? "",
        target_mandals: employee.target_mandals ?? "",
        targets: employee.targets ?? "",
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
      head: form.head || null,
      donor_name: form.donor_name || null,
      department: form.department || null,
      target_villages: form.target_villages || null,
      target_mandals: form.target_mandals || null,
      targets: form.targets || null,
    }).eq("user_id", employee.user_id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { 
      toast.success("Profile updated"); 
      setIsEditing(false);
      refresh(); 
    }
  };

  const cancelEdit = () => {
    if (employee) {
      setForm({
        email: employee.email,
        mobile_number: employee.mobile_number,
        address: employee.address ?? "",
        village: employee.village ?? "",
        head: employee.head ?? "",
        donor_name: employee.donor_name ?? "",
        department: employee.department ?? "",
        target_villages: employee.target_villages ?? "",
        target_mandals: employee.target_mandals ?? "",
        targets: employee.targets ?? "",
      });
    }
    setIsEditing(false);
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
              <Row icon={Briefcase} label="Position (locked)" value={employee.role} />
              <Row icon={Building2} label="Office" value={employee.office_location ?? "—"} />
            </div>
          </Card>

          <Card className="p-6 shadow-card lg:col-span-2 relative">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-semibold text-lg">Contact Information</h3>
                <p className="text-sm text-muted-foreground">Your contact details and address.</p>
              </div>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                </Button>
              )}
            </div>

            <div className="mt-2 grid sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label>Email <Mail className="w-3 h-3 inline text-muted-foreground" /></Label>
                {isEditing ? (
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                ) : (
                  <p className="font-medium bg-muted/30 p-2.5 rounded-md border">{form.email || "—"}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Mobile <Phone className="w-3 h-3 inline text-muted-foreground" /></Label>
                {isEditing ? (
                  <Input inputMode="numeric" maxLength={10} value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value.replace(/\D/g, "") })} />
                ) : (
                  <p className="font-medium bg-muted/30 p-2.5 rounded-md border">{form.mobile_number || "—"}</p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Village</Label>
                {isEditing ? (
                  <Input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} />
                ) : (
                  <p className="font-medium bg-muted/30 p-2.5 rounded-md border">{form.village || "—"}</p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                {isEditing ? (
                  <Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                ) : (
                  <p className="font-medium bg-muted/30 p-3 rounded-md border whitespace-pre-wrap min-h-[80px]">{form.address || "—"}</p>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t grid sm:grid-cols-2 gap-6">
              <h3 className="font-semibold text-lg sm:col-span-2">Work Information</h3>
              <div className="space-y-1.5">
                <Label>Head</Label>
                {isEditing ? <Input value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })} /> : <p className="font-medium bg-muted/30 p-2.5 rounded-md border">{form.head || "—"}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Donor Name</Label>
                {isEditing ? <Input value={form.donor_name} onChange={(e) => setForm({ ...form, donor_name: e.target.value })} /> : <p className="font-medium bg-muted/30 p-2.5 rounded-md border">{form.donor_name || "—"}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Department</Label>
                {isEditing ? <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /> : <p className="font-medium bg-muted/30 p-2.5 rounded-md border">{form.department || "—"}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Target Villages</Label>
                {isEditing ? <Textarea value={form.target_villages} onChange={(e) => setForm({ ...form, target_villages: e.target.value })} /> : <p className="font-medium bg-muted/30 p-2.5 rounded-md border">{form.target_villages || "—"}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Target Mandals</Label>
                {isEditing ? <Textarea value={form.target_mandals} onChange={(e) => setForm({ ...form, target_mandals: e.target.value })} /> : <p className="font-medium bg-muted/30 p-2.5 rounded-md border">{form.target_mandals || "—"}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Targets</Label>
                {isEditing ? <Textarea value={form.targets} onChange={(e) => setForm({ ...form, targets: e.target.value })} /> : <p className="font-medium bg-muted/30 p-2.5 rounded-md border">{form.targets || "—"}</p>}
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

            {isEditing && (
              <div className="mt-6 flex justify-end gap-3 pt-6 border-t">
                <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving} className="bg-gradient-primary shadow-elegant">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save changes
                </Button>
              </div>
            )}
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
