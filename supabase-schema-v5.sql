-- NCT Recycling — Schema v5: Donation Lots & Tax Receipt Uploads
-- Run this in Supabase SQL Editor AFTER all prior schema files.

-- ============================================================
-- Update tax_receipts to support two-step workflow:
--   1. Admin logs a lot (piece count) → file_url is null
--   2. Nonprofit uploads their receipt → file_url set, status = 'uploaded'
-- ============================================================

-- Make file_url nullable (admin creates record before nonprofit uploads)
ALTER TABLE tax_receipts ALTER COLUMN file_url DROP NOT NULL;

-- Add lot date
ALTER TABLE tax_receipts ADD COLUMN IF NOT EXISTS lot_date date;

-- Add receipt status: 'pending_receipt' or 'uploaded'
ALTER TABLE tax_receipts ADD COLUMN IF NOT EXISTS receipt_status text not null default 'pending_receipt';

-- Add storage path for the receipt file (separate from file_url which was previously used for the receipt itself)
ALTER TABLE tax_receipts ADD COLUMN IF NOT EXISTS receipt_file_path text;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_tax_receipts_application ON tax_receipts(application_id);
CREATE INDEX IF NOT EXISTS idx_tax_receipts_status ON tax_receipts(receipt_status);

-- RLS: service role full access
DROP POLICY IF EXISTS "Service role manages tax receipts" ON tax_receipts;
CREATE POLICY "Service role manages tax receipts"
  ON tax_receipts FOR ALL
  USING (true);
