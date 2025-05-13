-- Enable PostGIS extension
create extension if not exists postgis;

-- Create custom types
create type public.complaint_status as enum ('open', 'in_progress', 'resolved');

-- Main Tables
create table public.roles (
  id serial primary key,
  name text not null unique,
  permissions text[] not null,
  is_system_role boolean default false,
  created_at timestamp with time zone default now()
);

create table public.departments (
  id serial primary key,
  name text not null unique,
  contact_email text,
  jurisdiction geography(Polygon, 4326),
  created_at timestamp with time zone default now()
);

create table public.users (
  id uuid references auth.users not null primary key,
  role_id integer references public.roles(id) not null,
  department_id integer references public.departments(id),
  first_name text not null,
  last_name text not null,
  phone_number text,
  official_position text,
  address text,
  profile_image text,
  last_active timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.categories (
  id serial primary key,
  name text not null unique,
  icon text not null,
  default_department_id integer references public.departments(id),
  response_time interval,
  severity_level integer check (severity_level between 1 and 5),
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table public.complaints (
  id serial primary key,
  title text not null,
  description text,
  location geography(Point, 4326) not null,
  status complaint_status not null default 'open',
  category_id integer references public.categories(id) not null,
  reported_by uuid references public.users(id),
  assigned_to uuid references public.users(id),
  anonymous boolean default false,
  images text[],
  priority integer check (priority between 1 and 3),
  validation_score integer default 0,
  notes jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  resolved_at timestamp with time zone
);

-- Spatial Analysis Tables
create table public.heatmap_snapshots (
  id serial primary key,
  bounds geometry(Polygon, 4326) not null,
  intensity_data jsonb not null,
  generated_at timestamp with time zone default now()
);

create table public.buffer_zones (
  id serial primary key,
  complaint_id integer references public.complaints(id) not null,
  radius integer not null,
  zone geography(Polygon, 4326) not null,
  created_at timestamp with time zone default now()
);

-- Junction Tables
create table public.role_departments (
  role_id integer references public.roles(id),
  department_id integer references public.departments(id),
  primary key (role_id, department_id)
);

create table public.department_categories (
  department_id integer references public.departments(id),
  category_id integer references public.categories(id),
  primary key (department_id, category_id)
);

-- Activity Logs Table
create table public.activity_logs (
  id serial primary key,
  user_id uuid references public.users(id),
  action_type text not null, -- 'login', 'logout', 'update_status', 'create_complaint', etc.
  entity_type text not null, -- 'user', 'complaint', 'department', etc.
  entity_id text not null,   -- ID of the affected entity
  details jsonb,             -- Additional details about the action
  created_at timestamp with time zone default now(),
  ip_address text,
  user_agent text
);

-- Complaint Comments Table
create table public.complaint_comments (
  id serial primary key,
  complaint_id integer references public.complaints(id) not null,
  user_id uuid references public.users(id),
  content text not null,
  is_internal boolean default false,
  is_system boolean default false,
  created_at timestamp with time zone default now()
);

-- Complaint History Table for status changes
create table public.complaint_history (
  id serial primary key,
  complaint_id integer references public.complaints(id) not null,
  status complaint_status not null,
  changed_by uuid references public.users(id),
  notes text,
  created_at timestamp with time zone default now()
);

-- Indexes
create index if not exists idx_complaints_location on public.complaints using gist(location);
create index if not exists idx_buffer_zones on public.buffer_zones using gist(zone);
create index if not exists idx_department_jurisdiction on public.departments using gist(jurisdiction);
create index if not exists idx_activity_logs_user on public.activity_logs(user_id);
create index if not exists idx_activity_logs_action on public.activity_logs(action_type);
create index if not exists idx_activity_logs_entity on public.activity_logs(entity_type, entity_id);
create index if not exists idx_complaint_comments_complaint on public.complaint_comments(complaint_id);
create index if not exists idx_complaints_category on public.complaints(category_id);
create index if not exists idx_complaints_status on public.complaints(status);
create index if not exists idx_complaints_reporter on public.complaints(reported_by);
create index if not exists idx_complaints_assigned on public.complaints(assigned_to);
create index if not exists idx_department_categories_dept on public.department_categories(department_id);
create index if not exists idx_department_categories_cat on public.department_categories(category_id);

-- Helper Functions
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create a function to log complaint status changes
create or replace function public.log_complaint_status_change()
returns trigger as $$
begin
  if old.status != new.status then
    insert into public.complaint_history (
      complaint_id,
      status,
      changed_by
    ) values (
      new.id,
      new.status,
      (select auth.uid() from auth.users where active = true limit 1)
    );
  end if;
  return new;
end;
$$ language plpgsql;

-- Create trigger for complaint status changes
create trigger log_complaint_status_change
after update of status on public.complaints
for each row execute function public.log_complaint_status_change();

-- Function to log activity
create or replace function public.log_activity(
  action_type text,
  entity_type text,
  entity_id text,
  details jsonb default null
)
returns void as $$
declare
  current_user_id uuid;
begin
  -- Try to get the current user ID
  current_user_id := (select auth.uid() from auth.users where active = true limit 1);
  
  insert into public.activity_logs (
    user_id,
    action_type,
    entity_type,
    entity_id,
    details,
    ip_address
  ) values (
    current_user_id,
    action_type,
    entity_type,
    entity_id,
    details,
    (select client_ip from request.env limit 1)
  );
end;
$$ language plpgsql;

-- Triggers
create trigger handle_user_updates
before update on public.users
for each row execute function public.update_updated_at();

create trigger handle_complaint_updates
before update on public.complaints
for each row execute function public.update_updated_at();

-- Predefined System Data
-- Insert only if not already present to avoid errors on repeated runs
insert into public.roles (name, permissions, is_system_role)
select 'Super Admin', '{manage_system,manage_roles,manage_users,manage_content}', true
where not exists (select 1 from public.roles where name = 'Super Admin');

insert into public.roles (name, permissions, is_system_role)
select 'Department Admin', '{manage_department,manage_complaints,generate_reports}', true
where not exists (select 1 from public.roles where name = 'Department Admin');

insert into public.roles (name, permissions, is_system_role)
select 'Field Agent', '{update_complaints,upload_evidence}', true
where not exists (select 1 from public.roles where name = 'Field Agent');

insert into public.roles (name, permissions, is_system_role)
select 'Public User', '{report_issues,view_map}', true
where not exists (select 1 from public.roles where name = 'Public User');

-- Only insert categories if departments table is not empty to avoid foreign key errors
do $$
begin
  if exists (select 1 from public.departments limit 1) then
    insert into public.categories (name, icon, severity_level, response_time)
    select 'Pothole Repair', '🚧', 3, '7 days'
    where not exists (select 1 from public.categories where name = 'Pothole Repair');

    insert into public.categories (name, icon, severity_level, response_time)
    select 'Garbage Collection', '🗑️', 2, '2 days'
    where not exists (select 1 from public.categories where name = 'Garbage Collection');
    
    insert into public.categories (name, icon, severity_level, response_time)
    select 'Street Light Fault', '💡', 2, '3 days'
    where not exists (select 1 from public.categories where name = 'Street Light Fault');
    
    insert into public.categories (name, icon, severity_level, response_time)
    select 'Water Leakage', '🚰', 4, '1 days'
    where not exists (select 1 from public.categories where name = 'Water Leakage');
    
    insert into public.categories (name, icon, severity_level, response_time)
    select 'Illegal Dumping', '🚯', 3, '5 days'
    where not exists (select 1 from public.categories where name = 'Illegal Dumping');
    
    insert into public.categories (name, icon, severity_level, response_time)
    select 'Road Damage', '🛣️', 4, '14 days'
    where not exists (select 1 from public.categories where name = 'Road Damage');
    
    insert into public.categories (name, icon, severity_level, response_time)
    select 'Sewage Issue', '🦠', 5, '1 days'
    where not exists (select 1 from public.categories where name = 'Sewage Issue');
    
    insert into public.categories (name, icon, severity_level, response_time)
    select 'Public Safety', '🚨', 5, '24 hours'
    where not exists (select 1 from public.categories where name = 'Public Safety');
  end if;
end
$$;

-- Create initial admin user
do $$
declare
  super_admin_role_id int;
  new_user_id uuid := '12345678-1234-1234-1234-123456789012'; -- Replace with a valid UUID or generate one
begin
  -- Find Super Admin role ID
  select id into super_admin_role_id from public.roles where name = 'Super Admin';
  
  -- Create user in auth schema (need to be run with appropriate privileges)
  -- Note: In Supabase you might need to use their API or dashboard for this part
  -- This is a placeholder for that step
  
  -- Create user profile with Super Admin role
  insert into public.users (
    id, 
    role_id, 
    first_name, 
    last_name, 
    email
  ) values (
    new_user_id, 
    super_admin_role_id, 
    'Admin', 
    'User', 
    'admin@example.com'
  )
  on conflict (id) do nothing;
end
$$;