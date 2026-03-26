-- v13: Exchange appointment delivery cost fields
-- Run this in Supabase SQL Editor

ALTER TABLE exchange_appointments ADD COLUMN IF NOT EXISTS estimated_bags integer;
ALTER TABLE exchange_appointments ADD COLUMN IF NOT EXISTS ship_to_address text;
ALTER TABLE exchange_appointments ADD COLUMN IF NOT EXISTS labor_cost numeric;
ALTER TABLE exchange_appointments ADD COLUMN IF NOT EXISTS shipping_cost numeric;
ALTER TABLE exchange_appointments ADD COLUMN IF NOT EXISTS quote_status text CHECK (quote_status IN ('quoted', 'confirmed', 'declined'));
ALTER TABLE exchange_appointments ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz;
