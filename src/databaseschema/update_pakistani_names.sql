-- ========================================
-- UPDATE USER NAMES TO PAKISTANI NAMES
-- ========================================
-- Updates existing users with authentic Pakistani names
-- while maintaining their roles and other information
-- ========================================

-- Update Super Admins with Pakistani names
UPDATE public.users 
SET 
  first_name = 'Muhammad',
  last_name = 'Hassan',
  phone_number = '+92-301-2389491',
  official_position = 'System Administrator',
  updated_at = NOW()
WHERE id = 'bf109e37-9c02-4d47-920f-0a1bca360391'::uuid;

UPDATE public.users 
SET 
  first_name = 'Fatima',
  last_name = 'Khan',
  phone_number = '+92-300-1234567',
  official_position = 'Deputy Administrator',
  updated_at = NOW()
WHERE id = 'cd704d73-f43a-4c46-8acc-ea98728ef540'::uuid;

-- Update Department Admins with Pakistani names
UPDATE public.users 
SET 
  first_name = 'Ahmed',
  last_name = 'Ali',
  phone_number = '+92-321-5551001',
  official_position = 'Public Works Manager',
  updated_at = NOW()
WHERE id = '1d3d95a2-2cc5-4b1b-a16e-ea1b25b27337'::uuid;

UPDATE public.users 
SET 
  first_name = 'Abdul',
  last_name = 'Nadeem',
  phone_number = '+92-319-6647974',
  official_position = 'Sanitation Director',
  updated_at = NOW()
WHERE id = '8a1e761a-b80b-48ba-9020-32a3af41c6b8'::uuid;

UPDATE public.users 
SET 
  first_name = 'Syed',
  last_name = 'Kamran',
  phone_number = '+92-345-8474647',
  official_position = 'Emergency Services Chief',
  updated_at = NOW()
WHERE id = '96e832d6-3a36-4888-b6ea-126a7b888bb4'::uuid;

-- Update Field Agents with Pakistani names
UPDATE public.users 
SET 
  first_name = 'Abdul',
  last_name = 'Rehman',
  phone_number = '+92-305-9601481',
  official_position = 'Parks Inspector',
  updated_at = NOW()
WHERE id = '560852cf-9268-4183-8e4a-56790306ae36'::uuid;

UPDATE public.users 
SET 
  first_name = 'Ayesha',
  last_name = 'Malik',
  phone_number = '+92-333-7771234',
  official_position = 'Parks Maintenance Officer',
  updated_at = NOW()
WHERE id = 'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332'::uuid;

UPDATE public.users 
SET 
  first_name = 'Goheer',
  last_name = 'Hassan',
  phone_number = '+92-300-1111111',
  official_position = 'Emergency Response Officer',
  updated_at = NOW()
WHERE id = '8989a771-3273-465b-a2c6-bf914920d5ab'::uuid;

UPDATE public.users 
SET 
  first_name = 'Usman',
  last_name = 'Sheikh',
  phone_number = '+92-312-2992000',
  official_position = 'Emergency Field Agent',
  updated_at = NOW()
WHERE id = 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159'::uuid;

-- Update Public Users (Citizens) with Pakistani names
UPDATE public.users 
SET 
  first_name = 'Zainab',
  last_name = 'Ahmed',
  phone_number = '+92-304-6001234',
  address = 'House 123, Street 15, F-7/2, Islamabad',
  updated_at = NOW()
WHERE id = '18ffbcba-777a-43ba-aa98-694cb680d157'::uuid;

UPDATE public.users 
SET 
  first_name = 'Abdul Rehman',
  last_name = 'Nadeem',
  phone_number = '+92-305-9601481',
  address = 'Flat 456, Block C, Satellite Town, Rawalpindi',
  updated_at = NOW()
WHERE id = 'df6dbad5-1680-4ec8-8199-300ded76bfed'::uuid;

-- ========================================
-- ADD MORE PAKISTANI USERS (Optional)
-- ========================================
-- Add additional users with Pakistani names if needed

-- Additional Department Admin for Water & Sewage
-- Optional: only create public.user profile if a corresponding auth.user exists (match by email).
-- Create the auth users first via Supabase Auth (recommended) using the emails below,
-- then run this script. This avoids foreign key violations against auth.users.

INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, official_position, active)
SELECT u.id, (SELECT id FROM public.roles WHERE name = 'Department Admin'), (SELECT id FROM public.departments WHERE name = 'Water & Sewage'), 'Bilal', 'Tariq', '+92-336-9988776', 'Water Supply Manager', true
FROM auth.users u
WHERE u.email = 'bilal.tariq@example.com'
  AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

