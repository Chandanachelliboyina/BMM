
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
