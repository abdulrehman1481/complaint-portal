-- ========================================
-- DEMO ACCOUNT SETUP
-- ========================================
-- Creates demo environment using your existing Supabase users
-- 
-- MAIN DEMO ACCOUNT:
-- Email: admin@gmail.com
-- Password: 12345678
-- ========================================

-- ========================================
-- CLEAR EXISTING DATA
-- ========================================
-- Clear tables if they exist, handle gracefully if they don't
DO $$
BEGIN
    -- Clear activity logs if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
        TRUNCATE TABLE public.activity_logs CASCADE;
    END IF;
    
    -- Clear other existing tables
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaint_history') THEN
        TRUNCATE TABLE public.complaint_history CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaint_comments') THEN
        TRUNCATE TABLE public.complaint_comments CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'buffer_zones') THEN
        TRUNCATE TABLE public.buffer_zones CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'heatmap_snapshots') THEN
        TRUNCATE TABLE public.heatmap_snapshots CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'complaints') THEN
        TRUNCATE TABLE public.complaints CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'department_categories') THEN
        TRUNCATE TABLE public.department_categories CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_departments') THEN
        TRUNCATE TABLE public.role_departments CASCADE;
    END IF;
    
    -- Clear categories and departments
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
        TRUNCATE TABLE public.categories RESTART IDENTITY CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
        TRUNCATE TABLE public.departments RESTART IDENTITY CASCADE;
    END IF;
    
    -- Delete custom roles (keep system roles)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
        DELETE FROM public.roles WHERE is_system_role = false;
    END IF;
END $$;

-- ========================================
-- CREATE SYSTEM ROLES
-- ========================================
INSERT INTO public.roles (name, permissions, is_system_role)
VALUES 
  ('Super Admin', '{manage_system,manage_roles,manage_users,manage_content,manage_departments,manage_complaints,generate_reports}', true),
  ('Department Admin', '{manage_department,manage_complaints,generate_reports,assign_agents}', true),
  ('Field Agent', '{update_complaints,upload_evidence,view_assigned_complaints}', true),
  ('Public User', '{report_issues,view_map,view_own_complaints}', true)
ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- ========================================
-- CREATE DEPARTMENTS
-- ========================================
INSERT INTO public.departments (name, contact_email) VALUES
  ('Public Works', 'publicworks@demo.gov'),
  ('Sanitation', 'sanitation@demo.gov'),
  ('Water & Sewage', 'water@demo.gov'),
  ('Electrical Services', 'electrical@demo.gov'),
  ('Public Safety', 'safety@demo.gov'),
  ('Parks & Recreation', 'parks@demo.gov'),
  ('Traffic Management', 'traffic@demo.gov'),
  ('Building & Planning', 'planning@demo.gov'),
  ('Environmental Services', 'environment@demo.gov'),
  ('Emergency Services', 'emergency@demo.gov');

