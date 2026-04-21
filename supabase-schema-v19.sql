-- =====================================================
-- NCT Recycling — Schema v19
-- Agreement template seed, legacy agreement backfill, and helper views
-- =====================================================

-- =====================================================
-- AGREEMENT TEMPLATES
-- =====================================================
insert into agreement_templates (
  program_type,
  template_slug,
  version_label,
  title,
  body_text,
  is_active
)
values (
  'co_op',
  'co_op_participation',
  'v1-live-import',
  'NCT Recycling Co-Op Network Participation Agreement',
  $$NCT RECYCLING LLC — CO-OP NETWORK PARTICIPATION AGREEMENT
==========================================================

This Co-Op Participation Agreement ("Agreement") establishes the terms of
participation in the NCT Recycling Co-Op Network, a collaborative system
designed to strengthen community impact, reduce textile waste, and connect
nonprofits, charities, thrift stores, and small businesses through shared
infrastructure.

This Agreement is intended to provide clarity, transparency, and a sustainable
framework for long-term collaboration between NCT Recycling and participating
organizations.

1. PURPOSE OF THE CO-OP

The NCT Recycling Co-Op Network exists to connect organizations serving
overlapping community needs through a coordinated system for textile
redistribution. Rather than relying solely on transactional resale or
operating in isolation, the co-op enables participating organizations to
benefit from shared infrastructure that increases visibility, supports
redistribution, strengthens community outcomes, and creates long-term value
beyond per-pound discard transactions.

2. ROLE OF NCT RECYCLING

NCT Recycling serves as the central coordinator and logistical moderator of
the co-op network.

3. ROLE OF PARTICIPATING ORGANIZATIONS

By joining the NCT Recycling Co-Op Network, participating organizations agree
to provide donated textiles at no cost, participate in good faith, coordinate
item selection or pickup where applicable, and communicate needs through the
portal.

4. EXCHANGE PROGRAM & WAREHOUSE ACCESS

Approved partners may source inventory through the exchange program using
in-person bins visits or delivery coordination through the partner portal.

5. PICKUP MINIMUMS AND SCHEDULING FRAMEWORK

A minimum of 1,000 pounds of donated textiles is required for any scheduled
pickup. Pickup frequency is determined by how quickly that threshold is
reached.

6. LOAD SIZE AND ROUTING

Loads under 4,000 lbs must be scheduled within an existing NCT route. Loads of
4,000 lbs or more may be scheduled independently.

7. COST AND VALUE EXCHANGE

Participating organizations provide donated textiles at no cost. In exchange,
they receive non-monetary value through logistics coordination,
redistribution access, visibility, and community impact.

8. BAG COUNT REPORTING

Partner agrees to maintain an accurate bag count in their partner portal,
updating it whenever stored donation volume changes.

9. 501(c)(3) VERIFICATION

Participation is limited to organizations with verified 501(c)(3) status.
Partner must provide an IRS determination letter upon application and notify
NCT Recycling of any change in tax-exempt status.

10. VISIBILITY AND COMMUNITY RECOGNITION

Any public recognition or visibility provided by NCT Recycling will be limited
to content or materials supplied or expressly approved by the participating
organization.

11. TERM AND TERMINATION

Participation is voluntary and may be terminated by either party with 60 days
written notice.

12. INTENDED USE

This Agreement formalizes participation in the NCT Recycling Co-Op Network and
establishes the participating organization as a co-op partner.$$,
  true
)
on conflict (program_type, template_slug, version_label) do nothing;

