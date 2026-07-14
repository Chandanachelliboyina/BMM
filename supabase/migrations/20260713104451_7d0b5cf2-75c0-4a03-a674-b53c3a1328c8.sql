
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
