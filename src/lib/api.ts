// Central API client — points to FastAPI backend
// In production (Vercel): same domain — /api/* is routed to Python backend by vercel.json
// In local dev: uses localhost:8000
export const BASE_URL = import.meta.env.PROD
  ? ""
  : (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

const TOKEN_KEY = "bmm_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch (networkErr: any) {
    // TypeError: Failed to fetch  →  backend is not reachable
    const isDevMode = !import.meta.env.PROD;
    const friendlyMsg = isDevMode
      ? "Cannot reach the backend server. Make sure the Python backend is running on port 8000 (run: cd backend && uvicorn app:app --reload)."
      : "Service is temporarily unavailable. Please try again in a moment.";
    throw new Error(friendlyMsg);
  }

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
    throw new Error("Session expired. Please sign in again.");
  }

  if (!res.ok) {
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    throw new Error(body?.detail || `Request failed: ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  employee_id: string;
}

export interface RegisterResponse {
  employee_id: string;
  token: string;
  message: string;
}

export async function apiLogin(employeeId: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ employee_id: employeeId, password }),
  });
}

export async function apiRegister(payload: Record<string, unknown>): Promise<RegisterResponse> {
  return request<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiMe(): Promise<Employee | null> {
  if (!getToken()) return null;
  try {
    return await request<Employee>("/api/auth/me");
  } catch {
    return null;
  }
}

// ── Employee ──────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  mobile_number: string;
  email: string;
  role: string;
  address?: string | null;
  village?: string | null;
  mandal?: string | null;
  district?: string | null;
  state?: string | null;
  pin_code?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  office_location?: string | null;
  department?: string | null;
  head?: string | null;
  donor_name?: string | null;
  target_villages?: string | null;
  target_mandals?: string | null;
  targets?: string | null;
  profile_photo_b64?: string | null;
  joining_date?: string | null;
  allow_late_signin?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function apiUpdateProfile(data: Partial<Employee>): Promise<Employee> {
  return request<Employee>("/api/employees/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiUpdatePhoto(file: File): Promise<{ profile_photo_b64: string }> {
  const token = getToken();
  const form = new FormData();
  form.append("photo", file);
  const res = await fetch(`${BASE_URL}/api/employees/me/photo`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || "Photo upload failed");
  }
  return res.json();
}

export async function apiRegisterWithPhoto(payload: Record<string, unknown>, photoFile: File | null): Promise<RegisterResponse> {
  // Convert photo to base64 and send as JSON
  if (photoFile) {
    const b64 = await fileToBase64(photoFile);
    payload = { ...payload, profile_photo_b64: b64 };
  }
  return apiRegister(payload);
}

export async function apiEmployeeCount(): Promise<number> {
  const res = await request<{ count: number }>("/api/employees/count");
  return res.count;
}

// ── Attendance ────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  role: string;
  login_date: string;
  login_time: string;
  gps_latitude?: number;
  gps_longitude?: number;
  full_address?: string;
  selfie_b64?: string | null;
  logout_time?: string | null;
  logout_selfie_b64?: string | null;
  logout_gps_latitude?: number | null;
  logout_gps_longitude?: number | null;
  logout_full_address?: string | null;
  attendance_status: string;
  created_at?: string;
}

export async function apiCheckin(data: {
  employee_name: string;
  role: string;
  gps_latitude: number;
  gps_longitude: number;
  full_address?: string;
  selfieBlob?: Blob | null;
}): Promise<{ id: string; login_time: string }> {
  let selfie_b64: string | null = null;
  if (data.selfieBlob) selfie_b64 = await blobToBase64(data.selfieBlob);
  return request("/api/attendance/checkin", {
    method: "POST",
    body: JSON.stringify({
      employee_name: data.employee_name,
      role: data.role,
      gps_latitude: data.gps_latitude,
      gps_longitude: data.gps_longitude,
      full_address: data.full_address,
      selfie_b64,
    }),
  });
}

export async function apiCheckout(data: {
  gps_latitude: number;
  gps_longitude: number;
  full_address?: string;
  selfieBlob?: Blob | null;
}): Promise<{ logout_time: string }> {
  let selfie_b64: string | null = null;
  if (data.selfieBlob) selfie_b64 = await blobToBase64(data.selfieBlob);
  return request("/api/attendance/checkout", {
    method: "PUT",
    body: JSON.stringify({
      gps_latitude: data.gps_latitude,
      gps_longitude: data.gps_longitude,
      full_address: data.full_address,
      selfie_b64,
    }),
  });
}

export async function apiAttendanceToday(): Promise<AttendanceRecord | null> {
  return request<AttendanceRecord | null>("/api/attendance/today");
}

export async function apiAttendanceHistory(): Promise<AttendanceRecord[]> {
  return request<AttendanceRecord[]>("/api/attendance/history");
}

// ── Employees Admin ─────────────────────────────────────────────────────────────

export async function apiGetEmployees(): Promise<Employee[]> {
  return request<Employee[]>("/api/employees");
}

export async function apiToggleLateSignin(employeeId: string, allow: boolean): Promise<{ message: string; allow_late_signin: boolean }> {
  return request<{ message: string; allow_late_signin: boolean }>(`/api/employees/${employeeId}/allow-late-signin`, {
    method: "PUT",
    body: JSON.stringify({ allow_late_signin: allow }),
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface DBNotification {
  id: string;
  employee_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning";
  read: boolean;
  created_at: string;
}

export async function apiCreateNotification(data: { employee_id: string; title: string; message: string; type: string }): Promise<{ id: string }> {
  return request<{ id: string }>("/api/notifications", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiGetNotifications(): Promise<DBNotification[]> {
  return request<DBNotification[]>("/api/notifications");
}

export async function apiMarkNotificationRead(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/notifications/${id}/read`, {
    method: "PUT",
  });
}

export async function apiMarkAllNotificationsRead(): Promise<{ message: string }> {
  return request<{ message: string }>("/api/notifications/read-all", {
    method: "PUT",
  });
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fileToBase64(file: File): Promise<string> {
  return blobToBase64(file);
}