insert into agreement_templates (
  program_type,
  template_slug,
  version_label,
  title,
  body_text,
  is_active
)
values (
  'discard',
  'discard_purchase_operating',
  'v1-live-import',
  'NCT Recycling Textile Discard Purchase Operating Agreement',
  $$NCT Recycling
Textile Discard Purchase Operating Agreement

This Operating Agreement ("Agreement") establishes the terms under which NCT
Recycling purchases excess or discarded textile material from participating
organizations under a transactional discard-sale model. This Agreement is
separate from and does not include participation in the NCT Recycling Co-Op
Network.

1. Purpose

This Agreement defines a flat-rate, volume-based structure for organizations
that elect to sell textile discard rather than participate in the NCT
Recycling Co-Op Network.

2. Scope of Material

Material covered under this Agreement includes textile material only,
designated by the participating organization as discard or overstock.

3. Compensation Structure

Compensation under this Agreement is volume-based and does not use per-pound
market pricing. Compensation may include a negotiated rate per 1,000 lbs or a
flat pickup amount depending on the account terms.

4. Minimum Volume Requirements for Payment

Recurring pickups and single-run pickups are subject to minimum thresholds set
by the account terms in order to avoid pickups that operate at a net loss.

5. Pickup Scheduling and Routing

Recurring pickups must align with established routes and operational
availability. Full truckloads may be scheduled independently.

6. Payment Terms

Payment is issued per completed pickup that meets all requirements of this
Agreement. No additional compensation is provided for sorting, quality, brand
value, or resale outcome.

7. No Co-Op Participation or Additional Benefits

This Agreement does not include participation in the NCT Recycling Co-Op
Network and provides no redistribution access, promotional or advertising
benefits, or partnership designation.

8. Accepted Material, Prohibited Material, Shoes, and Credential Donations

Only textile material is accepted. NCT Recycling reserves the right to reject
loads presenting contamination, prohibited material, or safety concerns.

9. Responsibilities of Participating Organization

The participating organization agrees to accurately represent volumes, provide
safe pickup access, ensure materials are reasonably contained for transport,
and designate discard material in good faith.

10. Term and Termination

This Agreement has an initial term of one year and may be terminated by either
party with 60 days written notice after the initial term.

11. Intended Use

This Agreement governs transactional textile discard sales only and does not
establish co-op participation.$$,
  true
)
on conflict (program_type, template_slug, version_label) do nothing;

-- Ensure only the latest imported versions are active.
update agreement_templates
set is_active = false
where program_type in ('co_op', 'discard')
  and (program_type, template_slug, version_label) not in (
    ('co_op', 'co_op_participation', 'v1-live-import'),
    ('discard', 'discard_purchase_operating', 'v1-live-import')
  );

-- =====================================================
-- LEGACY CO-OP AGREEMENT BACKFILL
-- =====================================================
do $$
declare
  rec record;
  template_id uuid;
  packet_id uuid;
begin
  select id into template_id
  from agreement_templates
  where program_type = 'co_op'
    and template_slug = 'co_op_participation'
    and version_label = 'v1-live-import'
  limit 1;

  for rec in
    select
      n.id as legacy_id,
      n.org_name,
      n.email,
      n.contact_name,
      n.authorized_title,
      n.contract_agreed,
      n.contract_agreed_at,
      n.contract_signed_name,
      org_map.organization_id,
      enr_map.enrollment_id
    from nonprofit_applications n
    join migration_organization_map org_map
      on org_map.source_table = 'nonprofit_applications'
     and org_map.source_id = n.id
    join migration_enrollment_map enr_map
      on enr_map.source_table = 'nonprofit_applications'
     and enr_map.source_id = n.id
    where n.contract_agreed = true
      and not exists (
        select 1
        from agreement_packets ap
        where ap.enrollment_id = enr_map.enrollment_id
      )
  loop
    insert into agreement_packets (
      organization_id,
      enrollment_id,
      template_id,
      status,
      generated_from,
      rendered_body,
      signed_at
    ) values (
      rec.organization_id,
      rec.enrollment_id,
      template_id,
      'signed',
      jsonb_build_object(
        'legacy_source_table', 'nonprofit_applications',
        'legacy_source_id', rec.legacy_id,
        'legacy_import_type', 'co_op_contract_acceptance'
      ),
      (select body_text from agreement_templates where id = template_id),
      rec.contract_agreed_at
    ) returning id into packet_id;

    insert into agreement_signatures (
      agreement_packet_id,
      signer_name,
      signer_title,
      signer_email,
      signature_method,
      accepted_terms,
      signed_at
    ) values (
      packet_id,
      coalesce(rec.contract_signed_name, rec.contact_name, rec.org_name),
      rec.authorized_title,
      rec.email,
      'typed_acceptance',
      true,
      coalesce(rec.contract_agreed_at, now())
    );
  end loop;
