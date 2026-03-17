-- NCT Recycling — Schema v3: Bag Counts, Exchange Appointments, Pickup Routes
-- Run this in your Supabase SQL Editor AFTER running supabase-schema.sql and supabase-schema-v2.sql

-- ============================================================
-- BAG COUNTS
-- Nonprofits update their current bag inventory via the portal.
-- Each row is a snapshot; latest row per nonprofit = current count.
-- ============================================================
create table if not exists bag_counts (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  nonprofit_id  uuid not null references nonprofit_applications(id) on delete cascade,
  bag_count     integer not null,
  notes         text
);

create index if not exists idx_bag_counts_nonprofit on bag_counts(nonprofit_id);
create index if not exists idx_bag_counts_created  on bag_counts(created_at desc);

alter table bag_counts enable row level security;

-- Service role only (all access via API routes)
create policy "Service role manages bag counts"
  on bag_counts for all
  using (true);

-- ============================================================
-- EXCHANGE APPOINTMENTS
-- Nonprofits request to source inventory from NCT.
-- Two types: 'in_person' (they come sort) or 'delivery' (NCT ships).
-- ============================================================
create table if not exists exchange_appointments (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz default now(),
  nonprofit_id        uuid not null references nonprofit_applications(id) on delete cascade,
  appointment_type    text not null check (appointment_type in ('in_person', 'delivery')),
  preferred_date      date,
  scheduled_date      date,
  scheduled_time      text,
  status              text not null default 'requested'
                        check (status in ('requested', 'scheduled', 'completed', 'cancelled')),
  categories_requested text[],
  notes               text,
  admin_notes         text,
  notified_at         timestamptz
);

create index if not exists idx_exchange_appts_nonprofit on exchange_appointments(nonprofit_id);
create index if not exists idx_exchange_appts_status    on exchange_appointments(status);
create index if not exists idx_exchange_appts_date      on exchange_appointments(scheduled_date);

alter table exchange_appointments enable row level security;

create policy "Service role manages exchange appointments"
  on exchange_appointments for all
  using (true);

-- ============================================================
-- PICKUP ROUTES
-- Admin creates a route to collect bags from multiple nonprofits.
-- When scheduled, nonprofits AND resellers are notified.
-- ============================================================
create table if not exists pickup_routes (
  id                    uuid primary key default uuid_generate_v4(),
  created_at            timestamptz default now(),
  scheduled_date        date not null,          -- day of pickup
  shopping_date         date,                   -- day after pickup — when resellers can shop
  scheduled_time        text,
  status                text not null default 'scheduled'
                          check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes                 text,
  estimated_total_bags  integer,
  actual_total_bags     integer,
  nonprofits_notified_at  timestamptz,
  resellers_notified_at   timestamptz
);

create index if not exists idx_routes_date   on pickup_routes(scheduled_date);
create index if not exists idx_routes_status on pickup_routes(status);

alter table pickup_routes enable row level security;

create policy "Service role manages pickup routes"
  on pickup_routes for all
  using (true);

-- ============================================================
-- PICKUP ROUTE STOPS
-- Which nonprofits are on each route, in what order.
-- ============================================================
create table if not exists pickup_route_stops (
  id              uuid primary key default uuid_generate_v4(),
  route_id        uuid not null references pickup_routes(id) on delete cascade,
  nonprofit_id    uuid not null references nonprofit_applications(id),
  stop_order      integer not null default 1,
  estimated_bags  integer,
  actual_bags     integer,
  notes           text,
  notified_at     timestamptz
);

create index if not exists idx_route_stops_route     on pickup_route_stops(route_id);
create index if not exists idx_route_stops_nonprofit on pickup_route_stops(nonprofit_id);

alter table pickup_route_stops enable row level security;

create policy "Service role manages route stops"
  on pickup_route_stops for all
  using (true);