-- ========================================
-- CREATE CATEGORIES
-- ========================================
INSERT INTO public.categories (name, icon, default_department_id, response_time, severity_level, is_active) VALUES
  -- Public Works
  ('Pothole Repair', '🚧', 1, '7 days'::interval, 3, true),
  ('Road Damage', '🛣️', 1, '14 days'::interval, 4, true),
  ('Sidewalk Repair', '🚶', 1, '10 days'::interval, 2, true),
  ('Bridge Maintenance', '🌉', 1, '30 days'::interval, 4, true),
  
  -- Sanitation
  ('Garbage Collection', '🗑️', 2, '2 days'::interval, 2, true),
  ('Illegal Dumping', '🚯', 2, '5 days'::interval, 3, true),
  ('Pest Control', '🐀', 2, '4 days'::interval, 3, true),
  ('Public Toilet Issue', '🚻', 2, '2 days'::interval, 2, true),
  
  -- Water & Sewage
  ('Water Leakage', '🚰', 3, '1 day'::interval, 4, true),
  ('Sewage Issue', '🦠', 3, '1 day'::interval, 5, true),
  ('Water Quality', '💧', 3, '12 hours'::interval, 5, true),
  ('Drainage Problem', '🌊', 3, '2 days'::interval, 3, true),
  
  -- Electrical Services
  ('Street Light Fault', '💡', 4, '3 days'::interval, 2, true),
  ('Power Outage', '⚡', 4, '6 hours'::interval, 5, true),
  ('Traffic Signal Issue', '🚦', 4, '12 hours'::interval, 5, true),
  ('Electrical Hazard', '⚠️', 4, '2 hours'::interval, 5, true),
  
  -- Public Safety
  ('Public Safety Hazard', '🚨', 5, '24 hours'::interval, 5, true),
  ('Suspicious Activity', '👁️', 5, '2 hours'::interval, 4, true),
  ('Vandalism', '🖌️', 5, '5 days'::interval, 3, true),
  ('Noise Complaint', '📢', 5, '3 days'::interval, 2, true),
  
  -- Parks & Recreation
  ('Park Maintenance', '🌳', 6, '7 days'::interval, 2, true),
  ('Playground Safety', '🧒', 6, '2 days'::interval, 4, true),
  ('Sports Facility Issue', '⚽', 6, '5 days'::interval, 2, true),
  ('Tree Trimming', '🌲', 6, '14 days'::interval, 2, true),
  
  -- Traffic Management
  ('Traffic Congestion', '🚗', 7, '7 days'::interval, 3, true),
  ('Parking Violation', '🅿️', 7, '4 hours'::interval, 2, true),
  ('Road Signs Missing', '🛑', 7, '3 days'::interval, 3, true),
  ('Speed Bump Request', '⚡', 7, '21 days'::interval, 2, true),
  
  -- Building & Planning
  ('Building Code Violation', '🏗️', 8, '5 days'::interval, 3, true),
  ('Zoning Issue', '📐', 8, '10 days'::interval, 3, true),
  ('Construction Noise', '🔨', 8, '2 days'::interval, 2, true),
  ('Permit Issue', '📋', 8, '7 days'::interval, 2, true),
  
  -- Environmental Services
  ('Air Quality Issue', '💨', 9, '3 days'::interval, 4, true),
  ('Hazardous Material', '☢️', 9, '1 hour'::interval, 5, true),
  ('Recycling Issue', '♻️', 9, '3 days'::interval, 2, true),
  ('Wildlife Problem', '🦝', 9, '5 days'::interval, 3, true),
  
  -- Emergency Services
  ('Emergency Response', '🚑', 10, '30 minutes'::interval, 5, true),
  ('Fire Hazard', '🔥', 10, '1 hour'::interval, 5, true),
  ('Flood Warning', '🌊', 10, '2 hours'::interval, 5, true),
  ('Gas Leak', '⛽', 10, '30 minutes'::interval, 5, true);

-- Link categories to departments
INSERT INTO public.department_categories (department_id, category_id) VALUES
  -- Public Works
  (1, 1), (1, 2), (1, 3), (1, 4),
  -- Sanitation
  (2, 5), (2, 6), (2, 7), (2, 8),
  -- Water & Sewage
  (3, 9), (3, 10), (3, 11), (3, 12),
  -- Electrical Services
  (4, 13), (4, 14), (4, 15), (4, 16),
  -- Public Safety
  (5, 17), (5, 18), (5, 19), (5, 20),
  -- Parks & Recreation
  (6, 21), (6, 22), (6, 23), (6, 24),
  -- Traffic Management
  (7, 25), (7, 26), (7, 27), (7, 28),
  -- Building & Planning
  (8, 29), (8, 30), (8, 31), (8, 32),
  -- Environmental Services
  (9, 33), (9, 34), (9, 35), (9, 36),
  -- Emergency Services
  (10, 37), (10, 38), (10, 39), (10, 40);

-- ========================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ========================================
-- Add active column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'active') THEN
        ALTER TABLE public.users ADD COLUMN active boolean DEFAULT true;
    END IF;
END $$;

-- ========================================
-- UPDATE EXISTING USERS (DON'T DROP THE TABLE)
-- ========================================
-- Instead of truncating users table, we'll update existing demo users
-- and insert new ones if they don't exist

-- Super Admin (Main Demo Account)
INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, official_position, active) VALUES
  ('bf109e37-9c02-4d47-920f-0a1bca360391'::uuid, (SELECT id FROM public.roles WHERE name = 'Super Admin'), NULL, 'Super', 'Admin', '+92-301-2389491', 'System Administrator', true)
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  department_id = EXCLUDED.department_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone_number = EXCLUDED.phone_number,
  official_position = EXCLUDED.official_position,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Secondary Super Admin  
INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, official_position, active) VALUES
  ('cd704d73-f43a-4c46-8acc-ea98728ef540'::uuid, (SELECT id FROM public.roles WHERE name = 'Super Admin'), NULL, 'Admin', 'User', '+1-555-0002', 'Deputy Administrator', true)
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  department_id = EXCLUDED.department_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone_number = EXCLUDED.phone_number,
  official_position = EXCLUDED.official_position,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Department Admins (using department names to get IDs for safety)
INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, official_position, active) VALUES
  ('1d3d95a2-2cc5-4b1b-a16e-ea1b25b27337'::uuid, (SELECT id FROM public.roles WHERE name = 'Department Admin'), (SELECT id FROM public.departments WHERE name = 'Public Works'), 'John', 'Smith', '+1-555-1001', 'Public Works Manager', true),
  ('8a1e761a-b80b-48ba-9020-32a3af41c6b8'::uuid, (SELECT id FROM public.roles WHERE name = 'Department Admin'), (SELECT id FROM public.departments WHERE name = 'Sanitation'), 'Abdul', 'Nadeem', '+92-319-6647974', 'Sanitation Director', true),
  ('96e832d6-3a36-4888-b6ea-126a7b888bb4'::uuid, (SELECT id FROM public.roles WHERE name = 'Department Admin'), (SELECT id FROM public.departments WHERE name = 'Emergency Services'), 'Mike', 'Davis', '+92-373-847464', 'Emergency Services Chief', true)
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  department_id = EXCLUDED.department_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone_number = EXCLUDED.phone_number,
  official_position = EXCLUDED.official_position,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Field Agents (using department names to get IDs for safety)  
INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, official_position, active) VALUES
  ('560852cf-9268-4183-8e4a-56790306ae36'::uuid, (SELECT id FROM public.roles WHERE name = 'Field Agent'), (SELECT id FROM public.departments WHERE name = 'Parks & Recreation'), 'Abdul', 'Rehman', '+92-305-9601481', 'Parks Inspector', true),
  ('f1f2f97b-1bf6-46e5-a7ab-dd43985c9332'::uuid, (SELECT id FROM public.roles WHERE name = 'Field Agent'), (SELECT id FROM public.departments WHERE name = 'Parks & Recreation'), 'Lisa', 'Martinez', '+92-305-9601481', 'Parks Maintenance Officer', true),
  ('8989a771-3273-465b-a2c6-bf914920d5ab'::uuid, (SELECT id FROM public.roles WHERE name = 'Field Agent'), (SELECT id FROM public.departments WHERE name = 'Emergency Services'), 'Goheer', 'Hassan', '+92-111-111111', 'Emergency Response Officer', true),
  ('def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, (SELECT id FROM public.roles WHERE name = 'Field Agent'), (SELECT id FROM public.departments WHERE name = 'Emergency Services'), 'Chris', 'Lee', '+92-299-2000', 'Emergency Field Agent', true)
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  department_id = EXCLUDED.department_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone_number = EXCLUDED.phone_number,
  official_position = EXCLUDED.official_position,
  active = EXCLUDED.active,
  updated_at = NOW();

-- Public Users (Citizens)
INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, address, active) VALUES
  ('18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, (SELECT id FROM public.roles WHERE name = 'Public User'), NULL, 'Alice', 'Cooper', '+1-555-6001', '123 Main Street, Demo City', true),
  ('df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, (SELECT id FROM public.roles WHERE name = 'Public User'), NULL, 'Abdul Rehman', 'Nadeem', '+92-305-9601481', '456 Oak Avenue, Demo City', true)
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  department_id = EXCLUDED.department_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone_number = EXCLUDED.phone_number,
  address = EXCLUDED.address,
  active = EXCLUDED.active,
  updated_at = NOW();

-- ========================================
-- CREATE SAMPLE COMPLAINTS
-- ========================================

-- Open Complaints (using category and department names for safer references)
INSERT INTO public.complaints (title, description, location, status, category_id, department_id, reported_by, priority, created_at) VALUES
  ('Large Pothole on Main Street', 'Dangerous pothole causing traffic issues at Main St and 1st Ave intersection.', ST_SetSRID(ST_MakePoint(-73.9857, 40.7484), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Pothole Repair'), (SELECT id FROM public.departments WHERE name = 'Public Works'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 3, NOW() - INTERVAL '2 days'),
  ('Overflowing Garbage Bin at Park Square', 'Public garbage bin at Park Square has been overflowing for 3 days.', ST_SetSRID(ST_MakePoint(-73.9887, 40.7514), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Garbage Collection'), (SELECT id FROM public.departments WHERE name = 'Sanitation'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 2, NOW() - INTERVAL '3 days'),
  ('Street Light Not Working on Elm Road', 'Street light on Elm Road has been out for a week, making area unsafe at night.', ST_SetSRID(ST_MakePoint(-73.9817, 40.7454), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Street Light Fault'), (SELECT id FROM public.departments WHERE name = 'Electrical Services'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 2, NOW() - INTERVAL '7 days'),
  ('Playground Equipment Broken', 'Swing set in Central Park is broken and unsafe for children.', ST_SetSRID(ST_MakePoint(-73.9697, 40.7654), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Playground Safety'), (SELECT id FROM public.departments WHERE name = 'Parks & Recreation'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 3, NOW() - INTERVAL '4 days'),
  ('Traffic Signal Malfunction', 'Traffic light at 5th Ave intersection stuck on red.', ST_SetSRID(ST_MakePoint(-73.9757, 40.7584), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Traffic Signal Issue'), (SELECT id FROM public.departments WHERE name = 'Electrical Services'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 3, NOW() - INTERVAL '8 hours'),
  ('Illegal Construction Activity', 'Building construction without proper permits on Industrial Road.', ST_SetSRID(ST_MakePoint(-73.9927, 40.7394), 4326)::geography, 'open', (SELECT id FROM public.categories WHERE name = 'Building Code Violation'), (SELECT id FROM public.departments WHERE name = 'Building & Planning'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 2, NOW() - INTERVAL '1 day');

-- In Progress Complaints (using category and department names for safer references)
INSERT INTO public.complaints (title, description, location, status, category_id, department_id, reported_by, assigned_to, priority, created_at) VALUES
  ('Water Main Leak Near School', 'Significant water leak near school flooding the sidewalk.', ST_SetSRID(ST_MakePoint(-73.9797, 40.7434), 4326)::geography, 'in_progress', (SELECT id FROM public.categories WHERE name = 'Water Leakage'), (SELECT id FROM public.departments WHERE name = 'Water & Sewage'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, 3, NOW() - INTERVAL '1 day'),
  ('Road Damage Repair on Highway 5', 'Large crack developing on Highway 5, becoming dangerous.', ST_SetSRID(ST_MakePoint(-73.9827, 40.7494), 4326)::geography, 'in_progress', (SELECT id FROM public.categories WHERE name = 'Road Damage'), (SELECT id FROM public.departments WHERE name = 'Public Works'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, '560852cf-9268-4183-8e4a-56790306ae36'::uuid, 2, NOW() - INTERVAL '5 days'),
  ('Park Tree Trimming', 'Overgrown trees blocking walking paths in Memorial Park.', ST_SetSRID(ST_MakePoint(-73.9777, 40.7624), 4326)::geography, 'in_progress', (SELECT id FROM public.categories WHERE name = 'Tree Trimming'), (SELECT id FROM public.departments WHERE name = 'Parks & Recreation'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332'::uuid, 1, NOW() - INTERVAL '3 days'),
  ('Emergency Gas Leak Response', 'Reported gas smell near residential area - immediate attention required.', ST_SetSRID(ST_MakePoint(-73.9967, 40.7344), 4326)::geography, 'in_progress', (SELECT id FROM public.categories WHERE name = 'Gas Leak'), (SELECT id FROM public.departments WHERE name = 'Emergency Services'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, '8989a771-3273-465b-a2c6-bf914920d5ab'::uuid, 3, NOW() - INTERVAL '2 hours');

-- Resolved Complaints (using category and department names for safer references)
INSERT INTO public.complaints (title, description, location, status, category_id, department_id, reported_by, assigned_to, priority, created_at, resolved_at) VALUES
  ('Pothole Repair Completed', 'Small pothole that was causing issues for cyclists has been fixed.', ST_SetSRID(ST_MakePoint(-73.9837, 40.7464), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Pothole Repair'), (SELECT id FROM public.departments WHERE name = 'Public Works'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, 'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332'::uuid, 1, NOW() - INTERVAL '15 days', NOW() - INTERVAL '8 days'),
  ('Garbage Collection Issue Resolved', 'Missed garbage pickup has been completed successfully.', ST_SetSRID(ST_MakePoint(-73.9877, 40.7524), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Garbage Collection'), (SELECT id FROM public.departments WHERE name = 'Sanitation'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, '8989a771-3273-465b-a2c6-bf914920d5ab'::uuid, 1, NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days'),
  ('Sidewalk Repair Completed', 'Cracked sidewalk on Oak Street has been repaired.', ST_SetSRID(ST_MakePoint(-73.9707, 40.7414), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Sidewalk Repair'), (SELECT id FROM public.departments WHERE name = 'Public Works'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, '560852cf-9268-4183-8e4a-56790306ae36'::uuid, 2, NOW() - INTERVAL '12 days', NOW() - INTERVAL '4 days'),
  ('Power Outage Restored', 'Electrical fault causing power outage has been fixed.', ST_SetSRID(ST_MakePoint(-73.9607, 40.7684), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Power Outage'), (SELECT id FROM public.departments WHERE name = 'Electrical Services'), 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid, 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, 3, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
  ('Noise Complaint Resolved', 'Construction noise issue has been addressed with proper scheduling.', ST_SetSRID(ST_MakePoint(-73.9547, 40.7744), 4326)::geography, 'resolved', (SELECT id FROM public.categories WHERE name = 'Construction Noise'), (SELECT id FROM public.departments WHERE name = 'Building & Planning'), '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid, '8989a771-3273-465b-a2c6-bf914920d5ab'::uuid, 1, NOW() - INTERVAL '9 days', NOW() - INTERVAL '2 days');

-- ========================================
-- ADD SAMPLE COMMENTS
-- ========================================
INSERT INTO public.complaint_comments (complaint_id, user_id, content, is_internal, created_at) VALUES
  -- Water Main Leak (complaint_id 7)
  (7, 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, 'Located the leak. Will need to shut off water main temporarily for repairs.', false, NOW() - INTERVAL '18 hours'),
  (7, '96e832d6-3a36-4888-b6ea-126a7b888bb4'::uuid, 'Emergency response approved. Please coordinate with school administration before shutoff.', true, NOW() - INTERVAL '16 hours'),
  (7, 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, 'Water main repair in progress. Estimated completion in 4 hours.', false, NOW() - INTERVAL '8 hours'),
  
  -- Road Damage (complaint_id 8)
  (8, '560852cf-9268-4183-8e4a-56790306ae36'::uuid, 'Assessment complete. Will require full resurfacing of affected section.', false, NOW() - INTERVAL '4 days'),
  (8, '1d3d95a2-2cc5-4b1b-a16e-ea1b25b27337'::uuid, 'Scheduling crew for next week. Materials and equipment ordered.', true, NOW() - INTERVAL '3 days'),
  
  -- Park Tree Trimming (complaint_id 9)
  (9, 'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332'::uuid, 'Trees have been assessed. Will trim overhanging branches tomorrow morning.', false, NOW() - INTERVAL '2 days'),
  (9, 'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332'::uuid, 'Tree trimming 50% complete. Will finish remaining section today.', false, NOW() - INTERVAL '1 day'),
  
  -- Emergency Gas Leak (complaint_id 10)
  (10, '8989a771-3273-465b-a2c6-bf914920d5ab'::uuid, 'Emergency team dispatched. Area is being evacuated as precautionary measure.', false, NOW() - INTERVAL '1 hour 30 minutes'),
  (10, '96e832d6-3a36-4888-b6ea-126a7b888bb4'::uuid, 'Gas company notified. Utility crew en route to assist with repairs.', true, NOW() - INTERVAL '1 hour'),
  
  -- Resolved Complaints Comments
  (11, 'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332'::uuid, 'Pothole filled and compacted. Monitoring for 24 hours before final approval.', false, NOW() - INTERVAL '8 days'),
  (13, '560852cf-9268-4183-8e4a-56790306ae36'::uuid, 'Sidewalk repair completed using high-grade concrete. Should last for years.', false, NOW() - INTERVAL '4 days'),
  (14, 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid, 'Electrical fault identified and repaired. Power restored to all affected areas.', false, NOW() - INTERVAL '1 day');

-- ========================================
-- VERIFICATION
-- ========================================
-- Check setup results
SELECT 
  u.first_name || ' ' || u.last_name as name,
  r.name as role,
  COALESCE(d.name, 'N/A') as department,
  u.phone_number
FROM public.users u
JOIN public.roles r ON u.role_id = r.id
LEFT JOIN public.departments d ON u.department_id = d.id
ORDER BY r.id, u.first_name;

-- Check complaints
SELECT 
  c.id,
  c.title,
  c.status,
  cat.name as category,
  d.name as department,
  reporter.first_name || ' ' || reporter.last_name as reported_by,
  COALESCE(agent.first_name || ' ' || agent.last_name, 'Unassigned') as assigned_to
FROM public.complaints c
JOIN public.categories cat ON c.category_id = cat.id
JOIN public.departments d ON c.department_id = d.id
LEFT JOIN public.users reporter ON c.reported_by = reporter.id
LEFT JOIN public.users agent ON c.assigned_to = agent.id
ORDER BY c.created_at DESC;

-- ========================================
-- DEMO SETUP COMPLETE!
-- ========================================
-- Login with: admin@gmail.com / 12345678
-- ========================================