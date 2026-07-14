import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Building2, LayoutDashboard, User, CalendarCheck, ClipboardList, Activity, CalendarDays, BarChart3, Bell, Settings, LogOut } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Profile", url: "/profile", icon: User },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck },
  { title: "Attendance History", url: "/history", icon: ClipboardList },
  { title: "Daily Updates", url: "/updates", icon: ClipboardList },
  { title: "Activities", url: "/activities", icon: Activity },
  { title: "Leave Management", url: "/leaves", icon: CalendarDays },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  

  const signOut = async () => {
    // Route to the logout selfie flow; that page handles actual sign-out.
    navigate({ to: "/logout" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-0.5">
            <img src="/logo.png" alt="BMM Logo" className="w-full h-full object-cover rounded-lg" />
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="font-semibold text-sm leading-tight truncate">Bheemabhai Mahila Mandali</p>
              <p className="text-xs text-muted-foreground">BMM · Employee Portal</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Log out">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Log out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
