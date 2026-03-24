-- =====================================================
-- NCT Recycling — Schema v11
-- Run in Supabase SQL Editor AFTER all prior schemas
-- =====================================================
-- Discard accounts: LTL/FL type, flat rate, monthly frequency
-- =====================================================

-- Account type (LTL = bag/weight tracking, FL = full load/container)
ALTER TABLE discard_accounts
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'ltl';

ALTER TABLE discard_accounts
  DROP CONSTRAINT IF EXISTS discard_accounts_account_type_check;
ALTER TABLE discard_accounts
  ADD CONSTRAINT discard_accounts_account_type_check
  CHECK (account_type IN ('ltl', 'fl'));

-- Flat rate per pickup (overrides per-lb calculation when set)
ALTER TABLE discard_accounts
  ADD COLUMN IF NOT EXISTS flat_rate_per_pickup numeric;

-- Allow 'monthly' as a pickup frequency
ALTER TABLE discard_accounts
  DROP CONSTRAINT IF EXISTS discard_accounts_frequency_check;
ALTER TABLE discard_accounts
  ADD CONSTRAINT discard_accounts_frequency_check
  CHECK (pickup_frequency IN ('weekly', 'biweekly', 'monthly', 'adhoc'));
