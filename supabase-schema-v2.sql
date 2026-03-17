-- NCT Recycling — Schema v2: Auth Profiles + Nonprofit Applications
-- Run this in your Supabase SQL Editor AFTER running supabase-schema.sql

-- ============================================================
-- PROFILES TABLE (links Supabase Auth users to their role/application)
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null,          -- 'reseller', 'nonprofit'
  application_id uuid,               -- references reseller_applications or nonprofit_applications
  created_at  timestamptz default now()
);

alter table profiles enable row level security;

-- Users can read their own profile
create policy "User can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Service role handles inserts/updates (from API routes)

-- ============================================================
-- NONPROFIT APPLICATIONS TABLE
-- ============================================================
create table if not exists nonprofit_applications (
  id                    uuid primary key default uuid_generate_v4(),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),

  -- Organization Info
  org_name              text not null,
  org_type              text,              -- 'nonprofit', 'charity', 'thrift store', 'other'
  ein                   text,              -- Federal EIN (tax ID)
  tax_exempt_status     text,              -- '501c3', 'other'
  irs_letter_url        text,              -- Supabase Storage URL for IRS determination letter

  -- Contact
  contact_name          text not null,
  contact_title         text,
  email                 text not null,
  phone                 text,
  website               text,

  -- Address
  address_street        text,
  address_city          text,
  address_state         text,
  address_zip           text,

  -- Pickup / Dock Info
  pickup_address        text,             -- if different from main address
  dock_instructions     text,             -- door codes, gate codes, access restrictions
  available_pickup_hours text,            -- e.g. "Mon-Fri 9am-5pm"
  pickup_notes          text,             -- additional access notes

  -- Program Preferences
  program_type          text not null,    -- 'onsite', 'remote', 'both'
  estimated_donation_lbs text,           -- estimated monthly donation volume
  categories_needed     text[],           -- what types of clothing they need

  -- Warehouse Access (on-site partners)
  onsite_contact        text,             -- who will visit the warehouse

  -- Charity Drive (remote partners)
  charity_drive_description text,        -- what drives/causes they run

  -- Agreement
  contract_agreed       boolean not null default false,
  contract_agreed_at    timestamptz,
  contract_signed_name  text,
  authorized_title      text,

  -- Feature consent
  feature_consent       boolean default false,

  -- Admin fields
  status                text not null default 'pending',
  admin_notes           text,
  reviewed_by           text,
  reviewed_at           timestamptz
);

create index if not exists idx_nonprofit_email on nonprofit_applications(email);
create index if not exists idx_nonprofit_status on nonprofit_applications(status);

alter table nonprofit_applications enable row level security;

create policy "Anyone can submit nonprofit application"
  on nonprofit_applications for insert
  with check (true);

create policy "Nonprofit can view own record"
  on nonprofit_applications for select
  using (true);

-- Auto-update updated_at
create trigger set_nonprofit_updated_at
  before update on nonprofit_applications
  for each row execute procedure update_updated_at();

-- ============================================================
-- TAX RECEIPT UPLOADS (for nonprofit portal)
-- ============================================================
create table if not exists tax_receipts (
  id                uuid primary key default uuid_generate_v4(),
  created_at        timestamptz default now(),
  application_id    uuid references nonprofit_applications(id),
  file_url          text not null,
  piece_count       integer,
  total_value       numeric(10,2),    -- piece_count * 5.00
  notes             text,
  uploaded_by       uuid references auth.users(id)
);

alter table tax_receipts enable row level security;

create policy "Nonprofit can view own receipts"
  on tax_receipts for select
  using (true);

-- ============================================================
-- STORAGE BUCKET FOR NONPROFIT DOCUMENTS
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('nonprofit-docs', 'nonprofit-docs', false)
  on conflict do nothing;
