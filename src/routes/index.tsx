import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Shield, Clock, Heart } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getToken());
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-primary/20">
      {/* Navigation */}
      <nav className="w-full border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
              B
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">
              Bheemabhai Mahila Mandali
            </span>
          </div>
          <div>
            {isLoggedIn ? (
              <Link to="/attendance">
                <Button className="rounded-full px-6 shadow-sm hover:shadow-md transition-all">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/auth/login">
                <Button className="rounded-full px-6 shadow-sm hover:shadow-md transition-all">
                  Employee Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="relative overflow-hidden bg-white">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1593113630400-ea4288922497?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center opacity-5" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-4">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
                Empowering Communities
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Driving Change, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-600">
                  Uplifting Lives.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Bheemabhai Mahila Mandali is dedicated to the social and economic empowerment of women. Our internal platform helps us manage our operations efficiently to focus on what matters most.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                {isLoggedIn ? (
                  <Link to="/attendance" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto rounded-full text-base h-14 px-8 shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                      Access Dashboard
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                ) : (
                  <Link to="/auth/login" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto rounded-full text-base h-14 px-8 shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                      Staff Portal Login
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900">Platform Capabilities</h2>
              <p className="mt-4 text-slate-600 max-w-2xl mx-auto">Designed to streamline internal operations and improve field management.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-6">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Real-time Attendance</h3>
                <p className="text-slate-600 leading-relaxed">Location-based check-ins and check-outs with seamless selfie verification for field staff.</p>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Team Management</h3>
                <p className="text-slate-600 leading-relaxed">Comprehensive tracking of employee leaves, activities, and daily performance metrics.</p>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-6">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Secure Operations</h3>
                <p className="text-slate-600 leading-relaxed">Role-based access control ensuring sensitive organizational data remains protected.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            <span className="font-semibold text-slate-900">Bheemabhai Mahila Mandali</span>
          </div>
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} Bheemabhai Mahila Mandali. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
