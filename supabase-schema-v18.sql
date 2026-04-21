-- =====================================================
-- NCT Recycling — Schema v18
-- First-wave backfill into canonical organization-domain tables
-- =====================================================
-- Safe intent:
--   - Inserts only into new canonical tables
--   - Uses crosswalk tables to remain idempotent
--   - Does not drop or mutate legacy organization-side tables
-- =====================================================

create table if not exists migration_pickup_request_map (
  source_table text not null,
  source_id uuid not null,
  pickup_request_id uuid not null references pickup_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_table, source_id)
);

create table if not exists migration_exchange_request_map (
  source_table text not null,
  source_id uuid not null,
  exchange_request_id uuid not null references exchange_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_table, source_id)
);

create table if not exists migration_donation_lot_map (
  source_table text not null,
  source_id uuid not null,
  donation_lot_id uuid not null references donation_lots(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source_table, source_id)
);

-- =====================================================
-- PORTAL USER PROFILES
-- =====================================================
insert into portal_user_profiles (
  id,
  created_at,
  updated_at,
  email,
  default_portal,
  is_nct_admin
)
select
  p.id,
  coalesce(p.created_at, now()),
  now(),
  u.email,
  case
    when p.role = 'reseller' then 'reseller'
    else 'organization'
  end,
  false
from profiles p
left join auth.users u on u.id = p.id
on conflict (id) do update
set email = coalesce(portal_user_profiles.email, excluded.email);

-- =====================================================
-- ORGANIZATIONS FROM NONPROFIT APPLICATIONS
-- =====================================================
do $$
declare
  rec record;
  new_org_id uuid;
  mapped_org_id uuid;
begin
  for rec in
    select *
    from nonprofit_applications n
    where not exists (
      select 1
      from migration_organization_map m
      where m.source_table = 'nonprofit_applications'
        and m.source_id = n.id
    )
  loop
    insert into organizations (
      created_at,
      updated_at,
      legal_name,
      display_name,
      org_type,
      status,
      website,
      ein,
      tax_exempt_status,
      main_email,
      main_phone,
      address_street,
      address_city,
      address_state,
      address_zip,
      pickup_address,
      pickup_city,
      pickup_state,
      pickup_zip,
      pickup_access_notes,
      dock_instructions,
      available_pickup_hours,
      internal_notes
    ) values (
      coalesce(rec.created_at, now()),
      coalesce(rec.updated_at, rec.created_at, now()),
      rec.org_name,
      rec.org_name,
      rec.org_type,
      case
        when rec.status = 'approved' then 'active'
        when rec.status = 'denied' then 'inactive'
        else 'draft'
      end,
      rec.website,
      rec.ein,
      rec.tax_exempt_status,
      rec.email,
      rec.phone,
      rec.address_street,
      rec.address_city,
      rec.address_state,
      rec.address_zip,
      coalesce(rec.pickup_address, rec.address_street),
      rec.address_city,
      rec.address_state,
      rec.address_zip,
      rec.pickup_notes,
      rec.dock_instructions,
      rec.available_pickup_hours,
      null
    ) returning id into new_org_id;

    insert into migration_organization_map (source_table, source_id, organization_id)
    values ('nonprofit_applications', rec.id, new_org_id);
  end loop;
end $$;

-- =====================================================
-- ORGANIZATIONS FROM DISCARD ACCOUNTS
-- =====================================================
do $$
declare
  rec record;
  new_org_id uuid;
begin
  for rec in
    select *
    from discard_accounts d
    where not exists (
      select 1
      from migration_organization_map m
      where m.source_table = 'discard_accounts'
        and m.source_id = d.id
    )
  loop
    insert into organizations (
      created_at,
      updated_at,
      legal_name,
      display_name,
      org_type,
      status,
      main_email,
      main_phone,
      address_street,
      address_city,
      address_state,
      address_zip,
      pickup_address,
      pickup_city,
      pickup_state,
      pickup_zip,
      internal_notes
    ) values (
      coalesce(rec.created_at, now()),
      coalesce(rec.created_at, now()),
      rec.org_name,
      rec.org_name,
      'organization',
      case
        when rec.status = 'inactive' then 'inactive'
        else 'active'
      end,
      rec.contact_email,
      rec.contact_phone,
      rec.address_street,
      rec.address_city,
      rec.address_state,
      rec.address_zip,
      rec.address_street,
      rec.address_city,
      rec.address_state,
      rec.address_zip,
      rec.notes
    ) returning id into new_org_id;

    insert into migration_organization_map (source_table, source_id, organization_id)
    values ('discard_accounts', rec.id, new_org_id);
  end loop;
