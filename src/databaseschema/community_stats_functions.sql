-- Function to get complaint statistics by category for community dashboard
CREATE OR REPLACE FUNCTION public.get_complaints_by_category(limit_count INTEGER DEFAULT NULL)
RETURNS TABLE (
  category_id INTEGER,
  category_name TEXT,
  category_icon TEXT,
  complaint_count BIGINT,
  open_count BIGINT,
  in_progress_count BIGINT,
  resolved_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cat.id as category_id,
    cat.name as category_name,
    cat.icon as category_icon,
    COUNT(c.id) as complaint_count,
    COUNT(c.id) FILTER (WHERE c.status = 'open') as open_count,
    COUNT(c.id) FILTER (WHERE c.status = 'in_progress') as in_progress_count,
    COUNT(c.id) FILTER (WHERE c.status = 'resolved') as resolved_count
  FROM public.categories cat
  LEFT JOIN public.complaints c ON cat.id = c.category_id
  WHERE cat.is_active = true
  GROUP BY cat.id, cat.name, cat.icon
  HAVING COUNT(c.id) > 0
  ORDER BY COUNT(c.id) DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get nearby complaints for regular users based on location
CREATE OR REPLACE FUNCTION public.get_nearby_complaints_for_users(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 10
)
RETURNS TABLE (
  id INTEGER,
  title TEXT,
  description TEXT,
  status complaint_status,
  created_at TIMESTAMP WITH TIME ZONE,
  location GEOGRAPHY(POINT, 4326),
  distance FLOAT,
  category_name TEXT,
  category_icon TEXT,
  severity_level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.description,
    c.status,
    c.created_at,
    c.location,
    ST_Distance(
      c.location::GEOMETRY,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::GEOMETRY
    ) AS distance,
    cat.name as category_name,
    cat.icon as category_icon,
    cat.severity_level
  FROM public.complaints c
  LEFT JOIN public.categories cat ON c.category_id = cat.id
  WHERE ST_DWithin(
    c.location::GEOMETRY,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::GEOMETRY,
    radius_km * 1000 -- Convert km to meters
  )
  AND c.anonymous = false -- Only show non-anonymous complaints to community
  ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_complaints_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_complaints_for_users TO authenticated;
