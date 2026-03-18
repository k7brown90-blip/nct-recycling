-- =====================================================
-- NCT Recycling — Schema v7
-- Run in Supabase SQL Editor
-- =====================================================
-- 1. Add entry_type to bag_counts (additive system)
-- 2. Add stop_status, completed_at to pickup_route_stops (per-stop completion)
-- =====================================================

-- Add entry_type to bag_counts
-- 'add'    = nonprofit logged bags (additive)
-- 'pickup' = NCT collected bags (resets running counter)
alter table bag_counts
  add column if not exists entry_type text not null default 'add';

alter table bag_counts
  drop constraint if exists bag_counts_entry_type_check;
alter table bag_counts
  add constraint bag_counts_entry_type_check
  check (entry_type in ('add', 'pickup'));

-- Add per-stop tracking to pickup_route_stops
alter table pickup_route_stops
  add column if not exists stop_status text not null default 'pending';

alter table pickup_route_stops
  drop constraint if exists pickup_route_stops_stop_status_check;
alter table pickup_route_stops
  add constraint pickup_route_stops_stop_status_check
  check (stop_status in ('pending', 'completed', 'skipped'));

alter table pickup_route_stops
  add column if not exists completed_at timestamptz;

-- actual_bags already exists in schema v3; skip if already present
alter table pickup_route_stops
  add column if not exists actual_bags integer;

-- Indexes
create index if not exists bag_counts_entry_type_idx
  on bag_counts(nonprofit_id, entry_type, created_at desc);