end $$;

-- =====================================================
-- PROGRAM ENROLLMENTS + CO-OP DETAILS
-- =====================================================
do $$
declare
  rec record;
  org_id uuid;
  new_enrollment_id uuid;
  note_text text;
begin
  for rec in
    select n.*
    from nonprofit_applications n
    where not exists (
      select 1
      from migration_enrollment_map m
      where m.source_table = 'nonprofit_applications'
        and m.source_id = n.id
    )
  loop
    select m.organization_id
    into org_id
    from migration_organization_map m
    where m.source_table = 'nonprofit_applications'
      and m.source_id = rec.id;

    note_text := concat_ws(E'\n', nullif(rec.admin_notes, ''), case when rec.reviewed_by is not null then 'Legacy reviewed_by: ' || rec.reviewed_by else null end);

    insert into organization_program_enrollments (
      created_at,
      updated_at,
      organization_id,
      program_type,
      onboarding_source,
      lifecycle_status,
      is_current,
      applied_at,
      submitted_at,
      reviewed_at,
      activated_at,
      admin_notes
    ) values (
      coalesce(rec.created_at, now()),
      coalesce(rec.updated_at, rec.created_at, now()),
      org_id,
      'co_op',
      'public_application',
      case
        when rec.status = 'approved' then 'active'
        when rec.status = 'denied' then 'denied'
        else 'pending_review'
      end,
      true,
      rec.created_at,
      rec.created_at,
      rec.reviewed_at,
      case when rec.status = 'approved' then coalesce(rec.reviewed_at, rec.updated_at, rec.created_at) else null end,
      note_text
    ) returning id into new_enrollment_id;

    insert into migration_enrollment_map (source_table, source_id, enrollment_id)
    values ('nonprofit_applications', rec.id, new_enrollment_id);

    insert into co_op_program_details (
      enrollment_id,
      account_type,
      categories_needed,
      onsite_contact,
      charity_drive_description,
      feature_consent,
      default_estimated_bags,
      storage_capacity_bags
    ) values (
      new_enrollment_id,
      coalesce(rec.account_type, 'ltl'),
      rec.categories_needed,
      rec.onsite_contact,
      rec.charity_drive_description,
      coalesce(rec.feature_consent, false),
      rec.estimated_bags,
      coalesce(rec.storage_capacity_bags, 40)
    );
  end loop;
end $$;

-- =====================================================
-- PROGRAM ENROLLMENTS + DISCARD DETAILS
-- =====================================================
do $$
declare
  rec record;
  org_id uuid;
  new_enrollment_id uuid;
begin
  for rec in
    select d.*
    from discard_accounts d
    where not exists (
      select 1
      from migration_enrollment_map m
      where m.source_table = 'discard_accounts'
        and m.source_id = d.id
    )
  loop
    select m.organization_id
    into org_id
    from migration_organization_map m
    where m.source_table = 'discard_accounts'
      and m.source_id = rec.id;

    insert into organization_program_enrollments (
      created_at,
      updated_at,
      organization_id,
      program_type,
      onboarding_source,
      lifecycle_status,
      is_current,
      applied_at,
      submitted_at,
      activated_at,
      admin_notes
    ) values (
      coalesce(rec.created_at, now()),
      coalesce(rec.created_at, now()),
      org_id,
      'discard',
      'admin_created',
      case
        when rec.status = 'inactive' then 'inactive'
        else 'active'
      end,
      true,
      rec.created_at,
      rec.created_at,
      case when rec.status = 'active' then rec.created_at else null end,
      rec.notes
    ) returning id into new_enrollment_id;

    insert into migration_enrollment_map (source_table, source_id, enrollment_id)
    values ('discard_accounts', rec.id, new_enrollment_id);

    insert into discard_program_details (
      enrollment_id,
      account_type,
      pickup_frequency,
      projected_lbs_week,
      negotiated_rate_per_1000_lbs,
      flat_rate_per_pickup,
      min_lbs_weekly,
      min_lbs_biweekly,
      min_lbs_adhoc,
      storage_capacity_bags,
      agreement_generated_at
    ) values (
      new_enrollment_id,
      coalesce(rec.account_type, 'ltl'),
      rec.pickup_frequency,
      rec.projected_lbs_week,
      rec.rate_per_1000_lbs,
      rec.flat_rate_per_pickup,
      rec.min_lbs_weekly,
      rec.min_lbs_biweekly,
      rec.min_lbs_adhoc,
      coalesce(rec.storage_capacity_bags, 40),
      rec.contract_date
    );
  end loop;
