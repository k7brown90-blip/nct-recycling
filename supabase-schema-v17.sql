-- =====================================================
-- NCT Recycling — Schema v17
-- Canonical organization-domain schema for phased cutover
-- =====================================================
-- Scope:
--   - Adds canonical co-op + discard organization tables
--   - Leaves reseller schema independent
--   - Adds migration crosswalk tables for idempotent backfills
-- =====================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =====================================================
-- USER PROFILES
-- =====================================================
create table if not exists portal_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text,
  email text,
  phone text,
  default_portal text not null default 'organization'
    check (default_portal in ('organization', 'reseller', 'admin')),
  is_nct_admin boolean not null default false
);

create trigger set_portal_user_profiles_updated_at
before update on portal_user_profiles
for each row execute procedure update_updated_at();

-- =====================================================
-- ORGANIZATIONS
-- =====================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  legal_name text not null,
  display_name text,
  org_type text,
  status text not null default 'active'
    check (status in ('draft', 'active', 'inactive', 'terminated')),
  website text,
  ein text,
  tax_exempt_status text,
  main_email text,
  main_phone text,
  address_street text,
  address_city text,
  address_state text,
  address_zip text,
  pickup_address text,
  pickup_city text,
  pickup_state text,
  pickup_zip text,
  pickup_access_notes text,
  dock_instructions text,
  available_pickup_hours text,
  internal_notes text
);

create index if not exists idx_organizations_status on organizations(status);
create index if not exists idx_organizations_legal_name on organizations(legal_name);

create trigger set_organizations_updated_at
before update on organizations
for each row execute procedure update_updated_at();

-- =====================================================
-- ORGANIZATION MEMBERSHIPS
-- =====================================================
create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null
    check (membership_role in ('primary_admin', 'admin', 'staff', 'viewer')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'inactive', 'revoked')),
  invited_at timestamptz,
  accepted_at timestamptz,
  unique (organization_id, user_id)
);

create index if not exists idx_organization_memberships_org on organization_memberships(organization_id);
create index if not exists idx_organization_memberships_user on organization_memberships(user_id);

create trigger set_organization_memberships_updated_at
before update on organization_memberships
for each row execute procedure update_updated_at();

-- =====================================================
-- PROGRAM ENROLLMENTS
-- =====================================================
create table if not exists organization_program_enrollments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  program_type text not null
    check (program_type in ('co_op', 'discard')),
  onboarding_source text not null
    check (onboarding_source in ('public_application', 'admin_created', 'conversion')),
  lifecycle_status text not null default 'draft'
    check (lifecycle_status in (
      'draft',
      'invited',
      'pending_review',
      'pending_partner_finalization',
      'active',
      'inactive',
      'denied',
      'terminated'
    )),
  is_current boolean not null default true,
  applied_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  activated_at timestamptz,
  ended_at timestamptz,
  reviewed_by uuid references auth.users(id),
  admin_notes text,
  partner_notes text
);

create unique index if not exists idx_org_program_enrollments_current
  on organization_program_enrollments(organization_id)
  where is_current = true;

create index if not exists idx_org_program_enrollments_type
  on organization_program_enrollments(program_type, lifecycle_status);

create trigger set_organization_program_enrollments_updated_at
before update on organization_program_enrollments
for each row execute procedure update_updated_at();

create table if not exists co_op_program_details (
  enrollment_id uuid primary key references organization_program_enrollments(id) on delete cascade,
  account_type text not null default 'ltl'
    check (account_type in ('ltl', 'fl')),
  categories_needed text[],
  onsite_contact text,
  charity_drive_description text,
  feature_consent boolean not null default false,
  requires_501c3 boolean not null default true,
  pickup_frequency_target text
    check (pickup_frequency_target in ('weekly', 'biweekly', 'monthly', 'adhoc')),
  minimum_pickup_lbs integer not null default 1000,
  independent_run_min_lbs integer not null default 4000,
  tax_receipt_required boolean not null default true,
  exchange_access_enabled boolean not null default true,
  nonprofit_bins_enabled boolean not null default true,
  default_estimated_bags integer,
  storage_capacity_bags integer not null default 40
);