-- Additional Field Agent for Public Works
INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, official_position, active)
SELECT u.id, (SELECT id FROM public.roles WHERE name = 'Field Agent'), (SELECT id FROM public.departments WHERE name = 'Public Works'), 'Kashif', 'Iqbal', '+92-315-4567890', 'Road Maintenance Inspector', true
FROM auth.users u
WHERE u.email = 'kashif.iqbal@example.com'
  AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

-- Additional Field Agent for Electrical Services
INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, official_position, active)
SELECT u.id, (SELECT id FROM public.roles WHERE name = 'Field Agent'), (SELECT id FROM public.departments WHERE name = 'Electrical Services'), 'Saima', 'Riaz', '+92-322-6677889', 'Electrical Maintenance Officer', true
FROM auth.users u
WHERE u.email = 'saima.riaz@example.com'
  AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

-- Additional Public Users
-- For public users we also match by auth.users email. Create these auth accounts first or
-- change the emails below to match existing auth users in your project.
INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, address, active)
SELECT u.id, (SELECT id FROM public.roles WHERE name = 'Public User'), NULL, 'Hassan', 'Mahmood', '+92-301-9876543', 'House 789, G-10/4, Islamabad', true
FROM auth.users u
WHERE u.email = 'hassan.mahmood@example.com'
  AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, address, active)
SELECT u.id, (SELECT id FROM public.roles WHERE name = 'Public User'), NULL, 'Farah', 'Siddiqui', '+92-333-1122334', 'Flat 321, PWD Society, Rawalpindi', true
FROM auth.users u
WHERE u.email = 'farah.siddiqui@example.com'
  AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

INSERT INTO public.users (id, role_id, department_id, first_name, last_name, phone_number, address, active)
SELECT u.id, (SELECT id FROM public.roles WHERE name = 'Public User'), NULL, 'Tariq', 'Butt', '+92-345-5566778', 'House 654, Blue Area, Islamabad', true
FROM auth.users u
WHERE u.email = 'tariq.butt@example.com'
  AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

-- ========================================
-- VERIFICATION QUERY
-- ========================================
-- Check updated user names
SELECT 
  u.first_name || ' ' || u.last_name as full_name,
  r.name as role,
  COALESCE(d.name, 'N/A') as department,
  u.phone_number,
  u.official_position,
  u.address
FROM public.users u
JOIN public.roles r ON u.role_id = r.id
LEFT JOIN public.departments d ON u.department_id = d.id
ORDER BY r.id, u.first_name;

-- Count users by role
SELECT 
  r.name as role,
  COUNT(u.id) as user_count
FROM public.roles r
LEFT JOIN public.users u ON r.id = u.role_id
GROUP BY r.name, r.id
ORDER BY r.id;

-- ========================================
-- PAKISTANI NAMES UPDATE COMPLETE!
-- ========================================
-- All users now have authentic Pakistani names
-- Phone numbers updated to Pakistani format (+92)
-- Addresses updated to Pakistani locations
-- ========================================

-- ========================================
-- POPULATE EMAILS FROM auth.users AND FALLBACKS
-- ========================================
-- Copy email values from auth.users to public.users where available
UPDATE public.users p
SET email = a.email
FROM auth.users a
WHERE p.id = a.id
  AND (p.email IS NULL OR p.email = '');

-- For any remaining users with NULL email, generate a safe fallback: first.last@demo.gov
-- Lowercase and remove spaces/special chars for safety
UPDATE public.users
SET email = lower(regexp_replace(coalesce(first_name, 'user') || '.' || coalesce(last_name, ''), '[^a-z0-9._]+', '', 'gi') || '@demo.gov')
WHERE email IS NULL OR email = '';

-- ========================================
-- UPDATE DISPLAY NAMES TO ROLE(DEPARTMENT)
-- ========================================
-- For Field Agents: set first_name = 'Fagent(<Department Name>)'
UPDATE public.users u
SET first_name = 'Fagent(' || d.name || ')', last_name = NULL, updated_at = NOW()
FROM public.departments d
WHERE u.department_id = d.id
  AND u.role_id = (SELECT id FROM public.roles WHERE name = 'Field Agent');

-- For Department Admins: set first_name = 'Dadmin(<Department Name>)'
UPDATE public.users u
SET first_name = 'Dadmin(' || d.name || ')', last_name = NULL, updated_at = NOW()
FROM public.departments d
WHERE u.department_id = d.id
  AND u.role_id = (SELECT id FROM public.roles WHERE name = 'Department Admin');

-- For Super Admins keep their names but ensure email exists
UPDATE public.users u
SET email = coalesce(u.email, 'admin@demo.gov'), updated_at = NOW()
WHERE u.role_id = (SELECT id FROM public.roles WHERE name = 'Super Admin');

-- ========================================
-- FINAL VERIFICATION
-- ========================================
SELECT id, first_name, last_name, email, role_id, department_id, phone_number FROM public.users ORDER BY role_id, first_name;