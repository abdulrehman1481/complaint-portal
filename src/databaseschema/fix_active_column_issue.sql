-- Fix for "column active does not exist" error
-- This script fixes database functions that incorrectly reference the 'active' column

-- Drop and recreate the log_complaint_status_change function
DROP FUNCTION IF EXISTS public.log_complaint_status_change() CASCADE;

CREATE OR REPLACE FUNCTION public.log_complaint_status_change()
RETURNS TRIGGER AS $$
BEGIN
  if old.status != new.status then
    insert into public.complaint_history (
      complaint_id,
      status,
      changed_by
    ) values (
      new.id,
      new.status,
      auth.uid()  -- Removed the problematic WHERE clause
    );
  end if;
  return new;
end;
$$ language plpgsql;

-- Recreate the trigger
CREATE TRIGGER log_complaint_status_change
AFTER UPDATE OF status ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.log_complaint_status_change();

-- Drop and recreate the log_activity function
DROP FUNCTION IF EXISTS public.log_activity(text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.log_activity(
  action_type text,
  entity_type text,
  entity_id text,
  details jsonb default null
)
RETURNS VOID AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current user ID directly
  current_user_id := auth.uid();
  
  INSERT INTO public.activity_logs (
    user_id,
    action_type,
    entity_type,
    entity_id,
    details,
    ip_address
  ) VALUES (
    current_user_id,
    action_type,
    entity_type,
    entity_id,
    details,
    NULL  -- IP address handling can be added later if needed
  );
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_complaint_status_change() TO authenticated;