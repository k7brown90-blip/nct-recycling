-- =====================================================
-- NCT Recycling — Schema v12
-- Run in Supabase SQL Editor AFTER all prior schemas
-- =====================================================
-- Discard Partner Portal
-- =====================================================

-- Add user_id to discard_accounts (links auth user to their account)
ALTER TABLE discard_accounts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add discard_account_id to profiles table (for discard role users)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS discard_account_id uuid REFERENCES discard_accounts(id);

-- Update profiles role constraint to include 'discard'
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('nonprofit', 'reseller', 'both', 'discard'));

-- Bag counts for discard accounts (separate from nonprofit bag_counts)
CREATE TABLE IF NOT EXISTS discard_bag_counts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discard_account_id uuid NOT NULL REFERENCES discard_accounts(id) ON DELETE CASCADE,
  bag_count   integer NOT NULL DEFAULT 0,
  entry_type  text NOT NULL DEFAULT 'add' CHECK (entry_type IN ('add', 'pickup')),
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- Pickup requests submitted by discard partners via their portal
CREATE TABLE IF NOT EXISTS discard_pickup_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discard_account_id uuid NOT NULL REFERENCES discard_accounts(id) ON DELETE CASCADE,
  preferred_date     date,
  estimated_weight_lbs integer,
  estimated_bags     integer,
  notes              text,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled')),
  admin_notes        text,
  scheduled_date     date,
  created_at         timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS discard_bag_counts_account_idx ON discard_bag_counts(discard_account_id);
CREATE INDEX IF NOT EXISTS discard_pickup_requests_account_idx ON discard_pickup_requests(discard_account_id);