create table if not exists discard_program_details (
  enrollment_id uuid primary key references organization_program_enrollments(id) on delete cascade,
  account_type text not null default 'ltl'
    check (account_type in ('ltl', 'fl')),
  pickup_frequency text not null default 'weekly'
    check (pickup_frequency in ('weekly', 'biweekly', 'monthly', 'adhoc')),
  projected_lbs_week integer,
  negotiated_rate_per_1000_lbs numeric(10,2),
  flat_rate_per_pickup numeric(10,2),
  min_lbs_weekly integer,
  min_lbs_biweekly integer,
  min_lbs_monthly integer,
  min_lbs_adhoc integer,
  payment_method_terms text,
  initial_term_months integer not null default 12,
  termination_notice_days integer not null default 60,
  accepted_material_notes text,
  prohibited_material_notes text,
  credential_donations_allowed boolean not null default true,
  storage_capacity_bags integer not null default 40,
  agreement_generated_by uuid references auth.users(id),
  agreement_generated_at timestamptz
);

-- =====================================================
-- DOCUMENTS AND AGREEMENTS
-- =====================================================
create table if not exists organization_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  enrollment_id uuid references organization_program_enrollments(id) on delete set null,
  document_type text not null
    check (document_type in (
      'irs_letter',
      'signed_agreement',
      'tax_receipt',
      'supporting_attachment',
      'admin_generated_packet'
    )),
  status text not null default 'active'
    check (status in ('draft', 'active', 'superseded', 'archived')),
  storage_bucket text,
  storage_path text,
  original_filename text,
  mime_type text,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_organization_documents_org
  on organization_documents(organization_id, document_type, status);

create trigger set_organization_documents_updated_at
before update on organization_documents
for each row execute procedure update_updated_at();

create table if not exists agreement_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  program_type text not null
    check (program_type in ('co_op', 'discard')),
  template_slug text not null,
  version_label text not null,
  title text not null,
  body_text text not null,
  is_active boolean not null default true,
  unique (program_type, template_slug, version_label)
);

create index if not exists idx_agreement_templates_active
  on agreement_templates(program_type, is_active);

create trigger set_agreement_templates_updated_at
before update on agreement_templates
for each row execute procedure update_updated_at();

create table if not exists agreement_packets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  enrollment_id uuid not null references organization_program_enrollments(id) on delete cascade,
  template_id uuid not null references agreement_templates(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'signed', 'voided')),
  generated_from jsonb not null default '{}'::jsonb,
  rendered_body text not null,
  generated_pdf_document_id uuid references organization_documents(id),
  signed_pdf_document_id uuid references organization_documents(id),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  voided_at timestamptz,
  void_reason text
);

create index if not exists idx_agreement_packets_enrollment
  on agreement_packets(enrollment_id, status);

create trigger set_agreement_packets_updated_at
before update on agreement_packets
for each row execute procedure update_updated_at();

create table if not exists agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  agreement_packet_id uuid not null references agreement_packets(id) on delete cascade,
  signed_by_user_id uuid references auth.users(id),
  signer_name text not null,
  signer_title text,
  signer_email text,
  signature_method text not null default 'typed_acceptance'
    check (signature_method in ('typed_acceptance', 'admin_recorded')),
  ip_address inet,
  user_agent text,
  accepted_terms boolean not null default true,
  signed_at timestamptz not null default now()
);

create index if not exists idx_agreement_signatures_packet
  on agreement_signatures(agreement_packet_id);

-- =====================================================
-- OPERATIONS
-- =====================================================
create table if not exists inventory_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  enrollment_id uuid not null references organization_program_enrollments(id) on delete cascade,
  event_type text not null
    check (event_type in ('reported_add', 'pickup_collected', 'adjustment', 'reset')),
  quantity_bags integer,
  estimated_weight_lbs numeric,
  fill_level text
    check (fill_level in ('half', 'full', 'overflowing')),
  notes text,
  recorded_by uuid references auth.users(id)
);

