-- v14: Nonprofit pickup requests (dual pickup system)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS nonprofit_pickup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nonprofit_id uuid REFERENCES nonprofit_applications(id),
  estimated_bags integer,
  estimated_weight_lbs numeric,
  preferred_date date,
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_npr_nonprofit_id ON nonprofit_pickup_requests(nonprofit_id);
CREATE INDEX IF NOT EXISTS idx_npr_status ON nonprofit_pickup_requests(status);