end $$;

-- =====================================================
-- IRS LETTERS INTO ORGANIZATION DOCUMENTS
-- =====================================================
insert into organization_documents (
  organization_id,
  enrollment_id,
  document_type,
  status,
  storage_bucket,
  storage_path,
  metadata
)
select
  org_map.organization_id,
  enr_map.enrollment_id,
  'irs_letter',
  'active',
  'nonprofit-docs',
  n.irs_letter_url,
  jsonb_build_object('legacy_source_table', 'nonprofit_applications', 'legacy_source_id', n.id, 'legacy_url', n.irs_letter_url)
from nonprofit_applications n
join migration_organization_map org_map
  on org_map.source_table = 'nonprofit_applications'
 and org_map.source_id = n.id
join migration_enrollment_map enr_map
  on enr_map.source_table = 'nonprofit_applications'
 and enr_map.source_id = n.id
where n.irs_letter_url is not null
  and not exists (
    select 1
    from organization_documents d
    where d.organization_id = org_map.organization_id
      and d.document_type = 'irs_letter'
      and d.storage_path = n.irs_letter_url
  );

-- =====================================================
-- MEMBERSHIPS FROM PROFILES
-- =====================================================
insert into organization_memberships (
  organization_id,
  user_id,
  membership_role,
  status,
  accepted_at
)
select distinct
  org_map.organization_id,
  p.id,
  'primary_admin',
  'active',
  now()
from profiles p
join migration_organization_map org_map
  on org_map.source_table = 'nonprofit_applications'
 and org_map.source_id = p.application_id
where p.role in ('nonprofit', 'both')
on conflict (organization_id, user_id) do nothing;

insert into organization_memberships (
  organization_id,
  user_id,
  membership_role,
  status,
  accepted_at
)
select distinct
  org_map.organization_id,
  p.id,
  'primary_admin',
  'active',
  now()
from profiles p
join migration_organization_map org_map
  on org_map.source_table = 'discard_accounts'
 and org_map.source_id = p.discard_account_id
where p.role in ('discard', 'both')
on conflict (organization_id, user_id) do nothing;

insert into organization_memberships (
  organization_id,
  user_id,
  membership_role,
  status,
  accepted_at
)
select distinct
  org_map.organization_id,
  d.user_id,
  'primary_admin',
  'active',
  now()
from discard_accounts d
join migration_organization_map org_map
  on org_map.source_table = 'discard_accounts'
 and org_map.source_id = d.id
where d.user_id is not null
on conflict (organization_id, user_id) do nothing;

-- =====================================================
-- INVENTORY EVENTS
-- =====================================================
insert into inventory_events (
  created_at,
  organization_id,
  enrollment_id,
  event_type,
  quantity_bags,
  notes
)
select
  b.created_at,
  org_map.organization_id,
  enr_map.enrollment_id,
  case when b.entry_type = 'pickup' then 'pickup_collected' else 'reported_add' end,
  b.bag_count,
  b.notes
from bag_counts b
join migration_organization_map org_map
  on org_map.source_table = 'nonprofit_applications'
 and org_map.source_id = b.nonprofit_id
join migration_enrollment_map enr_map
  on enr_map.source_table = 'nonprofit_applications'
 and enr_map.source_id = b.nonprofit_id
where not exists (
  select 1
  from inventory_events ie
  where ie.organization_id = org_map.organization_id
    and ie.enrollment_id = enr_map.enrollment_id
    and ie.created_at = b.created_at
    and ie.event_type = case when b.entry_type = 'pickup' then 'pickup_collected' else 'reported_add' end
    and coalesce(ie.quantity_bags, -1) = coalesce(b.bag_count, -1)
);

insert into inventory_events (
  created_at,
  organization_id,
  enrollment_id,
  event_type,
  quantity_bags,
  notes
)
select
  b.created_at,
  org_map.organization_id,
  enr_map.enrollment_id,
  case when b.entry_type = 'pickup' then 'pickup_collected' else 'reported_add' end,
  b.bag_count,
  b.notes
