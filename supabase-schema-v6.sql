-- =====================================================
-- NCT Recycling — Schema v6
-- Run in Supabase SQL Editor
-- =====================================================
-- 1. Add account_type to nonprofit_applications (ltl = Less than Truckload, fl = Full Load)
-- 2. Create container_pickup_requests table for FL accounts
-- =====================================================

-- Add account_type column
alter table nonprofit_applications
  add column if not exists account_type text not null default 'ltl';

-- Enforce valid values (safe to re-run)
alter table nonprofit_applications
  drop constraint if exists nonprofit_applications_account_type_check;
alter table nonprofit_applications
  add constraint nonprofit_applications_account_type_check
  check (account_type in ('ltl', 'fl'));

-- Container pickup requests table (FL accounts only)
create table if not exists container_pickup_requests (
  id             uuid        default gen_random_uuid() primary key,
  application_id uuid        not null references nonprofit_applications(id) on delete cascade,
  status         text        not null default 'pending',
  container_photo_path text,
  notes          text,
  admin_notes    text,
  scheduled_date date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Valid status values
alter table container_pickup_requests
  drop constraint if exists container_pickup_requests_status_check;
alter table container_pickup_requests
  add constraint container_pickup_requests_status_check
  check (status in ('pending', 'reviewed', 'scheduled', 'completed', 'cancelled'));

-- Indexes
create index if not exists container_pickup_requests_app_id_idx
  on container_pickup_requests(application_id);
create index if not exists container_pickup_requests_status_idx
  on container_pickup_requests(status);

-- RLS (service role used by all API routes bypasses this automatically)
alter table container_pickup_requests enable row level security;
