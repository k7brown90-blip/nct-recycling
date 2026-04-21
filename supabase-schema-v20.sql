-- =====================================================
-- NCT Recycling — Schema v20
-- Internal employee workforce foundation for labor tracking PWA
-- =====================================================

create extension if not exists pgcrypto;

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter table profiles
  drop constraint if exists profiles_role_check;

alter table profiles
  add constraint profiles_role_check
  check (role in ('nonprofit', 'reseller', 'both', 'discard', 'employee'));

create table if not exists employee_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  first_name text,
  last_name text,
  work_email text,
  personal_email text,
  phone text,
  job_title text,
  department text,
  primary_location text,
  employment_type text not null default 'hourly'
    check (employment_type in ('hourly', 'salary', 'contractor')),
  employment_status text not null default 'pending_setup'
    check (employment_status in ('pending_setup', 'active', 'inactive', 'terminated')),
  hire_date date,
  supervisor_employee_id uuid references employee_profiles(id) on delete set null,
  payroll_provider text default 'quickbooks_online',
  payroll_external_id text,
  quickbooks_employee_id text,
  default_shift_color text,
  notes text,
  last_clock_event_type text
    check (last_clock_event_type in ('clock_in', 'break_start', 'break_end', 'clock_out')),
  last_clock_event_at timestamptz
);

create index if not exists idx_employee_profiles_status on employee_profiles(employment_status);
create index if not exists idx_employee_profiles_department on employee_profiles(department);

drop trigger if exists set_employee_profiles_updated_at on employee_profiles;
create trigger set_employee_profiles_updated_at
before update on employee_profiles
for each row execute procedure update_updated_at();

create table if not exists employee_availability_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  employee_id uuid not null references employee_profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_available boolean not null default true,
  start_time time,
  end_time time,
  notes text
);

create unique index if not exists idx_employee_availability_unique_day
  on employee_availability_rules(employee_id, weekday);

drop trigger if exists set_employee_availability_rules_updated_at on employee_availability_rules;
create trigger set_employee_availability_rules_updated_at
before update on employee_availability_rules
for each row execute procedure update_updated_at();

create table if not exists employee_time_off_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  employee_id uuid not null references employee_profiles(id) on delete cascade,
  request_type text not null default 'time_off'
    check (request_type in ('time_off', 'availability_change')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'cancelled')),
  starts_on date not null,
  ends_on date not null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_paid boolean not null default false,
  reason text,
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  constraint employee_time_off_requests_date_order check (ends_on >= starts_on)
);

create index if not exists idx_employee_time_off_requests_employee
  on employee_time_off_requests(employee_id, starts_on, ends_on);

drop trigger if exists set_employee_time_off_requests_updated_at on employee_time_off_requests;
create trigger set_employee_time_off_requests_updated_at
before update on employee_time_off_requests
for each row execute procedure update_updated_at();

create table if not exists employee_shifts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  employee_id uuid not null references employee_profiles(id) on delete cascade,
  shift_date date not null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'confirmed', 'completed', 'cancelled', 'missed')),
  role_label text,
  location_label text,
  notes text,
  assigned_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  constraint employee_shifts_time_order check (scheduled_end > scheduled_start)
);

create index if not exists idx_employee_shifts_employee_date on employee_shifts(employee_id, shift_date);
create index if not exists idx_employee_shifts_status on employee_shifts(status);

drop trigger if exists set_employee_shifts_updated_at on employee_shifts;
create trigger set_employee_shifts_updated_at
before update on employee_shifts
for each row execute procedure update_updated_at();

create table if not exists employee_time_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  employee_id uuid not null references employee_profiles(id) on delete cascade,
  shift_id uuid references employee_shifts(id) on delete set null,
  entry_source text not null default 'clock'
    check (entry_source in ('clock', 'manual', 'admin')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes_worked integer,
  notes text,
  submitted_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  payroll_batch_id uuid,
  constraint employee_time_entries_time_order check (ended_at is null or ended_at > started_at)
);

create index if not exists idx_employee_time_entries_employee_start
  on employee_time_entries(employee_id, started_at desc);
create index if not exists idx_employee_time_entries_status
  on employee_time_entries(approval_status);

drop trigger if exists set_employee_time_entries_updated_at on employee_time_entries;
create trigger set_employee_time_entries_updated_at
before update on employee_time_entries
for each row execute procedure update_updated_at();

create table if not exists employee_break_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  time_entry_id uuid not null references employee_time_entries(id) on delete cascade,
  break_type text not null default 'unpaid'
    check (break_type in ('paid', 'unpaid', 'meal')),
  started_at timestamptz not null,
  ended_at timestamptz,
  notes text,
  constraint employee_break_entries_time_order check (ended_at is null or ended_at > started_at)
);

create index if not exists idx_employee_break_entries_time_entry on employee_break_entries(time_entry_id);

create table if not exists payroll_export_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'exported', 'archived')),
  export_target text not null default 'quickbooks_online'
    check (export_target in ('quickbooks_online', 'csv')),
  exported_at timestamptz,
  exported_by uuid references auth.users(id) on delete set null,
  quickbooks_payload jsonb,
  notes text,
  constraint payroll_export_batches_period_order check (period_end >= period_start)
);

drop trigger if exists set_payroll_export_batches_updated_at on payroll_export_batches;
create trigger set_payroll_export_batches_updated_at
before update on payroll_export_batches
for each row execute procedure update_updated_at();

alter table employee_time_entries
  drop constraint if exists employee_time_entries_payroll_batch_id_fkey;

alter table employee_time_entries
  add constraint employee_time_entries_payroll_batch_id_fkey
  foreign key (payroll_batch_id) references payroll_export_batches(id) on delete set null;

create or replace view employee_schedule_overview as
select
  s.id,
  s.shift_date,
  s.scheduled_start,
  s.scheduled_end,
  s.status,
  s.role_label,
  s.location_label,
  e.id as employee_id,
  e.display_name,
  e.job_title,
  e.department,
  e.default_shift_color
from employee_shifts s
join employee_profiles e on e.id = s.employee_id;

create or replace view employee_time_entry_summary as
select
  t.id,
  t.employee_id,
  e.display_name,
  t.shift_id,
  t.entry_source,
  t.approval_status,
  t.started_at,
  t.ended_at,
  t.minutes_worked,
  coalesce(sum(
    case
      when b.ended_at is not null then greatest(extract(epoch from (b.ended_at - b.started_at)) / 60, 0)
      else 0
    end
  ), 0)::integer as break_minutes
from employee_time_entries t
join employee_profiles e on e.id = t.employee_id
left join employee_break_entries b on b.time_entry_id = t.id
group by
  t.id,
  t.employee_id,
  e.display_name,
  t.shift_id,
  t.entry_source,
  t.approval_status,
  t.started_at,
  t.ended_at,
  t.minutes_worked;