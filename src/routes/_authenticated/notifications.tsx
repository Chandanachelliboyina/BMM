import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, CheckCircle2, AlertTriangle, Info, Clock, Check, Send, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGetNotifications, apiMarkNotificationRead, apiMarkAllNotificationsRead, apiGetEmployees, apiCreateNotification, DBNotification } from "@/lib/api";
import { useEmployee } from "@/hooks/useEmployee";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — BMM" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { employee } = useEmployee();
  
  // Admin Form State
  const [targetEmployee, setTargetEmployee] = useState<string>("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifType, setNotifType] = useState<string>("info");

  // Fetch current user notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: apiGetNotifications,
  });

  // Fetch employees for admin dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: apiGetEmployees,
    enabled: employee?.role === "Admin",
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllMutation = useMutation({
    mutationFn: apiMarkAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All marked as read");
    }
  });

  const markReadMutation = useMutation({
    mutationFn: apiMarkNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const createNotifMutation = useMutation({
    mutationFn: apiCreateNotification,
    onSuccess: () => {
      toast.success("Notification sent successfully!");
      setTargetEmployee("");
      setNotifTitle("");
      setNotifMessage("");
      setNotifType("info");
      // If admin sent it to themselves, invalidate
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send notification");
    }
  });

  const handleCreateNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee || !notifTitle || !notifMessage) {
      toast.error("Please fill all fields");
      return;
    }
    createNotifMutation.mutate({
      employee_id: targetEmployee,
      title: notifTitle,
      message: notifMessage,
      type: notifType,
    });
  };

  const markAllAsRead = () => {
    markAllMutation.mutate();
  };

  const markAsRead = (id: string) => {
    markReadMutation.mutate(id);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-warning" />;
      case "info":
      default: return <Info className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <AppShell title="Notifications">
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        
        {/* Admin Panel */}
        {employee?.role === "Admin" && (
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                Admin: Employee Controls
              </CardTitle>
              <CardDescription>Create notifications and manage employee permissions.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateNotification} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Employee</Label>
                    <Select value={targetEmployee} onValueChange={setTargetEmployee} required>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Choose an employee..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.employee_id} value={emp.employee_id}>
                            {emp.full_name} ({emp.employee_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {targetEmployee && (
                      <div className="mt-4 p-3 bg-background border rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Increase Sign-in Time</p>
                          <p className="text-xs text-muted-foreground">Allow employee to sign in after 10:00 AM today</p>
                        </div>
                        <Select 
                          value={employees.find(e => e.employee_id === targetEmployee)?.allow_late_signin ? "yes" : "no"}
                          onValueChange={async (val) => {
                            const allow = val === "yes";
                            try {
                              const { apiToggleLateSignin } = await import("@/lib/api");
                              await apiToggleLateSignin(targetEmployee, allow);
                              toast.success(`Late sign-in ${allow ? "allowed" : "disabled"} for employee`);
                              queryClient.invalidateQueries({ queryKey: ["employees"] });
                            } catch (err: any) {
                              toast.error(err.message || "Failed to update sign-in time");
                            }
                          }}
                        >
                          <SelectTrigger className="w-[80px] bg-background">
                            <SelectValue placeholder="No" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Notification Type</Label>
                    <Select value={notifType} onValueChange={setNotifType} required>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Information (Blue)</SelectItem>
                        <SelectItem value="success">Success (Green)</SelectItem>
                        <SelectItem value="warning">Warning (Orange)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input 
                    placeholder="e.g. System Update Complete" 
                    value={notifTitle} 
                    onChange={e => setNotifTitle(e.target.value)} 
                    required 
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea 
                    placeholder="Enter the notification details here..." 
                    value={notifMessage} 
                    onChange={e => setNotifMessage(e.target.value)} 
                    required 
                    className="bg-background min-h-[100px]"
                  />
                </div>

                <Button type="submit" disabled={createNotifMutation.isPending} className="w-full md:w-auto">
                  {createNotifMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Notification
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Notifications List */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" />
              Your Notifications
            </h2>
            <p className="text-muted-foreground mt-1">
              Stay updated on system announcements and website features.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={markAllAsRead} 
              disabled={markAllMutation.isPending}
              className="shrink-0 bg-background"
            >
              {markAllMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Mark all as read
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {isLoading ? (
             <div className="flex justify-center p-8">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`p-5 transition-all ${!notification.read ? 'bg-primary/5 border-primary/20 shadow-md' : 'bg-background shadow-sm'} relative overflow-hidden group`}
            >
              {!notification.read && (
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              )}
              <div className="flex gap-4">
                <div className={`mt-1 shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${!notification.read ? 'bg-white' : 'bg-muted'}`}>
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className={`font-semibold ${!notification.read ? 'text-foreground' : 'text-foreground/80'}`}>
                      {notification.title}
                    </h3>
                    <div className="flex items-center text-xs text-muted-foreground shrink-0 mt-0.5">
                      <Clock className="w-3 h-3 mr-1" />
                      {format(new Date(notification.created_at), "MMM d, h:mm a")}
                    </div>
                  </div>
                  <p className={`text-sm ${!notification.read ? 'text-foreground/90' : 'text-muted-foreground'}`}>
                    {notification.message}
                  </p>
                  
                  {!notification.read && (
                    <button 
                      onClick={() => markAsRead(notification.id)}
                      disabled={markReadMutation.isPending}
                      className="mt-3 text-xs font-medium text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 disabled:opacity-50"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          
          {!isLoading && notifications.length === 0 && (
            <div className="text-center py-20 bg-muted/20 border border-dashed rounded-xl">
              <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-semibold text-lg text-muted-foreground">No notifications</h3>
              <p className="text-sm text-muted-foreground mt-1">You're all caught up!</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
