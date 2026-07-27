import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Trash2, Plus, Loader2 } from "lucide-react";
import { apiGetHolidays, apiCreateHoliday, apiDeleteHoliday, type Holiday } from "@/lib/api";
import { useEmployee } from "@/hooks/useEmployee";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/holidays")({
  head: () => ({ meta: [{ title: "Holidays — Bheemabhai Mahila Mandali (BMM)" }] }),
  component: HolidaysPage,
});

function HolidaysPage() {
  const { employee } = useEmployee();
  const isAdmin = employee?.role?.toUpperCase() === "ADMIN";
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const data = await apiGetHolidays();
      setHolidays(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch holidays");
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !name) {
      toast.error("Please fill in start date, end date, and name");
      return;
    }
    if (startDate > endDate) {
      toast.error("Start date cannot be after end date");
      return;
    }

    setSubmitting(true);
    try {
      await apiCreateHoliday({
        start_date: startDate,
        end_date: endDate,
        name,
        remarks: remarks || undefined,
      });
      toast.success("Holiday created successfully");
      setStartDate("");
      setEndDate("");
      setName("");
      setRemarks("");
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.message || "Failed to create holiday");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;
    try {
      await apiDeleteHoliday(id);
      toast.success("Holiday deleted");
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete holiday");
    }
  };

  const formatDateStr = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <CalendarDays className="h-6 w-6 text-primary" />
            Holiday Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View declared holidays. Attendance is not required on these days.
          </p>
        </div>
      </div>

      {isAdmin && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 bg-muted/20 border-b">
            <CardTitle className="text-lg">Add New Holiday</CardTitle>
            <CardDescription>Declare a new holiday for all employees.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleAddHoliday} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end">
              <div className="space-y-1 lg:col-span-1">
                <label className="text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
              <div className="space-y-1 lg:col-span-1">
                <label className="text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
              <div className="space-y-1 lg:col-span-1">
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Diwali"
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
              <div className="space-y-1 lg:col-span-1">
                <label className="text-sm font-medium">Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional details"
                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="lg:col-span-1">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add Holiday
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Declared Holidays</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {holidays.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No holidays declared yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Remarks</th>
                    {isAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {holidays.map((holiday) => (
                    <tr key={holiday.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {holiday.start_date === holiday.end_date
                          ? formatDateStr(holiday.start_date)
                          : `${formatDateStr(holiday.start_date)} - ${formatDateStr(holiday.end_date)}`}
                      </td>
                      <td className="px-4 py-3 font-medium">{holiday.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{holiday.remarks || "-"}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(holiday.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
