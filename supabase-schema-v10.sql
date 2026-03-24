-- =====================================================
-- NCT Recycling — Schema v10
-- Run in Supabase SQL Editor AFTER all prior schemas
-- =====================================================
-- Adds per-partner default bag capacity
-- =====================================================

-- Default estimated bag capacity for each co-op partner
-- Used as the pre-filled value when adding them to a route
ALTER TABLE nonprofit_applications
  ADD COLUMN IF NOT EXISTS estimated_bags integer;
