-- NCT Recycling — Schema v4: Shopping Days & Reseller Slot Bookings
-- Run this in your Supabase SQL Editor AFTER running v1, v2, and v3.
--
-- Business logic:
--   Pickup route scheduled for Day X → shopping_day auto-created for Day X+1
--   Wholesale: 10am–12pm, 5 spots (resellers buy unopened bags at $0.30/lb, sort on-site)
--   Bins:      12pm–4pm,  5 spots (restocked from wholesale discards, $2/lb)
--   Boutique:  10am–4pm,  always open, no booking needed
--
-- The 2-hour gap (wholesale ends 12pm, bins open 12pm) is intentional:
--   NCT clears bins and restocks them with wholesale sort discards before bins open.

-- ============================================================
-- SHOPPING DAYS
-- One record per pickup route. Auto-created when a route is saved.
-- ============================================================
create table if not exists shopping_days (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  route_id      uuid not null references pickup_routes(id) on delete cascade,
  shopping_date date not null,
  status        text not null default 'open'
                  check (status in ('open', 'closed', 'cancelled'))
);

create index if not exists idx_shopping_days_date   on shopping_days(shopping_date);
create index if not exists idx_shopping_days_status on shopping_days(status);
create index if not exists idx_shopping_days_route  on shopping_days(route_id);

alter table shopping_days enable row level security;

create policy "Service role manages shopping days"
  on shopping_days for all using (true);

-- ============================================================
-- SHOPPING BOOKINGS
-- Resellers claim wholesale or bins slots; nonprofits claim nonprofit_bins slots.
-- Capacity enforced in API:
--   wholesale      → max 5  (resellers, 10am–12pm, $0.30/lb)
--   bins           → max 5  (resellers, 12pm–4pm,  $2.00/lb)
--   nonprofit_bins → max 2  (nonprofits, 12pm–4pm, no charge)
-- One of reseller_id or nonprofit_id must be set depending on slot_type.
-- ============================================================
create table if not exists shopping_bookings (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  shopping_day_id uuid not null references shopping_days(id) on delete cascade,
  reseller_id     uuid references reseller_applications(id),
  nonprofit_id    uuid references nonprofit_applications(id),
  slot_type       text not null check (slot_type in ('wholesale', 'bins', 'nonprofit_bins')),
  status          text not null default 'confirmed'
                    check (status in ('confirmed', 'cancelled')),
  notes           text,
  -- Prevent double-booking same slot type on same day for same org
  unique (shopping_day_id, reseller_id,  slot_type),
  unique (shopping_day_id, nonprofit_id, slot_type)
);

create index if not exists idx_bookings_day      on shopping_bookings(shopping_day_id);
create index if not exists idx_bookings_reseller on shopping_bookings(reseller_id);
create index if not exists idx_bookings_status   on shopping_bookings(status);

alter table shopping_bookings enable row level security;

create policy "Service role manages shopping bookings"
  on shopping_bookings for all using (true);
