-- Function to get nearby complaints for Field Agents
CREATE OR REPLACE FUNCTION public.get_nearby_complaints(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 5
)
RETURNS TABLE (
  id INTEGER,
  title TEXT,
  description TEXT,
  status complaint_status,
  created_at TIMESTAMP WITH TIME ZONE,
  location GEOGRAPHY(POINT, 4326),
  distance FLOAT,
  categories JSON,
  users JSON
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
    row_to_json(cat.*) AS categories,
    row_to_json(reporter.*) AS users
  FROM public.complaints c
  LEFT JOIN public.categories cat ON c.category_id = cat.id
  LEFT JOIN public.users reporter ON c.reported_by = reporter.id
  WHERE ST_DWithin(
    c.location::GEOMETRY,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::GEOMETRY,
    radius_km * 1000 -- Convert km to meters
  )
  AND c.status != 'resolved'
  ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_nearby_complaints TO authenticated;
