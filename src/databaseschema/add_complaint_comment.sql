INSERT INTO public.complaint_comments (
  complaint_id,
  user_id,
  content,
  is_internal,
  is_system,
  created_at
) VALUES (
  <complaint_id>,        -- e.g. 6
  '<user_uuid>',         -- e.g. '123e4567-e89b-12d3-a456-426614174000'
  '<your comment here>', -- e.g. 'Investigating the issue.'
  false,                 -- set to true if internal-only
  false,                 -- set to true if system-generated
  NOW()
)
RETURNING *;
