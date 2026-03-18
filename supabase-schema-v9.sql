-- =====================================================
-- NCT Recycling — Schema v9
-- Run in Supabase SQL Editor AFTER all prior schemas
-- =====================================================
-- Dynamic shopping day capacity + Sunday shopping days
-- =====================================================

-- Make route_id nullable so Sunday days (no route) can exist
ALTER TABLE shopping_days DROP CONSTRAINT IF EXISTS shopping_days_route_id_fkey;
ALTER TABLE shopping_days ALTER COLUMN route_id DROP NOT NULL;
ALTER TABLE shopping_days
  ADD CONSTRAINT shopping_days_route_id_fkey
  FOREIGN KEY (route_id) REFERENCES pickup_routes(id) ON DELETE SET NULL;

-- Per-day capacity overrides (null = auto-calculated default)
ALTER TABLE shopping_days ADD COLUMN IF NOT EXISTS wholesale_capacity integer; -- null = floor(lbs/500), min 1
ALTER TABLE shopping_days ADD COLUMN IF NOT EXISTS bins_capacity     integer; -- null = 10 weekday / unlimited Sunday
ALTER TABLE shopping_days ADD COLUMN IF NOT EXISTS admin_notes       text;

-- One shopping day per date
ALTER TABLE shopping_days DROP CONSTRAINT IF EXISTS shopping_days_shopping_date_unique;
ALTER TABLE shopping_days ADD CONSTRAINT shopping_days_shopping_date_unique UNIQUE (shopping_date);
