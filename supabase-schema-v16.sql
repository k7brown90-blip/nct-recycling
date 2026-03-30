-- Schema v16: Portal refactor fields
-- Run in Supabase SQL Editor

-- 1. Per-org storage capacity (used to calculate fill_level estimates)
ALTER TABLE nonprofit_applications
  ADD COLUMN IF NOT EXISTS storage_capacity_bags integer NOT NULL DEFAULT 40;

ALTER TABLE discard_accounts
  ADD COLUMN IF NOT EXISTS storage_capacity_bags integer NOT NULL DEFAULT 40;

-- 2. Fill level field on nonprofit pickup requests (replaces bag/weight free-entry)
ALTER TABLE nonprofit_pickup_requests
  ADD COLUMN IF NOT EXISTS fill_level text CHECK (fill_level IN ('half', 'full', 'overflowing'));

-- 3. No-inventory flag on route stops (driver records when org had nothing to pick up)
ALTER TABLE pickup_route_stops
  ADD COLUMN IF NOT EXISTS no_inventory boolean NOT NULL DEFAULT false;

-- 4. Completion type on routes (full = all stops done, partial = some skipped/no_inventory)
ALTER TABLE pickup_routes
  ADD COLUMN IF NOT EXISTS completion_type text CHECK (completion_type IN ('full', 'partial'));

-- 5. Index for no_inventory lookups (missed pickup detection)
CREATE INDEX IF NOT EXISTS idx_stops_no_inventory
  ON pickup_route_stops(nonprofit_id, no_inventory)
  WHERE no_inventory = true;
