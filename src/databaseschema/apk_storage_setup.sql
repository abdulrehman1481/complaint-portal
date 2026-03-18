-- APK distribution storage setup for Super Admin uploads
-- Run in Supabase SQL editor.

-- 1) Create public bucket for APK files (idempotent)
insert into storage.buckets (id, name, public)
values ('apk-distribution', 'apk-distribution', true)
on conflict (id) do update
set public = excluded.public;

-- 2) Allow public read of APK files
drop policy if exists "Public can download APK files" on storage.objects;
create policy "Public can download APK files"
on storage.objects
for select
using (bucket_id = 'apk-distribution');

-- 3) Allow authenticated upload/update/delete for Super Admin users only
-- Assumes your app role model is in public.users joined to public.roles.
drop policy if exists "Super Admin can upload APK files" on storage.objects;
create policy "Super Admin can upload APK files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'apk-distribution'
  and exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name = 'Super Admin'
  )
);

drop policy if exists "Super Admin can update APK files" on storage.objects;
create policy "Super Admin can update APK files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'apk-distribution'
  and exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name = 'Super Admin'
  )
)
with check (
  bucket_id = 'apk-distribution'
  and exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name = 'Super Admin'
  )
);

drop policy if exists "Super Admin can delete APK files" on storage.objects;
create policy "Super Admin can delete APK files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'apk-distribution'
  and exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name = 'Super Admin'
  )
);
