import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getToken, apiMe } from "@/lib/api";
import { EmployeeProvider } from "@/hooks/useEmployee";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = getToken();
    if (!token) throw redirect({ to: "/auth/login" });
    const user = await apiMe();
    if (!user) throw redirect({ to: "/auth/login" });
    return { user };
  },
  component: () => (
    <EmployeeProvider>
      <Outlet />
    </EmployeeProvider>
  ),
});
