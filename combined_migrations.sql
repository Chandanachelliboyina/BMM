
-- Sequence + function to generate employee IDs like NGO001
CREATE SEQUENCE IF NOT EXISTS public.employee_id_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num BIGINT;
BEGIN
  next_num := nextval('public.employee_id_seq');
  RETURN 'NGO' || lpad(next_num::text, 3, '0');
END;
$$;

-- Employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  address TEXT,
  village TEXT,
  mandal TEXT,
  district TEXT,
  state TEXT,
  pin_code TEXT,
  gender TEXT,
  date_of_birth DATE,
  role TEXT NOT NULL,
  department TEXT,
  joining_date DATE,
  office_location TEXT,
  profile_photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT ON public.employees TO anon; -- allow employee_id -> email lookup at login
GRANT ALL ON public.employees TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Anon can look up email by employee_id for sign-in (returns only own row after auth; broader for anon)
CREATE POLICY "Public can lookup for login" ON public.employees
  FOR SELECT TO anon USING (true);

CREATE POLICY "Employees can view own profile" ON public.employees
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Employees can insert own profile" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Employees can update own profile" ON public.employees
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  role TEXT NOT NULL,
  selfie_image TEXT,
  login_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  login_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  gps_latitude NUMERIC(10, 7),
  gps_longitude NUMERIC(10, 7),
  full_address TEXT,
  attendance_status TEXT NOT NULL DEFAULT 'Present',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, login_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own attendance" ON public.attendance
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Employees can insert own attendance" ON public.attendance
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for the two buckets (buckets created via tool separately)
CREATE POLICY "Users can read own profile photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can read profile photos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload own profile photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own profile photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own selfies" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attendance-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own selfies" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attendance-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Remove callable SECURITY DEFINER function; use trigger instead
REVOKE ALL ON FUNCTION public.generate_employee_id() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.generate_employee_id();

CREATE OR REPLACE FUNCTION public.assign_employee_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    NEW.employee_id := 'NGO' || lpad(nextval('public.employee_id_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_employee_id
BEFORE INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.assign_employee_id();

-- Remove overly broad anon SELECT
DROP POLICY IF EXISTS "Public can lookup for login" ON public.employees;
REVOKE SELECT ON public.employees FROM anon;

-- Narrow lookup function: only returns the login email for a given employee_id
CREATE OR REPLACE FUNCTION public.get_login_email(p_employee_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.employees WHERE employee_id = p_employee_id LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_email(TEXT) TO anon, authenticated;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS logout_time timestamptz,
  ADD COLUMN IF NOT EXISTS logout_selfie text;

CREATE POLICY "Employees can update own attendance"
  ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS logout_gps_latitude NUMERIC(10, 7), ADD COLUMN IF NOT EXISTS logout_gps_longitude NUMERIC(10, 7), ADD COLUMN IF NOT EXISTS logout_full_address TEXT;