end $$;

-- =====================================================
-- LEGACY DISCARD AGREEMENT PLACEHOLDERS
-- =====================================================
do $$
declare
  rec record;
  template_id uuid;
begin
  select id into template_id
  from agreement_templates
  where program_type = 'discard'
    and template_slug = 'discard_purchase_operating'
    and version_label = 'v1-live-import'
  limit 1;

  for rec in
    select
      d.id as legacy_id,
      d.org_name,
      d.contract_date,
      org_map.organization_id,
      enr_map.enrollment_id
    from discard_accounts d
    join migration_organization_map org_map
      on org_map.source_table = 'discard_accounts'
     and org_map.source_id = d.id
    join migration_enrollment_map enr_map
      on enr_map.source_table = 'discard_accounts'
     and enr_map.source_id = d.id
    where d.contract_date is not null
      and not exists (
        select 1
        from agreement_packets ap
        where ap.enrollment_id = enr_map.enrollment_id
      )
  loop
    insert into agreement_packets (
      organization_id,
      enrollment_id,
      template_id,
      status,
      generated_from,
      rendered_body,
      signed_at
    ) values (
      rec.organization_id,
      rec.enrollment_id,
      template_id,
      'signed',
      jsonb_build_object(
        'legacy_source_table', 'discard_accounts',
        'legacy_source_id', rec.legacy_id,
        'legacy_import_type', 'contract_date_only',
        'requires_repapering', true
      ),
      (select body_text from agreement_templates where id = template_id),
      rec.contract_date
    );
  end loop;
end $$;

-- =====================================================
-- DUAL-READ HELPER VIEWS
-- =====================================================
create or replace view current_organization_enrollments as
select
  o.id as organization_id,
  o.legal_name,
  o.main_email,
  o.main_phone,
  e.id as enrollment_id,
  e.program_type,
  e.lifecycle_status,
  e.is_current,
  e.created_at as enrollment_created_at,
  e.activated_at,
  cop.account_type as co_op_account_type,
  cop.default_estimated_bags,
  cop.storage_capacity_bags as co_op_storage_capacity_bags,
  dp.account_type as discard_account_type,
  dp.pickup_frequency as discard_pickup_frequency,
  dp.projected_lbs_week,
  dp.negotiated_rate_per_1000_lbs,
  dp.flat_rate_per_pickup,
  dp.storage_capacity_bags as discard_storage_capacity_bags
from organizations o
join organization_program_enrollments e
  on e.organization_id = o.id
 and e.is_current = true
left join co_op_program_details cop
  on cop.enrollment_id = e.id
left join discard_program_details dp
  on dp.enrollment_id = e.id;

create or replace view current_organization_inventory as
select
  e.organization_id,
  e.enrollment_id,
  sum(
    case
      when e.event_type = 'reported_add' then coalesce(e.quantity_bags, 0)
      when e.event_type = 'adjustment' then coalesce(e.quantity_bags, 0)
      when e.event_type = 'pickup_collected' then -1 * coalesce(e.quantity_bags, 0)
      when e.event_type = 'reset' then 0
      else 0
    end
  ) as current_bag_count,
  max(e.created_at) as last_inventory_event_at
from inventory_events e
group by e.organization_id, e.enrollment_id;

create or replace view admin_pickup_request_queue as
select
  pr.id,
  pr.created_at,
  pr.organization_id,
  o.legal_name,
  pr.enrollment_id,
  e.program_type,
  pr.request_type,
  pr.preferred_date,
  pr.scheduled_date,
  pr.estimated_bags,
  pr.estimated_weight_lbs,
  pr.fill_level,
  pr.status,
  pr.notes,
  pr.admin_notes
from pickup_requests pr
join organizations o on o.id = pr.organization_id
join organization_program_enrollments e on e.id = pr.enrollment_id;
