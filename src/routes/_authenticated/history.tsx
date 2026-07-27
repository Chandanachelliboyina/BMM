import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Download, Search, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { apiAttendanceHistory, apiGetHolidays, type Holiday } from "@/lib/api";
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
  const [filterStatus, setFilterStatus] = useState("all");

  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    if (!employee) return;
    (async () => {
      setFetching(true);
      try {
        const [data, hols] = await Promise.all([
          apiAttendanceHistory(),
          apiGetHolidays()
        ]);
        
        if (data) { 
          setHolidays(hols);
          const denseRecords = fillMissingDays(data, hols);
          setRecords(denseRecords); 
          setFiltered(denseRecords); 
        }
      } catch { /* ignore */ }
      setFetching(false);
    })();
  }, [employee]);

  function fillMissingDays(records: any[], hols: Holiday[]) {
    if (!records.length) return records;
    
    const sortedRecords = [...records].sort((a, b) => new Date(b.login_date).getTime() - new Date(a.login_date).getTime());
    const minDateStr = sortedRecords[sortedRecords.length - 1].login_date;
    
    const today = new Date();
    const startDate = new Date(minDateStr);
    const dense = [];
    
    for (let d = new Date(today); d >= startDate; d.setDate(d.getDate() - 1)) {
       const dateStr = format(d, "yyyy-MM-dd");
       const dayRecords = records.filter(r => r.login_date === dateStr);
       
       const hol = hols.find(h => dateStr >= h.start_date && dateStr <= h.end_date);
       if (hol) {
          dense.push({
             id: 'hol-' + dateStr,
             login_date: dateStr,
             employee_name: "All Employees",
             employee_id: "—",
             attendance_status: `Holiday: ${hol.name}`,
             is_dummy: true
          });
       } else if (d.getDay() === 0) {
          dense.push({
             id: 'sun-' + dateStr,
             login_date: dateStr,
             employee_name: "All Employees",
             employee_id: "—",
             attendance_status: 'Sunday',
             is_dummy: true
          });
       }
       dense.push(...dayRecords);
    }
    return dense;
  }

  useEffect(() => {
    let result = records;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => r.is_dummy || r.employee_name.toLowerCase().includes(s) || r.employee_id.toLowerCase().includes(s));
    }
    if (filterMonth !== "all") {
      result = result.filter(r => {
        const date = new Date(r.login_date);
        return date.getMonth().toString() === filterMonth;
      });
    }
    if (filterStatus !== "all") {
      if (filterStatus === "present") {
        result = result.filter(r => r.is_dummy || !!r.logout_time);
      } else if (filterStatus === "absent") {
        result = result.filter(r => !r.is_dummy && !r.logout_time);
      }
    }
    setFiltered(result);
  }, [search, filterMonth, filterStatus, records]);

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

          <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Check-in (Absent)</SelectItem>
              </SelectContent>
            </Select>

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

          <div className="rounded-md border overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
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
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                        <TableCell>{record.is_dummy ? "—" : (record.login_time ? format(new Date(record.login_time), "hh:mm a") : "—")}</TableCell>
                        <TableCell>{record.is_dummy ? "—" : (record.logout_time ? format(new Date(record.logout_time), "hh:mm a") : "—")}</TableCell>
                        <TableCell>{record.is_dummy ? "—" : hours}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={record.is_dummy ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : (record.logout_time ? "bg-success/10 text-success" : "bg-warning/10 text-warning-foreground")}>
                            {record.is_dummy ? record.attendance_status : (record.logout_time ? "Present" : (record.attendance_status === "Absent" ? "Absent" : "Check-in (Absent)"))}
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
