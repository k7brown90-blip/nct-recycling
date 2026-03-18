-- =====================================================
-- NCT Recycling — Schema v8
-- Run in Supabase SQL Editor
-- =====================================================
-- Discard Purchase Accounts and Pickup Log
-- Admin-only, not exposed on the public website
-- =====================================================

-- Discard purchase accounts (organizations that sell discard instead of co-op)
create table if not exists discard_accounts (
  id                  uuid        default gen_random_uuid() primary key,
  org_name            text        not null,
  address_street      text,
  address_city        text,
  address_state       text,
  address_zip         text,
  contact_name        text,
  contact_email       text,
  contact_phone       text,
  pickup_frequency    text        not null default 'weekly',  -- weekly, biweekly, adhoc
  rate_per_1000_lbs   numeric     not null default 20,        -- $ per 1,000 lbs
  min_lbs_weekly      integer     not null default 1000,      -- min for weekly recurring
  min_lbs_biweekly    integer     not null default 2500,      -- min for bi-weekly recurring
  min_lbs_adhoc       integer     not null default 5000,      -- min for single-run / ad hoc
  projected_lbs_week  integer,                               -- estimated weekly volume
  contract_date       date,
  notes               text,
  status              text        not null default 'active',  -- active, inactive
  created_at          timestamptz not null default now()
);

alter table discard_accounts
  drop constraint if exists discard_accounts_frequency_check;
alter table discard_accounts
  add constraint discard_accounts_frequency_check
  check (pickup_frequency in ('weekly', 'biweekly', 'adhoc'));

alter table discard_accounts
  drop constraint if exists discard_accounts_status_check;
alter table discard_accounts
  add constraint discard_accounts_status_check
  check (status in ('active', 'inactive'));

-- Discard pickup log — each completed or attempted pickup
create table if not exists discard_pickups (
  id                  uuid        default gen_random_uuid() primary key,
  account_id          uuid        not null references discard_accounts(id) on delete cascade,
  pickup_date         date        not null,
  pickup_time         text,
  weight_lbs          numeric     not null,
  load_type           text        not null default 'recurring', -- recurring, single_run
  amount_owed         numeric     not null default 0,           -- calculated at log time
  payment_status      text        not null default 'pending',   -- pending, paid, voided
  payment_method      text,                                     -- check, ach, cash, etc.
  payment_date        date,
  accepted            boolean     not null default true,
  rejection_reason    text,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table discard_pickups
  drop constraint if exists discard_pickups_load_type_check;
alter table discard_pickups
  add constraint discard_pickups_load_type_check
  check (load_type in ('recurring', 'single_run'));

alter table discard_pickups
  drop constraint if exists discard_pickups_payment_status_check;
alter table discard_pickups
  add constraint discard_pickups_payment_status_check
  check (payment_status in ('pending', 'paid', 'voided'));

-- Indexes
create index if not exists discard_pickups_account_id_idx  on discard_pickups(account_id);
create index if not exists discard_pickups_pickup_date_idx on discard_pickups(pickup_date desc);
create index if not exists discard_pickups_payment_status_idx on discard_pickups(payment_status);

-- RLS (service role used by API routes bypasses this)
alter table discard_accounts enable row level security;
alter table discard_pickups  enable row level security;
