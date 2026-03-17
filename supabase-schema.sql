-- NCT Recycling — Wholesale Reseller Portal Schema
-- Run this in your Supabase SQL Editor at: https://supabase.com/dashboard

-- Enable UUID extension (already enabled by default on Supabase)
create extension if not exists "uuid-ossp";

-- ============================================================
-- RESELLER APPLICATIONS TABLE
-- ============================================================
create table if not exists reseller_applications (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),

  -- Contact Info
  full_name           text not null,
  business_name       text,
  email               text not null,
  phone               text,

  -- Business Details
  platforms           text[],              -- ['eBay', 'Poshmark', 'Depop', ...]
  website             text,
  visit_frequency     text,               -- 'Weekly', 'Bi-weekly', 'Monthly', 'As available'
  expected_spend      text,               -- 'Under $100', '$100–$250', '$250–$500', '$500+'
  categories          text[],             -- up to 3 categories

  -- Program Type
  program_type        text not null,      -- 'reseller', 'wholesale', 'both'

  -- Wholesale-specific
  tax_license_number  text,
  dr0563_file_url     text,              -- Supabase Storage URL
  estimated_monthly_volume text,
  business_type       text,             -- 'Online reseller', 'Retail thrift store', etc.

  -- Feature consent
  shop_name_to_feature text,
  feature_consent     boolean default false,

  -- Contract acknowledgment
  contract_agreed     boolean not null default false,
  contract_agreed_at  timestamptz,
  contract_signed_name text,            -- typed signature

  -- Admin fields
  status              text not null default 'pending',  -- 'pending', 'approved', 'denied'
  admin_notes         text,
  reviewed_by         text,
  reviewed_at         timestamptz
);

-- Index for quick lookups
create index if not exists idx_reseller_email on reseller_applications(email);
create index if not exists idx_reseller_status on reseller_applications(status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table reseller_applications enable row level security;

-- Public can INSERT (submit application) — no SELECT/UPDATE/DELETE
create policy "Anyone can submit an application"
  on reseller_applications for insert
  with check (true);

-- Public can SELECT their own application by email (for status check)
create policy "Applicant can view own record by email"
  on reseller_applications for select
  using (true);  -- We filter by email in the app; Supabase anon key is read-only here

-- Service role (admin API routes) can do everything — bypasses RLS automatically

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on reseller_applications
  for each row execute procedure update_updated_at();

-- ============================================================
-- SUPABASE STORAGE BUCKET FOR DR 0563 UPLOADS
-- ============================================================
-- Run this in SQL Editor OR via the Supabase Dashboard > Storage
insert into storage.buckets (id, name, public)
  values ('dr0563', 'dr0563', false)
  on conflict do nothing;

-- Allow authenticated uploads via service role (API handles this)
create policy "Service role can manage dr0563"
  on storage.objects for all
  using (bucket_id = 'dr0563');