from discard_bag_counts b
join migration_organization_map org_map
  on org_map.source_table = 'discard_accounts'
 and org_map.source_id = b.discard_account_id
join migration_enrollment_map enr_map
  on enr_map.source_table = 'discard_accounts'
 and enr_map.source_id = b.discard_account_id
where not exists (
  select 1
  from inventory_events ie
  where ie.organization_id = org_map.organization_id
    and ie.enrollment_id = enr_map.enrollment_id
    and ie.created_at = b.created_at
    and ie.event_type = case when b.entry_type = 'pickup' then 'pickup_collected' else 'reported_add' end
    and coalesce(ie.quantity_bags, -1) = coalesce(b.bag_count, -1)
);

-- =====================================================
-- PICKUP REQUESTS
-- =====================================================
do $$
declare
  rec record;
  org_id uuid;
  enr_id uuid;
  new_request_id uuid;
begin
  for rec in
    select *
    from nonprofit_pickup_requests r
    where not exists (
      select 1 from migration_pickup_request_map m
      where m.source_table = 'nonprofit_pickup_requests'
        and m.source_id = r.id
    )
  loop
    select organization_id into org_id
    from migration_organization_map
    where source_table = 'nonprofit_applications'
      and source_id = rec.nonprofit_id;

    select enrollment_id into enr_id
    from migration_enrollment_map
    where source_table = 'nonprofit_applications'
      and source_id = rec.nonprofit_id;

    if org_id is not null and enr_id is not null then
      insert into pickup_requests (
        created_at,
        updated_at,
        organization_id,
        enrollment_id,
        request_channel,
        request_type,
        preferred_date,
        estimated_bags,
        estimated_weight_lbs,
        fill_level,
        notes,
        status
      ) values (
        rec.created_at,
        rec.created_at,
        org_id,
        enr_id,
        'partner_portal',
        'ltl_pickup',
        rec.preferred_date,
        rec.estimated_bags,
        rec.estimated_weight_lbs,
        rec.fill_level,
        rec.notes,
        rec.status
      ) returning id into new_request_id;

      insert into migration_pickup_request_map (source_table, source_id, pickup_request_id)
      values ('nonprofit_pickup_requests', rec.id, new_request_id);
    end if;
  end loop;
end $$;

do $$
declare
  rec record;
  org_id uuid;
  enr_id uuid;
  new_request_id uuid;
begin
  for rec in
    select *
    from container_pickup_requests r
    where not exists (
      select 1 from migration_pickup_request_map m
      where m.source_table = 'container_pickup_requests'
        and m.source_id = r.id
    )
  loop
    select organization_id into org_id
    from migration_organization_map
    where source_table = 'nonprofit_applications'
      and source_id = rec.application_id;

    select enrollment_id into enr_id
    from migration_enrollment_map
    where source_table = 'nonprofit_applications'
      and source_id = rec.application_id;

    if org_id is not null and enr_id is not null then
      insert into pickup_requests (
        created_at,
        updated_at,
        organization_id,
        enrollment_id,
        request_channel,
        request_type,
        scheduled_date,
        notes,
        admin_notes,
        status
      ) values (
        rec.created_at,
        rec.updated_at,
        org_id,
        enr_id,
        'partner_portal',
        'full_load_pickup',
        rec.scheduled_date,
        rec.notes,
        rec.admin_notes,
        case when rec.status = 'reviewed' then 'reviewed' else rec.status end
      ) returning id into new_request_id;

      insert into migration_pickup_request_map (source_table, source_id, pickup_request_id)
      values ('container_pickup_requests', rec.id, new_request_id);
    end if;
  end loop;
end $$;

do $$
declare
  rec record;
  org_id uuid;
  enr_id uuid;
  new_request_id uuid;
  req_type text;
