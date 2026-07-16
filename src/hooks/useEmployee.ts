import { useEffect, useState, useCallback } from "react";
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

export function useEmployee() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const emp = await apiMe();
    setEmployee(emp);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // profile photo is now a base64 data URL stored directly on the employee object
  const photoUrl = employee?.profile_photo_b64 ?? null;

  return { employee, photoUrl, loading, refresh };
}
