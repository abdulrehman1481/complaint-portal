-- Insert categories without requiring departments
-- Insert statement will skip categories that already exist (using ON CONFLICT)

-- Infrastructure Categories
INSERT INTO public.categories (name, icon, severity_level, response_time, is_active)
VALUES
  ('Pothole Repair', '🚧', 3, '7 days', true),
  ('Road Damage', '🛣️', 4, '14 days', true),
  ('Street Light Fault', '💡', 2, '3 days', true),
  ('Traffic Signal Malfunction', '🚦', 5, '12 hours', true),
  ('Sidewalk Damage', '🚶', 3, '10 days', true),
  ('Bridge Safety Issue', '🌉', 5, '24 hours', true)
ON CONFLICT (name) DO NOTHING;

-- Sanitation Categories
INSERT INTO public.categories (name, icon, severity_level, response_time, is_active)
VALUES
  ('Garbage Collection', '🗑️', 2, '2 days', true),
  ('Illegal Dumping', '🚯', 3, '5 days', true),
  ('Sewage Issue', '🦠', 5, '1 day', true),
  ('Public Toilet Problem', '🚻', 4, '2 days', true),
  ('Pest Control', '🐀', 3, '4 days', true)
ON CONFLICT (name) DO NOTHING;

-- Water & Utilities Categories
INSERT INTO public.categories (name, icon, severity_level, response_time, is_active)
VALUES
  ('Water Leakage', '🚰', 4, '1 day', true),
  ('Water Quality', '💧', 5, '12 hours', true),
  ('Power Outage', '⚡', 5, '6 hours', true),
  ('Gas Leak', '🔥', 5, '1 hour', true),
  ('Drainage Problem', '🌊', 4, '2 days', true)
ON CONFLICT (name) DO NOTHING;

-- Public Safety Categories
INSERT INTO public.categories (name, icon, severity_level, response_time, is_active)
VALUES
  ('Public Safety Hazard', '🚨', 5, '24 hours', true),
  ('Abandoned Vehicle', '🚗', 2, '7 days', true),
  ('Vandalism', '🖌️', 3, '5 days', true),
  ('Noise Complaint', '📢', 2, '3 days', true),
  ('Suspicious Activity', '👁️', 4, '48 hours', true)
ON CONFLICT (name) DO NOTHING;

-- Parks & Public Spaces
INSERT INTO public.categories (name, icon, severity_level, response_time, is_active)
VALUES
  ('Park Maintenance', '🌳', 2, '7 days', true),
  ('Playground Safety', '🧒', 4, '2 days', true),
  ('Public Bench Damage', '💺', 2, '10 days', true),
  ('Graffiti Removal', '🎨', 2, '10 days', true),
  ('Tree Fallen/Hazard', '🌲', 4, '2 days', true)
ON CONFLICT (name) DO NOTHING;

-- To see if the insertions were successful
SELECT id, name, icon, severity_level, response_time, is_active FROM public.categories ORDER BY id;