begin
  for rec in
    select r.*, d.account_type
    from discard_pickup_requests r
    join discard_accounts d on d.id = r.discard_account_id
    where not exists (
      select 1 from migration_pickup_request_map m
      where m.source_table = 'discard_pickup_requests'
        and m.source_id = r.id
    )
  loop
    select organization_id into org_id
    from migration_organization_map
    where source_table = 'discard_accounts'
      and source_id = rec.discard_account_id;

    select enrollment_id into enr_id
    from migration_enrollment_map
    where source_table = 'discard_accounts'
      and source_id = rec.discard_account_id;

    req_type := case when rec.account_type = 'fl' then 'full_load_pickup' else 'ltl_pickup' end;

    if org_id is not null and enr_id is not null then
      insert into pickup_requests (
        created_at,
        updated_at,
        organization_id,
        enrollment_id,
        request_channel,
        request_type,
        preferred_date,
        scheduled_date,
        estimated_bags,
        estimated_weight_lbs,
        notes,
        admin_notes,
        status,
        completed_at
      ) values (
        rec.created_at,
        rec.created_at,
        org_id,
        enr_id,
        'partner_portal',
        req_type,
        rec.preferred_date,
        rec.scheduled_date,
        rec.estimated_bags,
        rec.estimated_weight_lbs,
        rec.notes,
        rec.admin_notes,
        rec.status,
        case when rec.status = 'completed' then rec.created_at else null end
      ) returning id into new_request_id;

      insert into migration_pickup_request_map (source_table, source_id, pickup_request_id)
      values ('discard_pickup_requests', rec.id, new_request_id);
    end if;
  end loop;
end $$;

-- =====================================================
-- PICKUP RUNS FROM CO-OP ROUTES
-- =====================================================
do $$
declare
  rec record;
  new_run_id uuid;
begin
  for rec in
    select *
    from pickup_routes r
    where not exists (
      select 1 from migration_pickup_run_map m
      where m.source_table = 'pickup_routes'
        and m.source_id = r.id
    )
  loop
    insert into pickup_runs (
      created_at,
      updated_at,
      run_type,
      scheduled_date,
      scheduled_time,
      shopping_date,
      status,
      completion_type,
      notes,
      nonprofits_notified_at,
      resellers_notified_at
    ) values (
      rec.created_at,
      rec.created_at,
      'route',
      rec.scheduled_date,
      rec.scheduled_time,
      rec.shopping_date,
      rec.status,
      rec.completion_type,
      rec.notes,
      rec.nonprofits_notified_at,
      rec.resellers_notified_at
    ) returning id into new_run_id;

    insert into migration_pickup_run_map (source_table, source_id, pickup_run_id)
    values ('pickup_routes', rec.id, new_run_id);
  end loop;
end $$;

insert into pickup_run_stops (
  created_at,
  updated_at,
  pickup_run_id,
  organization_id,
  enrollment_id,
  stop_order,
  estimated_bags,
  actual_bags,
  no_inventory,
  stop_status,
  completed_at,
  notes
)
select
  now(),
  now(),
  run_map.pickup_run_id,
  org_map.organization_id,
  enr_map.enrollment_id,
  prs.stop_order,
  prs.estimated_bags,
  prs.actual_bags,
  coalesce(prs.no_inventory, false),
  coalesce(prs.stop_status, 'pending'),
  prs.completed_at,
  prs.notes
from pickup_route_stops prs
join migration_pickup_run_map run_map
  on run_map.source_table = 'pickup_routes'
 and run_map.source_id = prs.route_id
join migration_organization_map org_map
  on org_map.source_table = 'nonprofit_applications'
 and org_map.source_id = prs.nonprofit_id
join migration_enrollment_map enr_map
  on enr_map.source_table = 'nonprofit_applications'
 and enr_map.source_id = prs.nonprofit_id
where not exists (
  select 1
  from pickup_run_stops s
  where s.pickup_run_id = run_map.pickup_run_id
    and s.organization_id = org_map.organization_id
    and coalesce(s.stop_order, -1) = coalesce(prs.stop_order, -1)
);

-- =====================================================
-- PICKUP RUNS / STOPS / PAYOUTS FROM DISCARD PICKUPS
-- =====================================================
do $$
declare
  rec record;
  org_id uuid;
  enr_id uuid;
  new_run_id uuid;
  new_stop_id uuid;
