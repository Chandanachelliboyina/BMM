import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Download, Search, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { apiAttendanceHistory } from "@/lib/api";
import { useEmployee } from "@/hooks/useEmployee";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Attendance History — Bheemabhai Mahila Mandali" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { employee, loading } = useEmployee();
  const [records, setRecords] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("all");

  useEffect(() => {
    if (!employee) return;
    (async () => {
      setFetching(true);
      try {
        const data = await apiAttendanceHistory();
        if (data) { setRecords(data); setFiltered(data); }
      } catch { /* ignore */ }
      setFetching(false);
    })();
  }, [employee]);

  useEffect(() => {
    let result = records;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => r.employee_name.toLowerCase().includes(s) || r.employee_id.toLowerCase().includes(s));
    }
    if (filterMonth !== "all") {
      result = result.filter(r => {
        const date = new Date(r.login_date);
        return date.getMonth().toString() === filterMonth;
      });
    }
    setFiltered(result);
  }, [search, filterMonth, records]);

  const exportCSV = () => {
    const headers = ["Date", "Employee ID", "Name", "Login Time", "Logout Time", "Status", "Location"];
    const rows = filtered.map(r => [
      r.login_date,
      r.employee_id,
      r.employee_name,
      r.login_time ? format(new Date(r.login_time), "hh:mm a") : "",
      r.logout_time ? format(new Date(r.logout_time), "hh:mm a") : "",
      r.attendance_status,
      `"${r.full_address || ''}"` // Escape commas in address
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_history_${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <AppShell title="Attendance History">
      {loading || fetching ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <Card className="p-6 shadow-card">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-lg font-semibold">Attendance Records</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <FileText className="w-4 h-4 mr-2" /> Print PDF
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {Array.from({ length: 12 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(i);
                  return <SelectItem key={i} value={i.toString()}>{format(d, "MMMM")}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Working Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No attendance records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((record) => {
                    let hours = "—";
                    if (record.login_time && record.logout_time) {
                      const diffMs = new Date(record.logout_time).getTime() - new Date(record.login_time).getTime();
                      const hrs = Math.floor(diffMs / (1000 * 60 * 60));
                      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      hours = `${hrs}h ${mins}m`;
                    }
                    
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{format(new Date(record.login_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <div className="font-medium">{record.employee_name}</div>
                          <div className="text-xs text-muted-foreground">{record.employee_id}</div>
                        </TableCell>
                        <TableCell>{format(new Date(record.login_time), "hh:mm a")}</TableCell>
                        <TableCell>{record.logout_time ? format(new Date(record.logout_time), "hh:mm a") : "—"}</TableCell>
                        <TableCell>{hours}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={record.logout_time ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground"}>
                            {record.logout_time ? "Completed" : "Checked In"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs" title={record.logout_full_address || record.full_address || "N/A"}>
                          {record.logout_full_address ? record.logout_full_address : (record.full_address || "N/A")}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
