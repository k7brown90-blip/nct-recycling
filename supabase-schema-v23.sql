-- =====================================================
-- NCT Recycling — Schema v23
-- Contamination documentation: severity, audit fields, photo evidence,
-- partner notification timestamp, plus storage bucket + photos table.
-- Idempotent. Run after v22.
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Extend discard_pickups with contamination fields
-- ---------------------------------------------------------------
alter table discard_pickups
  add column if not exists contamination_reported    boolean     not null default false,
  add column if not exists contamination_severity    text,
  add column if not exists contamination_notes       text,
  add column if not exists contamination_reported_at timestamptz,
  add column if not exists contamination_reported_by uuid,
  add column if not exists contamination_source      text,
  add column if not exists partner_notified_at       timestamptz;

-- Drop any prior contamination_severity check (idempotent re-run) and add canonical.
do $$
declare
  cname text;
begin
  select conname into cname
    from pg_constraint
   where conrelid = 'discard_pickups'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%contamination_severity%';
  if cname is not null then
    execute format('alter table discard_pickups drop constraint %I', cname);
  end if;
end$$;

alter table discard_pickups
  add constraint discard_pickups_contamination_severity_check
  check (contamination_severity is null
         or contamination_severity in ('none','minor','major','rejected'));

do $$
declare
  cname text;
begin
  select conname into cname
    from pg_constraint
   where conrelid = 'discard_pickups'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%contamination_source%';
  if cname is not null then
    execute format('alter table discard_pickups drop constraint %I', cname);
  end if;
end$$;

alter table discard_pickups
  add constraint discard_pickups_contamination_source_check
  check (contamination_source is null
         or contamination_source in ('admin','driver'));

create index if not exists discard_pickups_contamination_idx
  on discard_pickups (contamination_reported)
  where contamination_reported = true;

-- ---------------------------------------------------------------
-- 2. discard_pickup_photos table
-- ---------------------------------------------------------------
create table if not exists discard_pickup_photos (
  id                uuid primary key default gen_random_uuid(),
  pickup_id         uuid not null references discard_pickups(id) on delete cascade,
  storage_bucket    text not null default 'discard-contamination',
  storage_path      text not null,
  original_filename text,
  mime_type         text,
  caption           text,
  source            text not null default 'admin'
                    check (source in ('admin','driver')),
  uploaded_by       uuid,
  uploaded_at       timestamptz not null default now()
);

create index if not exists discard_pickup_photos_pickup_idx
  on discard_pickup_photos (pickup_id);

alter table discard_pickup_photos enable row level security;

-- Service role only — admin/driver routes use the service client; partner portal
-- has no need for direct access (signed URLs are generated server-side).
drop policy if exists "discard_pickup_photos service role" on discard_pickup_photos;
create policy "discard_pickup_photos service role" on discard_pickup_photos
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------
-- 3. Storage bucket for contamination photos (private)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('discard-contamination', 'discard-contamination', false)
  on conflict do nothing;

-- Service-role-only RLS. Signed URLs are generated server-side for both
-- admin viewing (5 min) and partner notification emails (24 h).
drop policy if exists "discard-contamination service role" on storage.objects;
create policy "discard-contamination service role" on storage.objects
  for all
  using (bucket_id = 'discard-contamination' and auth.role() = 'service_role')
  with check (bucket_id = 'discard-contamination' and auth.role() = 'service_role');
