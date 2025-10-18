-- ========================================
-- PAKISTAN COMPLAINTS UPDATE
-- ========================================
-- Updates existing complaints with Pakistani coordinates (Islamabad/Rawalpindi)
-- and adds additional complaints with proper Pakistani locations
-- 
-- Coordinates are centered around:
-- Islamabad: 33.6844, 73.0479
-- Rawalpindi: 33.5651, 73.0169
-- ========================================

-- ========================================
-- UPDATE EXISTING COMPLAINTS WITH PAKISTANI COORDINATES
-- ========================================
-- Update existing complaints to use Pakistani coordinates

-- Get existing complaint IDs and update them with Pakistani locations
DO $$
DECLARE
    complaint_record RECORD;
    pak_coordinates POINT[];
    coord_index INTEGER := 1;
BEGIN
    -- Array of Pakistani coordinates (Islamabad and Rawalpindi area)
    pak_coordinates := ARRAY[
        POINT(73.0479, 33.6844),  -- Islamabad center
        POINT(73.0569, 33.6944),  -- Blue Area, Islamabad
        POINT(73.0379, 33.6744),  -- F-7, Islamabad
        POINT(73.0679, 33.6644),  -- G-9, Islamabad
        POINT(73.0279, 33.6944),  -- F-6, Islamabad
        POINT(73.0169, 33.5651),  -- Rawalpindi center
        POINT(73.0269, 33.5751),  -- Saddar, Rawalpindi
        POINT(73.0069, 33.5551),  -- Committee Chowk, Rawalpindi
        POINT(73.0369, 33.5851),  -- Chaklala, Rawalpindi
        POINT(73.0579, 33.6744),  -- G-10, Islamabad
        POINT(73.0779, 33.6544),  -- H-8, Islamabad
        POINT(73.0879, 33.6844),  -- I-8, Islamabad
        POINT(73.0179, 33.5451),  -- Morgah, Rawalpindi
        POINT(73.0479, 33.5951),  -- Bahria Town, Rawalpindi
        POINT(73.0679, 33.6244)   -- G-13, Islamabad
    ];
    
    FOR complaint_record IN 
        SELECT id FROM public.complaints ORDER BY id
    LOOP
        -- Use modulo to cycle through coordinates if we have more complaints than coordinates
        UPDATE public.complaints 
        SET location = ST_SetSRID(ST_MakePoint(pak_coordinates[((coord_index - 1) % array_length(pak_coordinates, 1)) + 1][0], 
                                               pak_coordinates[((coord_index - 1) % array_length(pak_coordinates, 1)) + 1][1]), 4326)::geography
        WHERE id = complaint_record.id;
        
        coord_index := coord_index + 1;
    END LOOP;
END $$;

-- ========================================
-- ADD MORE COMPLAINTS WITH PAKISTANI LOCATIONS
-- ========================================