begin
  for rec in
    select *
    from discard_pickups dp
    where not exists (
      select 1 from migration_pickup_run_map m
      where m.source_table = 'discard_pickups'
        and m.source_id = dp.id
    )
  loop
    select organization_id into org_id
    from migration_organization_map
    where source_table = 'discard_accounts'
      and source_id = rec.account_id;

    select enrollment_id into enr_id
    from migration_enrollment_map
    where source_table = 'discard_accounts'
      and source_id = rec.account_id;

    if org_id is not null and enr_id is not null then
      insert into pickup_runs (
        created_at,
        updated_at,
        run_type,
        scheduled_date,
        scheduled_time,
        status,
        completion_type,
        notes
      ) values (
        rec.created_at,
        rec.created_at,
        'single_run',
        rec.pickup_date,
        rec.pickup_time,
        'completed',
        'full',
        rec.notes
      ) returning id into new_run_id;

      insert into migration_pickup_run_map (source_table, source_id, pickup_run_id)
      values ('discard_pickups', rec.id, new_run_id);

      insert into pickup_run_stops (
        created_at,
        updated_at,
        pickup_run_id,
        organization_id,
        enrollment_id,
        actual_weight_lbs,
        no_inventory,
        stop_status,
        completed_at,
        notes
      ) values (
        rec.created_at,
        rec.created_at,
        new_run_id,
        org_id,
        enr_id,
        rec.weight_lbs,
        false,
        'completed',
        rec.created_at,
        concat_ws(E'\n', rec.notes, case when rec.accepted = false then 'Rejected: ' || coalesce(rec.rejection_reason, 'No reason recorded') else null end)
      ) returning id into new_stop_id;

      insert into pickup_payouts (
        pickup_run_stop_id,
        organization_id,
        enrollment_id,
        amount_owed,
        payment_status,
        payment_method,
        payment_date,
        calculated_from,
        notes
      ) values (
        new_stop_id,
        org_id,
        enr_id,
        rec.amount_owed,
        case when rec.accepted = false then 'voided' else rec.payment_status end,
        rec.payment_method,
        rec.payment_date,
        jsonb_build_object('legacy_load_type', rec.load_type, 'legacy_rejected', rec.accepted = false, 'legacy_rejection_reason', rec.rejection_reason),
        rec.notes
      );
    end if;
  end loop;
end $$;

-- =====================================================
-- EXCHANGE REQUESTS
-- =====================================================
do $$
declare
  rec record;
  org_id uuid;
  enr_id uuid;
  new_exchange_id uuid;
begin
  for rec in
    select *
    from exchange_appointments e
    where not exists (
      select 1 from migration_exchange_request_map m
      where m.source_table = 'exchange_appointments'
        and m.source_id = e.id
    )
  loop
    select organization_id into org_id
    from migration_organization_map
    where source_table = 'nonprofit_applications'
      and source_id = rec.nonprofit_id;

    select enrollment_id into enr_id
    from migration_enrollment_map
    where source_table = 'nonprofit_applications'
      and source_id = rec.nonprofit_id;

    if org_id is not null and enr_id is not null then
      insert into exchange_requests (
        created_at,
        updated_at,
        organization_id,
        enrollment_id,
        request_mode,
        preferred_date,
        scheduled_date,
        scheduled_time,
        categories_requested,
        estimated_bags,
        ship_to_address,
        notes,
        admin_notes,
        labor_cost,
        shipping_cost,
        quote_status,
        status,
        quote_sent_at,
        notified_at
      ) values (
        rec.created_at,
        rec.created_at,
        org_id,
        enr_id,
        rec.appointment_type,
        rec.preferred_date,
        rec.scheduled_date,
        rec.scheduled_time,
        rec.categories_requested,
        rec.estimated_bags,
        rec.ship_to_address,
        rec.notes,
        rec.admin_notes,
        rec.labor_cost,
        rec.shipping_cost,
        rec.quote_status,
        rec.status,
        rec.quote_sent_at,
        rec.notified_at
      ) returning id into new_exchange_id;

      insert into migration_exchange_request_map (source_table, source_id, exchange_request_id)
      values ('exchange_appointments', rec.id, new_exchange_id);
    end if;
  end loop;
end $$;

-- =====================================================
-- DONATION LOTS + CANONICAL TAX RECEIPTS
-- =====================================================
do $$
declare
  rec record;
  org_id uuid;
  enr_id uuid;
  new_lot_id uuid;
  new_doc_id uuid;
