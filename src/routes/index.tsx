import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getToken } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (getToken()) navigate({ to: "/attendance", replace: true });
    else navigate({ to: "/auth/login", replace: true });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero">
      <div className="text-primary-foreground text-lg font-medium">Loading Bheemabhai Mahila Mandali…</div>
    </div>
  );
}
