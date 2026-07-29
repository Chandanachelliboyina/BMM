import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { apiMe, getToken, type Employee } from "@/lib/api";

export type { Employee };

export function useSession() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setEmployeeId(null);
      setLoading(false);
      return;
    }
    apiMe().then((emp) => {
      setEmployeeId(emp?.employee_id ?? null);
      setLoading(false);
    });
  }, []);

  return { employeeId, loading };
}

interface EmployeeContextType {
  employee: Employee | null;
  photoUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EmployeeContext = createContext<EmployeeContextType>({
  employee: null,
  photoUrl: null,
  loading: true,
  refresh: async () => {},
});

let globalCache: Employee | null = null;

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(globalCache);
  const [loading, setLoading] = useState<boolean>(!globalCache);

  const refresh = useCallback(async () => {
    if (!globalCache) setLoading(true);
    const emp = await apiMe();
    globalCache = emp;
    setEmployee((prev) => (JSON.stringify(prev) === JSON.stringify(emp) ? prev : emp));
    setLoading(false);
  }, []);

  const refreshSilent = useCallback(async () => {
    const emp = await apiMe();
    if (emp) {
      globalCache = emp;
      setEmployee((prev) => (JSON.stringify(prev) === JSON.stringify(emp) ? prev : emp));
    }
  }, []);

  useEffect(() => {
    refresh();

    // Poll every 15 seconds to automatically pick up admin approval
    const timer = setInterval(() => {
      refreshSilent();
    }, 15000);

    return () => clearInterval(timer);
  }, [refresh, refreshSilent]);

  const photoUrl = employee?.profile_photo_b64 ?? null;

  return (
    <EmployeeContext.Provider value={{ employee, photoUrl, loading, refresh }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployee() {
  const ctx = useContext(EmployeeContext);
  // Fallback in case used outside of EmployeeProvider
  if (!ctx) {
    return { employee: globalCache, photoUrl: globalCache?.profile_photo_b64 ?? null, loading: false, refresh: async () => {} };
  }
  return ctx;
}
