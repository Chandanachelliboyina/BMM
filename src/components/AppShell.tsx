import { type ReactNode, useEffect, useState, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useEmployee } from "@/hooks/useEmployee";
import { format } from "date-fns";
import { MapPin, Clock, User } from "lucide-react";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { employee } = useEmployee();
  const [now, setNow] = useState(new Date());
  const [locationStr, setLocationStr] = useState<string>("Fetching location...");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStr("Location not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocationStr(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        try {
          const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
          const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`);
          if (r.ok) {
            const j = await r.json();
            if (j?.results?.[0]?.formatted_address) {
              // Just use a shorter version of the address to fit in the header
              const addressTokens = j.results[0].formatted_address.split(',');
              setLocationStr(addressTokens.slice(0, 2).join(','));
            }
          }
        } catch { /* ignore */ }
      },
      () => {
        setLocationStr("Location unavailable");
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    captureLocation();
    // Refresh location every 5 mins
    const interval = setInterval(captureLocation, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [captureLocation]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-secondary/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <header className="h-14 border-b bg-background/80 backdrop-blur flex items-center justify-between px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="font-semibold hidden sm:block">{title}</h1>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground mr-2 whitespace-nowrap overflow-hidden">
              {employee && (
                <div className="hidden lg:flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span className="font-medium text-foreground">{employee.full_name}</span>
                </div>
              )}
              <div className="hidden md:flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[200px]" title={locationStr}>{locationStr}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono shrink-0">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground">{format(now, "dd MMM yyyy, hh:mm:ss a")}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
