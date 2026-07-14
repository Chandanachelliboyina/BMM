
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS logout_time timestamptz,
  ADD COLUMN IF NOT EXISTS logout_selfie text;

CREATE POLICY "Employees can update own attendance"
  ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
