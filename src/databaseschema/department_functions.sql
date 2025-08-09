-- Helper function to get department complaint counts
CREATE OR REPLACE FUNCTION public.get_department_complaint_counts()
RETURNS TABLE (
  department_id INTEGER,
  department_name TEXT,
  total_complaints BIGINT,
  open_complaints BIGINT,
  in_progress_complaints BIGINT,
  resolved_complaints BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as department_id,
    d.name as department_name,
    COUNT(c.id) as total_complaints,
    COUNT(c.id) FILTER (WHERE c.status = 'open') as open_complaints,
    COUNT(c.id) FILTER (WHERE c.status = 'in_progress') as in_progress_complaints,
    COUNT(c.id) FILTER (WHERE c.status = 'resolved') as resolved_complaints
  FROM public.departments d
  LEFT JOIN public.complaints c ON d.id = c.department_id
  GROUP BY d.id, d.name
  ORDER BY d.name;
END;
$$ LANGUAGE plpgsql;

-- Function to get complaints by department with pagination
CREATE OR REPLACE FUNCTION public.get_department_complaints(
  dept_id INTEGER,
  page_size INTEGER DEFAULT 10,
  page_offset INTEGER DEFAULT 0,
  status_filter TEXT DEFAULT NULL,
  category_filter INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  title TEXT,
  description TEXT,
  status complaint_status,
  category_name TEXT,
  reporter_name TEXT,
  assigned_agent_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  location GEOGRAPHY(POINT, 4326),
  priority INTEGER,
  images TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.description,
    c.status,
    cat.name as category_name,
    CONCAT(reporter.first_name, ' ', reporter.last_name) as reporter_name,
    CONCAT(agent.first_name, ' ', agent.last_name) as assigned_agent_name,
    c.created_at,
    c.updated_at,
    c.location,
    c.priority,
    c.images
  FROM public.complaints c
  LEFT JOIN public.categories cat ON c.category_id = cat.id
  LEFT JOIN public.users reporter ON c.reported_by = reporter.id
  LEFT JOIN public.users agent ON c.assigned_to = agent.id
  WHERE c.department_id = dept_id
    AND (status_filter IS NULL OR c.status::TEXT = status_filter)
    AND (category_filter IS NULL OR c.category_id = category_filter)
  ORDER BY c.created_at DESC
  LIMIT page_size
  OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get field agents for a department
CREATE OR REPLACE FUNCTION public.get_department_field_agents(dept_id INTEGER)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone_number TEXT,
  official_position TEXT,
  last_active TIMESTAMP WITH TIME ZONE,
  assigned_complaints_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.first_name,
    u.last_name,
    au.email,
    u.phone_number,
    u.official_position,
    u.last_active,
    COUNT(c.id) as assigned_complaints_count
  FROM public.users u
  JOIN auth.users au ON u.id = au.id
  LEFT JOIN public.complaints c ON u.id = c.assigned_to AND c.status != 'resolved'
  JOIN public.roles r ON u.role_id = r.id
  WHERE u.department_id = dept_id 
    AND r.name = 'Field Agent'
  GROUP BY u.id, au.email
  ORDER BY u.first_name, u.last_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get categories for a department
CREATE OR REPLACE FUNCTION public.get_department_categories(dept_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  icon TEXT,
  severity_level INTEGER,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.icon,
    c.severity_level,
    c.is_active
  FROM public.categories c
  JOIN public.department_categories dc ON c.id = dc.category_id
  WHERE dc.department_id = dept_id
    AND c.is_active = true
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_department_complaint_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_department_complaints(INTEGER, INTEGER, INTEGER, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_department_field_agents(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_department_categories(INTEGER) TO authenticated;
