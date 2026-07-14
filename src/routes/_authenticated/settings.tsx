import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Settings, Shield, Bell, Lock, HelpCircle, ChevronRight, Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/ThemeProvider";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — BMM" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [resetting, setResetting] = useState(false);

  const handlePasswordReset = async () => {
    setResetting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No email found for this user");
      
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin + "/auth/reset-password",
      });
      
      if (error) throw error;
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reset email");
    } finally {
      setResetting(false);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Account Settings
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage your app preferences, security, and notifications.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column: Navigation/Sections */}
          <div className="md:col-span-1 space-y-2">
            <Card className="overflow-hidden sticky top-24">
              <div className="p-1 flex flex-col">
                <Button variant="ghost" onClick={() => document.getElementById('appearance')?.scrollIntoView({behavior: 'smooth'})} className="justify-start px-4 h-12 text-muted-foreground hover:text-foreground">
                  <Monitor className="w-4 h-4 mr-3" /> Appearance
                  <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                </Button>
                <Button variant="ghost" onClick={() => document.getElementById('notifications')?.scrollIntoView({behavior: 'smooth'})} className="justify-start px-4 h-12 text-muted-foreground hover:text-foreground">
                  <Bell className="w-4 h-4 mr-3" /> Notifications
                  <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                </Button>
                <Button variant="ghost" onClick={() => document.getElementById('security')?.scrollIntoView({behavior: 'smooth'})} className="justify-start px-4 h-12 text-muted-foreground hover:text-foreground">
                  <Shield className="w-4 h-4 mr-3" /> Security
                  <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column: Content */}
          <div className="md:col-span-2 space-y-6 pb-20">
            
            {/* Preferences */}
            <Card id="appearance" className="p-6 shadow-card scroll-mt-24">
              <h3 className="text-lg font-semibold mb-4">Appearance</h3>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setTheme("light")}
                  className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/30'}`}
                >
                  <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium text-sm">Light</span>
                </button>
                <button 
                  onClick={() => setTheme("dark")}
                  className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/30'}`}
                >
                  <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium text-sm">Dark</span>
                </button>
                <button 
                  onClick={() => setTheme("system")}
                  className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${theme === 'system' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/30'}`}
                >
                  <Monitor className={`w-6 h-6 ${theme === 'system' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium text-sm">System</span>
                </button>
              </div>
            </Card>

            {/* Notifications */}
            <Card id="notifications" className="p-6 shadow-card space-y-6 scroll-mt-24">
              <div>
                <h3 className="text-lg font-semibold mb-1">Notification Preferences</h3>
                <p className="text-sm text-muted-foreground mb-6">Choose how you want to be notified about updates.</p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive alerts directly on your device.</p>
                </div>
                <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} />
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive weekly summaries via email.</p>
                </div>
                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
              </div>
            </Card>

            {/* Security */}
            <Card id="security" className="p-6 shadow-card border-l-4 border-l-primary scroll-mt-24">
              <h3 className="text-lg font-semibold mb-1">Security Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">Manage your password and account security.</p>
              
              <div className="bg-secondary/50 p-4 rounded-lg flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Password Reset</p>
                    <p className="text-xs text-muted-foreground">Send a secure reset link to your email.</p>
                  </div>
                </div>
                <Button variant="outline" onClick={handlePasswordReset} disabled={resetting}>
                  {resetting ? "Sending..." : "Reset Password"}
                </Button>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
