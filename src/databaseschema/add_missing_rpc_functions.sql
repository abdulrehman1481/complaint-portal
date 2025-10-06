-- Add missing RPC functions needed by ComplaintDetail.js

-- Function for simple status updates
CREATE OR REPLACE FUNCTION public.simple_update_complaint_status(
  complaint_id_param INTEGER,
  new_status_param TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.complaints 
  SET status = new_status_param, updated_at = NOW()
  WHERE id = complaint_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function for safe complaint updates with assignment
CREATE OR REPLACE FUNCTION public.safe_update_complaint(
  complaint_id_param INTEGER,
  assigned_to_param UUID DEFAULT NULL,
  status_param TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.complaints 
  SET 
    assigned_to = COALESCE(assigned_to_param, assigned_to),
    status = COALESCE(status_param, status),
    updated_at = NOW()
  WHERE id = complaint_id_param;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.simple_update_complaint_status(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_update_complaint(INTEGER, UUID, TEXT) TO authenticated;