create index if not exists idx_inventory_events_org
  on inventory_events(organization_id, created_at desc);
create index if not exists idx_inventory_events_enrollment
  on inventory_events(enrollment_id, event_type, created_at desc);

create table if not exists pickup_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  enrollment_id uuid not null references organization_program_enrollments(id) on delete cascade,
  request_channel text not null default 'partner_portal'
    check (request_channel in ('partner_portal', 'admin_created', 'system_generated')),
  request_type text not null
    check (request_type in ('ltl_pickup', 'full_load_pickup', 'schedule_change')),
  preferred_date date,
  scheduled_date date,
  estimated_bags integer,
  estimated_weight_lbs numeric,
  fill_level text
    check (fill_level in ('half', 'full', 'overflowing')),
  notes text,
  admin_notes text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'scheduled', 'completed', 'cancelled', 'declined')),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id)
);

create index if not exists idx_pickup_requests_org
  on pickup_requests(organization_id, status, created_at desc);
create index if not exists idx_pickup_requests_enrollment
  on pickup_requests(enrollment_id, request_type, status);

create trigger set_pickup_requests_updated_at
before update on pickup_requests
for each row execute procedure update_updated_at();

create table if not exists pickup_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  run_type text not null
    check (run_type in ('route', 'single_run')),
  scheduled_date date not null,
  scheduled_time text,
  shopping_date date,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  completion_type text
    check (completion_type in ('full', 'partial')),
  notes text,
  nonprofits_notified_at timestamptz,
  resellers_notified_at timestamptz
);

create index if not exists idx_pickup_runs_schedule
  on pickup_runs(scheduled_date, status);

create trigger set_pickup_runs_updated_at
before update on pickup_runs
for each row execute procedure update_updated_at();

create table if not exists pickup_run_stops (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pickup_run_id uuid not null references pickup_runs(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  enrollment_id uuid not null references organization_program_enrollments(id) on delete cascade,
  pickup_request_id uuid references pickup_requests(id) on delete set null,
  stop_order integer,
  estimated_bags integer,
  actual_bags integer,
  actual_weight_lbs numeric,
  no_inventory boolean not null default false,
  stop_status text not null default 'pending'
    check (stop_status in ('pending', 'completed', 'skipped')),
  scheduled_window text,
  completed_at timestamptz,
  notes text
);

create index if not exists idx_pickup_run_stops_run
  on pickup_run_stops(pickup_run_id, stop_order);
create index if not exists idx_pickup_run_stops_org
  on pickup_run_stops(organization_id, stop_status);

create trigger set_pickup_run_stops_updated_at
before update on pickup_run_stops
for each row execute procedure update_updated_at();

create table if not exists pickup_payouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pickup_run_stop_id uuid not null unique references pickup_run_stops(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  enrollment_id uuid not null references organization_program_enrollments(id) on delete cascade,
  amount_owed numeric(10,2) not null default 0,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'voided')),
  payment_method text,
  payment_date date,
  calculated_from jsonb not null default '{}'::jsonb,
  notes text
);

create index if not exists idx_pickup_payouts_org
  on pickup_payouts(organization_id, payment_status, payment_date);

create table if not exists exchange_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  enrollment_id uuid not null references organization_program_enrollments(id) on delete cascade,
  request_mode text not null
    check (request_mode in ('in_person', 'delivery')),
  preferred_date date,
  scheduled_date date,
  scheduled_time text,
  categories_requested text[],
  estimated_bags integer,
  ship_to_address text,
  notes text,
  admin_notes text,
  labor_cost numeric(10,2),
  shipping_cost numeric(10,2),
  quote_status text
    check (quote_status in ('quoted', 'confirmed', 'declined')),
  status text not null default 'requested'
    check (status in ('requested', 'scheduled', 'completed', 'cancelled')),
  quote_sent_at timestamptz,
  notified_at timestamptz
);

create index if not exists idx_exchange_requests_org
  on exchange_requests(organization_id, status, preferred_date);