-- Additional Open Complaints for Pakistan
INSERT INTO public.complaints (title, description, location, status, category_id, department_id, reported_by, priority, created_at) VALUES
  ('Water Supply Issue in F-7 Sector', 'No water supply for the past 3 days in F-7/2 area.', ST_SetSRID(ST_MakePoint(73.0379, 33.6744), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Water Quality'), (SELECT id FROM public.departments WHERE name = 'Water & Sewage'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 3, NOW() - INTERVAL '3 days'),
  
  ('Broken Road in Blue Area', 'Major pothole causing traffic jam near Jinnah Super Market.', ST_SetSRID(ST_MakePoint(73.0569, 33.6944), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Pothole Repair'), (SELECT id FROM public.departments WHERE name = 'Public Works'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 4, NOW() - INTERVAL '5 days'),
  
  ('Street Light Not Working in G-9', 'Multiple street lights are not working in G-9/1 making it unsafe at night.', ST_SetSRID(ST_MakePoint(73.0679, 33.6644), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Street Light Fault'), (SELECT id FROM public.departments WHERE name = 'Electrical Services'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 2, NOW() - INTERVAL '1 week'),
  
  ('Garbage Overflowing in Saddar Rawalpindi', 'Garbage bins are overflowing near Committee Chowk for several days.', ST_SetSRID(ST_MakePoint(73.0269, 33.5751), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Garbage Collection'), (SELECT id FROM public.departments WHERE name = 'Sanitation'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 3, NOW() - INTERVAL '4 days'),
  
  ('Park Maintenance Required in F-6', 'Children''s playground equipment is broken in F-6 Markaz Park.', ST_SetSRID(ST_MakePoint(73.0279, 33.6944), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Playground Safety'), (SELECT id FROM public.departments WHERE name = 'Parks & Recreation'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 3, NOW() - INTERVAL '2 days'),
  
  ('Traffic Signal Issues at Faiz Ahmad Faiz Road', 'Traffic signals are not working properly causing congestion.', ST_SetSRID(ST_MakePoint(73.0479, 33.6844), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Traffic Signal Issue'), (SELECT id FROM public.departments WHERE name = 'Electrical Services'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 4, NOW() - INTERVAL '12 hours'),
  
  ('Sewage Overflow in Chaklala', 'Major sewage overflow near Chaklala Cantonment area.', ST_SetSRID(ST_MakePoint(73.0369, 33.5851), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Sewage Issue'), (SELECT id FROM public.departments WHERE name = 'Water & Sewage'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 5, NOW() - INTERVAL '1 day'),
  
  ('Illegal Construction in H-8', 'Unauthorized construction blocking public road in H-8/3.', ST_SetSRID(ST_MakePoint(73.0779, 33.6544), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Building Code Violation'), (SELECT id FROM public.departments WHERE name = 'Building & Planning'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 3, NOW() - INTERVAL '6 days');

-- Additional In Progress Complaints
INSERT INTO public.complaints (title, description, location, status, category_id, department_id, reported_by, assigned_to, priority, created_at) VALUES
  ('Road Repair in I-8 Sector', 'Road reconstruction work in progress on main I-8 road.', ST_SetSRID(ST_MakePoint(73.0879, 33.6844), 4326)::geography, 'in_progress', (SELECT id FROM public.categories WHERE name = 'Road Damage'), (SELECT id FROM public.departments WHERE name = 'Public Works'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, '560852cf-9268-4183-8e4a-56790306ae36'::uuid, 4, NOW() - INTERVAL '2 days'),
  
  ('Water Line Repair in Morgah', 'Main water line repair work ongoing in Morgah area.', ST_SetSRID(ST_MakePoint(73.0179, 33.5451), 4326)::geography, 'in_progress', (SELECT id FROM public.categories WHERE name = 'Water Leakage'), (SELECT id FROM public.departments WHERE name = 'Water & Sewage'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, 4, NOW() - INTERVAL '1 day'),
  
  ('Tree Trimming in Bahria Town', 'Tree trimming work in progress along main Bahria Town boulevard.', ST_SetSRID(ST_MakePoint(73.0479, 33.5951), 4326)::geography, 'in_progress', (SELECT id FROM public.categories WHERE name = 'Tree Trimming'), (SELECT id FROM public.departments WHERE name = 'Parks & Recreation'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332'::uuid, 2, NOW() - INTERVAL '4 days'),
  
  ('Power Restoration in G-13', 'Electrical fault repair work ongoing in G-13/1 area.', ST_SetSRID(ST_MakePoint(73.0679, 33.6244), 4326)::geography, 'in_progress', (SELECT id FROM public.categories WHERE name = 'Power Outage'), (SELECT id FROM public.departments WHERE name = 'Electrical Services'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, 5, NOW() - INTERVAL '6 hours');

-- Additional Resolved Complaints
INSERT INTO public.complaints (title, description, location, status, category_id, department_id, reported_by, assigned_to, priority, created_at, resolved_at) VALUES
  ('Street Cleaning in F-10', 'Street cleaning completed in F-10 sector main market area.', ST_SetSRID(ST_MakePoint(73.0779, 33.6944), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Garbage Collection'), (SELECT id FROM public.departments WHERE name = 'Sanitation'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, '8989a771-3273-465b-a2c6-bf914920d5ab'::uuid, 2, NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days'),
  
  ('Water Meter Fixed in G-11', 'Faulty water meter replacement completed in G-11/3.', ST_SetSRID(ST_MakePoint(73.0379, 33.6544), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Water Quality'), (SELECT id FROM public.departments WHERE name = 'Water & Sewage'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, 3, NOW() - INTERVAL '8 days', NOW() - INTERVAL '2 days'),
  
  ('Sidewalk Repair in E-7', 'Broken sidewalk repair completed near E-7 main road.', ST_SetSRID(ST_MakePoint(73.0179, 33.6744), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Sidewalk Repair'), (SELECT id FROM public.departments WHERE name = 'Public Works'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, '560852cf-9268-4183-8e4a-56790306ae36'::uuid, 2, NOW() - INTERVAL '12 days', NOW() - INTERVAL '5 days'),
  
  ('Park Lighting Fixed in G-6', 'Faulty park lighting system repaired in G-6 community park.', ST_SetSRID(ST_MakePoint(73.0479, 33.6644), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Street Light Fault'), (SELECT id FROM public.departments WHERE name = 'Electrical Services'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, 2, NOW() - INTERVAL '6 days', NOW() - INTERVAL '1 day'),
  
  ('Noise Pollution Resolved in Commercial Area', 'Construction noise issue resolved in Blue Area commercial zone.', ST_SetSRID(ST_MakePoint(73.0569, 33.6844), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Construction Noise'), (SELECT id FROM public.departments WHERE name = 'Building & Planning'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, '8989a771-3273-465b-a2c6-bf914920d5ab'::uuid, 3, NOW() - INTERVAL '15 days', NOW() - INTERVAL '7 days');

-- ========================================
-- ADD SAMPLE COMMENTS FOR NEW COMPLAINTS
-- ========================================
INSERT INTO public.complaint_comments (complaint_id, user_id, content, is_internal, created_at) 
SELECT 
    c.id,
    CASE 
        WHEN c.status = 'in_progress' THEN c.assigned_to
        ELSE (SELECT id FROM public.users WHERE role_id = (SELECT id FROM public.roles WHERE name = 'Department Admin') LIMIT 1)
    END,
    CASE c.status
        WHEN 'open' THEN 'Complaint has been registered and is under review.'
        WHEN 'in_progress' THEN 'Work has commenced on this issue. Expected completion within the stipulated time frame.'
        WHEN 'resolved' THEN 'Issue has been successfully resolved. Thank you for your patience.'
    END,
    false,
    c.created_at + INTERVAL '2 hours'
FROM public.complaints c
WHERE c.id > (SELECT COALESCE(MAX(complaint_id), 0) FROM public.complaint_comments)
AND c.created_at > NOW() - INTERVAL '1 hour'; -- Only new complaints

-- ========================================
-- VERIFICATION QUERY
-- ========================================
-- Check updated complaints with Pakistani coordinates
SELECT 
  c.id,
  c.title,
  c.status,
  ST_Y(ST_Transform(c.location::geometry, 4326)) as latitude,
  ST_X(ST_Transform(c.location::geometry, 4326)) as longitude,
  cat.name as category,
  d.name as department
FROM public.complaints c
JOIN public.categories cat ON c.category_id = cat.id
JOIN public.departments d ON c.department_id = d.id
ORDER BY c.created_at DESC
LIMIT 20;

-- Count complaints by status
SELECT 
  status,
  COUNT(*) as count
FROM public.complaints
GROUP BY status
ORDER BY status;

-- ========================================
-- PAKISTANI COORDINATES UPDATE COMPLETE!
-- ========================================
-- All complaints now use Islamabad/Rawalpindi coordinates
-- Latitude range: 33.54 - 33.70 (Islamabad/Rawalpindi area)
-- Longitude range: 73.01 - 73.09 (Islamabad/Rawalpindi area)
-- ========================================