begin
  for rec in
    select *
    from tax_receipts tr
    where not exists (
      select 1 from migration_donation_lot_map m
      where m.source_table = 'tax_receipts'
        and m.source_id = tr.id
    )
  loop
    select organization_id into org_id
    from migration_organization_map
    where source_table = 'nonprofit_applications'
      and source_id = rec.application_id;

    select enrollment_id into enr_id
    from migration_enrollment_map
    where source_table = 'nonprofit_applications'
      and source_id = rec.application_id;

    if org_id is not null and enr_id is not null then
      insert into donation_lots (
        created_at,
        updated_at,
        organization_id,
        enrollment_id,
        source_type,
        lot_date,
        piece_count,
        estimated_value,
        notes
      ) values (
        rec.created_at,
        rec.created_at,
        org_id,
        enr_id,
        'admin_manual',
        coalesce(rec.lot_date, rec.created_at::date),
        rec.piece_count,
        rec.total_value,
        rec.notes
      ) returning id into new_lot_id;

      insert into migration_donation_lot_map (source_table, source_id, donation_lot_id)
      values ('tax_receipts', rec.id, new_lot_id);

      if coalesce(rec.receipt_file_path, rec.file_url) is not null then
        insert into organization_documents (
          organization_id,
          enrollment_id,
          document_type,
          status,
          storage_bucket,
          storage_path,
          uploaded_by,
          uploaded_at,
          metadata
        ) values (
          org_id,
          enr_id,
          'tax_receipt',
          'active',
          'nonprofit-docs',
          coalesce(rec.receipt_file_path, rec.file_url),
          rec.uploaded_by,
          rec.created_at,
          jsonb_build_object('legacy_source_table', 'tax_receipts', 'legacy_source_id', rec.id, 'legacy_file_url', rec.file_url)
        ) returning id into new_doc_id;
      else
        new_doc_id := null;
      end if;

      insert into canonical_tax_receipts (
        created_at,
        updated_at,
        donation_lot_id,
        organization_id,
        receipt_status,
        receipt_document_id,
        uploaded_by,
        uploaded_at,
        notes
      ) values (
        rec.created_at,
        rec.created_at,
        new_lot_id,
        org_id,
        coalesce(rec.receipt_status, 'pending_receipt'),
        new_doc_id,
        rec.uploaded_by,
        case when coalesce(rec.receipt_file_path, rec.file_url) is not null then rec.created_at else null end,
        rec.notes
      );
    end if;
  end loop;
end $$;

-- =====================================================
-- CANONICAL SHOPPING DAYS + NONPROFIT BOOKINGS
-- =====================================================
do $$
declare
  rec record;
  run_id uuid;
  new_day_id uuid;
begin
  for rec in
    select *
    from shopping_days sd
    where not exists (
      select 1 from migration_shopping_day_map m
      where m.source_table = 'shopping_days'
        and m.source_id = sd.id
    )
  loop
    select pickup_run_id into run_id
    from migration_pickup_run_map
    where source_table = 'pickup_routes'
      and source_id = rec.route_id;

    insert into canonical_shopping_days (
      created_at,
      updated_at,
      source_pickup_run_id,
      shopping_date,
      status,
      nonprofit_bins_capacity,
      admin_notes
    ) values (
      rec.created_at,
      rec.created_at,
      run_id,
      rec.shopping_date,
      rec.status,
      2,
      rec.admin_notes
    ) returning id into new_day_id;

    insert into migration_shopping_day_map (source_table, source_id, canonical_shopping_day_id)
    values ('shopping_days', rec.id, new_day_id);
  end loop;
end $$;

insert into organization_shopping_bookings (
  created_at,
  canonical_shopping_day_id,
  organization_id,
  enrollment_id,
  slot_type,
  status,
  notes
)
select
  sb.created_at,
  day_map.canonical_shopping_day_id,
  org_map.organization_id,
  enr_map.enrollment_id,
  'nonprofit_bins',
  sb.status,
  sb.notes
from shopping_bookings sb
join migration_shopping_day_map day_map
  on day_map.source_table = 'shopping_days'
 and day_map.source_id = sb.shopping_day_id
join migration_organization_map org_map
  on org_map.source_table = 'nonprofit_applications'
 and org_map.source_id = sb.nonprofit_id
join migration_enrollment_map enr_map
  on enr_map.source_table = 'nonprofit_applications'
 and enr_map.source_id = sb.nonprofit_id
where sb.slot_type = 'nonprofit_bins'
  and sb.nonprofit_id is not null
  and not exists (
    select 1
    from organization_shopping_bookings b
    where b.canonical_shopping_day_id = day_map.canonical_shopping_day_id
      and b.organization_id = org_map.organization_id
      and b.slot_type = 'nonprofit_bins'
  );