create trigger set_exchange_requests_updated_at
before update on exchange_requests
for each row execute procedure update_updated_at();

create table if not exists donation_lots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  enrollment_id uuid not null references organization_program_enrollments(id) on delete cascade,
  source_type text not null
    check (source_type in ('exchange_request', 'shopping_day', 'admin_manual')),
  source_id uuid,
  lot_date date not null,
  piece_count integer,
  estimated_value numeric(10,2),
  notes text
);

create index if not exists idx_donation_lots_org
  on donation_lots(organization_id, lot_date desc);

create trigger set_donation_lots_updated_at
before update on donation_lots
for each row execute procedure update_updated_at();

create table if not exists canonical_tax_receipts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  donation_lot_id uuid not null references donation_lots(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  receipt_status text not null default 'pending_receipt'
    check (receipt_status in ('pending_receipt', 'uploaded', 'approved', 'rejected')),
  receipt_document_id uuid references organization_documents(id),
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  notes text
);

create index if not exists idx_canonical_tax_receipts_org
  on canonical_tax_receipts(organization_id, receipt_status);
create unique index if not exists idx_canonical_tax_receipts_one_per_lot
  on canonical_tax_receipts(donation_lot_id);

create trigger set_canonical_tax_receipts_updated_at
before update on canonical_tax_receipts
for each row execute procedure update_updated_at();

create table if not exists canonical_shopping_days (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_pickup_run_id uuid references pickup_runs(id) on delete set null,
  shopping_date date not null unique,
  status text not null default 'open'
    check (status in ('open', 'closed', 'cancelled')),
  nonprofit_bins_capacity integer,
  admin_notes text
);

create index if not exists idx_canonical_shopping_days_date
  on canonical_shopping_days(shopping_date, status);

create trigger set_canonical_shopping_days_updated_at
before update on canonical_shopping_days
for each row execute procedure update_updated_at();

create table if not exists organization_shopping_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  canonical_shopping_day_id uuid not null references canonical_shopping_days(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  enrollment_id uuid not null references organization_program_enrollments(id) on delete cascade,
  slot_type text not null default 'nonprofit_bins'
    check (slot_type in ('nonprofit_bins')),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),
  notes text,
  unique (canonical_shopping_day_id, organization_id, slot_type)
);

create index if not exists idx_organization_shopping_bookings_day
  on organization_shopping_bookings(canonical_shopping_day_id, status);

-- =====================================================
-- MIGRATION CROSSWALK TABLES
-- =====================================================
create table if not exists migration_organization_map (
  source_table text not null,
  source_id uuid not null,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_table, source_id)
);

create table if not exists migration_enrollment_map (
  source_table text not null,
  source_id uuid not null,
  enrollment_id uuid not null references organization_program_enrollments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_table, source_id)
);

create table if not exists migration_pickup_run_map (
  source_table text not null,
  source_id uuid not null,
  pickup_run_id uuid not null references pickup_runs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_table, source_id)
);

create table if not exists migration_shopping_day_map (
  source_table text not null,
  source_id uuid not null,
  canonical_shopping_day_id uuid not null references canonical_shopping_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_table, source_id)
);

-- =====================================================
-- RLS (service-role first during phased cutover)
-- =====================================================
alter table portal_user_profiles enable row level security;
alter table organizations enable row level security;
alter table organization_memberships enable row level security;
alter table organization_program_enrollments enable row level security;
alter table co_op_program_details enable row level security;
alter table discard_program_details enable row level security;
alter table organization_documents enable row level security;
alter table agreement_templates enable row level security;
alter table agreement_packets enable row level security;
alter table agreement_signatures enable row level security;
alter table inventory_events enable row level security;
alter table pickup_requests enable row level security;
alter table pickup_runs enable row level security;
alter table pickup_run_stops enable row level security;
alter table pickup_payouts enable row level security;
alter table exchange_requests enable row level security;
alter table donation_lots enable row level security;
alter table canonical_tax_receipts enable row level security;
alter table canonical_shopping_days enable row level security;
alter table organization_shopping_bookings enable row level security;
