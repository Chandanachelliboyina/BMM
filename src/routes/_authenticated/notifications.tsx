import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Bell, CheckCircle2, AlertTriangle, Info, Clock, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { format, subDays, subHours, subMinutes } from "date-fns";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — BMM" }] }),
  component: NotificationsPage,
});

type Notification = {
  id: string;
  type: "success" | "warning" | "info";
  title: string;
  message: string;
  time: Date;
  read: boolean;
};

// Mock data for system notifications about the website
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "success",
    title: "System Update Complete",
    message: "The new Daily Updates and Face Verification features are now fully live and operational.",
    time: subMinutes(new Date(), 45),
    read: false,
  },
  {
    id: "2",
    type: "info",
    title: "Profile Edit Feature Added",
    message: "You can now edit your profile information securely by using the new 'Edit Profile' button on the My Profile page.",
    time: subHours(new Date(), 2),
    read: false,
  },
  {
    id: "3",
    type: "warning",
    title: "Location Services Required",
    message: "Remember that you must allow location access on your device for attendance marking to work correctly.",
    time: subDays(new Date(), 1),
    read: true,
  },
  {
    id: "4",
    type: "info",
    title: "Welcome to BMM Employee Portal",
    message: "Welcome to the newly redesigned employee portal! Feel free to explore the dashboard and features.",
    time: subDays(new Date(), 3),
    read: true,
  }
];

function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success": return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-warning" />;
      case "info": return <Info className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <AppShell title="Notifications">
      <div className="max-w-3xl mx-auto space-y-6">
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
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="shrink-0 bg-background">
              <Check className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {notifications.map((notification) => (
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
                      {format(notification.time, "MMM d, h:mm a")}
                    </div>
                  </div>
                  <p className={`text-sm ${!notification.read ? 'text-foreground/90' : 'text-muted-foreground'}`}>
                    {notification.message}
                  </p>
                  
                  {!notification.read && (
                    <button 
                      onClick={() => markAsRead(notification.id)}
                      className="mt-3 text-xs font-medium text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          
          {notifications.length === 0 && (
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
