-- ========================================
-- UPDATE AUTH USER EMAILS AND PASSWORDS
-- ========================================
-- Updates emails to professional addresses and sets demo passwords
-- Run in Supabase SQL Editor
-- ========================================

-- ========================================
-- UPDATE EMAIL ADDRESSES TO PROFESSIONAL ONES
-- ========================================

-- Super Admin
UPDATE auth.users 
SET email = 'admin@demo.gov'
WHERE id = 'bf109e37-9c02-4d47-920f-0a1bca360391';

-- Secondary Super Admin
UPDATE auth.users 
SET email = 'admin.deputy@demo.gov'
WHERE id = 'cd704d73-f43a-4c46-8acc-ea98728ef540';

-- Department Admins
UPDATE auth.users 
SET email = 'john.smith@publicworks.demo.gov'
WHERE id = '1d3d95a2-2cc5-4b1b-a16e-ea1b25b27337';

UPDATE auth.users 
SET email = 'abdul.nadeem@sanitation.demo.gov'
WHERE id = '8a1e761a-b80b-48ba-9020-32a3af41c6b8';

UPDATE auth.users 
SET email = 'mike.davis@emergency.demo.gov'
WHERE id = '96e832d6-3a36-4888-b6ea-126a7b888bb4';

-- Field Agents
UPDATE auth.users 
SET email = 'abdul.rehman@parks.demo.gov'
WHERE id = '560852cf-9268-4183-8e4a-56790306ae36';

UPDATE auth.users 
SET email = 'lisa.martinez@parks.demo.gov'
WHERE id = 'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332';

UPDATE auth.users 
SET email = 'goheer.hassan@emergency.demo.gov'
WHERE id = '8989a771-3273-465b-a2c6-bf914920d5ab';

UPDATE auth.users 
SET email = 'chris.lee@emergency.demo.gov'
WHERE id = 'def6e75c-aa9f-4e99-b2ac-5b5f193d7159';

-- Public Users
UPDATE auth.users 
SET email = 'alice.cooper@citizen.demo.gov'
WHERE id = '18ffbcba-777a-43ba-aa98-694cb680d157';

UPDATE auth.users 
SET email = 'abdulrehman.nadeem@citizen.demo.gov'
WHERE id = 'df6dbad5-1680-4ec8-8199-300ded76bfed';

-- ========================================
-- UPDATE PASSWORDS FOR DEMO ACCOUNTS
-- ========================================

-- Set main admin password (keep existing)
-- UPDATE auth.users 
-- SET encrypted_password = crypt('12345678', gen_salt('bf'))
-- WHERE id = 'bf109e37-9c02-4d47-920f-0a1bca360391';

-- Set all other users to Demo123! for easy testing
UPDATE auth.users 
SET encrypted_password = crypt('Demo123!', gen_salt('bf'))
WHERE id IN (
  'cd704d73-f43a-4c46-8acc-ea98728ef540', -- Secondary Admin
  '1d3d95a2-2cc5-4b1b-a16e-ea1b25b27337', -- John Smith (Dept Admin)
  '8a1e761a-b80b-48ba-9020-32a3af41c6b8', -- Abdul Nadeem (Dept Admin)
  '96e832d6-3a36-4888-b6ea-126a7b888bb4', -- Mike Davis (Dept Admin)
  '560852cf-9268-4183-8e4a-56790306ae36', -- Abdul Rehman (Field Agent)
  'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332', -- Lisa Martinez (Field Agent)
  '8989a771-3273-465b-a2c6-bf914920d5ab', -- Goheer Hassan (Field Agent)
  'def6e75c-aa9f-4e99-b2ac-5b5f193d7159', -- Chris Lee (Field Agent)
  '18ffbcba-777a-43ba-aa98-694cb680d157', -- Alice Cooper (Public User)
  'df6dbad5-1680-4ec8-8199-300ded76bfed'  -- Abdul Rehman Nadeem (Public User)
);

-- ========================================
-- VERIFICATION
-- ========================================
-- Check updated emails and users

SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users 
WHERE id IN (
  'bf109e37-9c02-4d47-920f-0a1bca360391',
  'cd704d73-f43a-4c46-8acc-ea98728ef540',
  '1d3d95a2-2cc5-4b1b-a16e-ea1b25b27337',
  '8a1e761a-b80b-48ba-9020-32a3af41c6b8',
  '96e832d6-3a36-4888-b6ea-126a7b888bb4',
  '560852cf-9268-4183-8e4a-56790306ae36',
  'f1f2f97b-1bf6-46e5-a7ab-dd43985c9332',
  '8989a771-3273-465b-a2c6-bf914920d5ab',
  'def6e75c-aa9f-4e99-b2ac-5b5f193d7159',
  '18ffbcba-777a-43ba-aa98-694cb680d157',
  'df6dbad5-1680-4ec8-8199-300ded76bfed'
)
ORDER BY email;

-- ========================================
-- DEMO LOGIN CREDENTIALS (UPDATED)
-- ========================================
/*
After running this script:

Super Admin:
✅ admin@demo.gov / 12345678 (MAIN DEMO ACCOUNT)
✅ admin.deputy@demo.gov / Demo123!

Department Admins:
✅ john.smith@publicworks.demo.gov / Demo123!
✅ abdul.nadeem@sanitation.demo.gov / Demo123!
✅ mike.davis@emergency.demo.gov / Demo123!

Field Agents:
✅ abdul.rehman@parks.demo.gov / Demo123!
✅ lisa.martinez@parks.demo.gov / Demo123!
✅ goheer.hassan@emergency.demo.gov / Demo123!
✅ chris.lee@emergency.demo.gov / Demo123!

Public Users:
✅ alice.cooper@citizen.demo.gov / Demo123!
✅ abdulrehman.nadeem@citizen.demo.gov / Demo123!

All users have professional email addresses and simple passwords for demo purposes.
*/