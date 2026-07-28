import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Database, Pencil, KeyRound, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { apiGetEmployees, apiToggleAccess, apiUpdateLeaves, Employee, apiMe, apiGetHolidays, apiGetPasswordResetRequests, apiApprovePasswordReset, apiRejectPasswordReset, type PasswordResetRequest, type Holiday } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useEmployee } from "@/hooks/useEmployee";

export const Route = createFileRoute("/_authenticated/database")({
  head: () => ({ meta: [{ title: "Database — BMM" }] }),
  beforeLoad: async () => {
    const me = await apiMe();
    if (me?.role?.toUpperCase() !== "ADMIN") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: DatabasePage,
});

function DatabasePage() {
  const { employee, loading } = useEmployee();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filtered, setFiltered] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(true);

  // Holidays state
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Dialog State
  const [editingLeaves, setEditingLeaves] = useState<Employee | null>(null);
  const [casualLeavesInput, setCasualLeavesInput] = useState("");
  const [sickLeavesInput, setSickLeavesInput] = useState("");

  // Password Reset Requests (admin)
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [resetFetching, setResetFetching] = useState(false);

  const loadEmployees = async () => {
    setFetching(true);
    try {
      const [empData, holData] = await Promise.all([
        apiGetEmployees(),
        apiGetHolidays()
      ]);
      setEmployees(empData);
      setFiltered(empData);
      setHolidays(holData);
    } catch (err: any) {
      toast.error(err.message || "Failed to load employees");
    } finally {
      setFetching(false);
    }
  };

  const loadResetRequests = async () => {
    setResetFetching(true);
    try {
      const data = await apiGetPasswordResetRequests();
      setResetRequests(data);
    } catch (err: any) {
      console.error("Failed to load reset requests", err);
    } finally {
      setResetFetching(false);
    }
  };

  useEffect(() => {
    if (employee?.role?.toUpperCase() === "ADMIN") {
      loadEmployees();
      loadResetRequests();
    }
  }, [employee]);

  useEffect(() => {
    if (!search) {
      setFiltered(employees);
      return;
    }
    const lower = search.toLowerCase();
    setFiltered(
      employees.filter(
        (e) =>
          e.full_name.toLowerCase().includes(lower) ||
          e.employee_id.toLowerCase().includes(lower) ||
          e.role.toLowerCase().includes(lower) ||
          (e.department && e.department.toLowerCase().includes(lower))
      )
    );
  }, [search, employees]);

  const handleToggleAccess = async (empId: string, currentAccess: boolean) => {
    try {
      const newAccess = !currentAccess;
      // Optimistic update
      setEmployees(prev => prev.map(e => e.employee_id === empId ? { ...e, has_access: newAccess } : e));
      await apiToggleAccess(empId, newAccess);
      toast.success(`Dashboard access ${newAccess ? 'granted' : 'revoked'} for ${empId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update access");
      // Revert on failure
      loadEmployees();
    }
  };

  const handleSaveLeaves = async () => {
    if (!editingLeaves) return;
    try {
      const casual = parseInt(casualLeavesInput, 10);
      const sick = parseInt(sickLeavesInput, 10);
      if (isNaN(casual) || isNaN(sick)) {
        toast.error("Please enter valid numbers");
        return;
      }
      
      // Optimistic update
      setEmployees(prev => prev.map(e => e.employee_id === editingLeaves.employee_id ? { ...e, casual_leaves: casual, sick_leaves: sick } : e));
      await apiUpdateLeaves(editingLeaves.employee_id, casual, sick);
      toast.success(`Leaves updated for ${editingLeaves.employee_id}`);
      setEditingLeaves(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update leaves");
      loadEmployees();
    }
  };

  const handleApproveReset = async (reqId: string, empId: string) => {
    try {
      await apiApprovePasswordReset(reqId);
      toast.success(`Password reset approved for ${empId}`);
      setResetRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err: any) {
      toast.error(err.message || "Failed to approve request");
    }
  };

  const handleRejectReset = async (reqId: string, empId: string) => {
    try {
      await apiRejectPasswordReset(reqId);
      toast.success(`Password reset rejected for ${empId}`);
      setResetRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err: any) {
      toast.error(err.message || "Failed to reject request");
    }
  };

  if (loading || fetching) {
    return (
      <AppShell title="Database">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Database">
      <Card className="p-6 shadow-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Employee Database
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage all employees and their access to the dashboard.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, role or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead className="text-center">Casual Leaves</TableHead>
                <TableHead className="text-center">Sick Leaves</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No employees found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow key={emp.employee_id}>
                    <TableCell className="font-mono font-medium">{emp.employee_id}</TableCell>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{emp.role}</Badge>
                    </TableCell>
                    <TableCell>{emp.department || "—"}</TableCell>
                    <TableCell>{emp.mobile_number}</TableCell>
                    <TableCell className="text-center font-semibold">{emp.casual_leaves ?? "—"}</TableCell>
                    <TableCell className="text-center font-semibold">{emp.sick_leaves ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-4">
                        <Switch
                          checked={emp.has_access !== false}
                          onCheckedChange={() => handleToggleAccess(emp.employee_id, emp.has_access !== false)}
                          title="Toggle Dashboard Access"
                        />
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingLeaves(emp);
                          setCasualLeavesInput(emp.casual_leaves?.toString() || "0");
                          setSickLeavesInput(emp.sick_leaves?.toString() || "0");
                        }} title="Edit Leaves">
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-6 shadow-card mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Password Reset Requests
              {resetRequests.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                  {resetRequests.length}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Employees requesting a password reset. Approve to allow them to set a new password from their dashboard.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadResetRequests} disabled={resetFetching}>
            {resetFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Requested At</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resetFetching ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : resetRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldAlert className="w-8 h-8 text-muted-foreground/40" />
                      <span>No pending password reset requests.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                resetRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono font-medium">{req.employee_id}</TableCell>
                    <TableCell className="font-medium">{req.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{req.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {req.created_at ? new Date(req.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-success text-success hover:bg-success/10 gap-1.5"
                          onClick={() => handleApproveReset(req.id, req.employee_id)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10 gap-1.5"
                          onClick={() => handleRejectReset(req.id, req.employee_id)}
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="p-6 shadow-card mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Holiday Database
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              View all declared holidays stored in the database.
            </p>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>From Date</TableHead>
                <TableHead>To Date</TableHead>
                <TableHead>Holiday Name</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No holidays found in database.
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map((hol) => {
                  const sDate = hol.start_date || (hol as any).startDate;
                  const eDate = hol.end_date || (hol as any).endDate;
                  
                  const safeFormat = (d: any) => {
                    try { return format(new Date(d), "MMM dd, yyyy"); }
                    catch { return typeof d === 'string' ? d : JSON.stringify(d); }
                  };

                  return (
                  <TableRow key={hol.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {sDate ? safeFormat(sDate) : "—"}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {eDate ? safeFormat(eDate) : "—"}
                    </TableCell>
                    <TableCell>{String(hol.name || (hol as any).holiday_name || "—")}</TableCell>
                    <TableCell className="text-muted-foreground">{String(hol.remarks || "—")}</TableCell>
                  </TableRow>
                )})
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!editingLeaves} onOpenChange={(open) => !open && setEditingLeaves(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Leaves</DialogTitle>
            <DialogDescription>Update the leave balances for {editingLeaves?.full_name} ({editingLeaves?.employee_id}).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Casual Leaves</Label>
              <Input
                type="number"
                value={casualLeavesInput}
                onChange={(e) => setCasualLeavesInput(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Sick Leaves</Label>
              <Input
                type="number"
                value={sickLeavesInput}
                onChange={(e) => setSickLeavesInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLeaves(null)}>Cancel</Button>
            <Button onClick={handleSaveLeaves}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
