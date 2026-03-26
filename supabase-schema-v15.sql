-- v15: Discard invite token (scanner-proof activate flow)
-- Run this in Supabase SQL Editor

ALTER TABLE discard_accounts ADD COLUMN IF NOT EXISTS invite_token text;
ALTER TABLE discard_accounts ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;
