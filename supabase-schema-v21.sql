-- =====================================================
-- NCT Recycling — Schema v21
-- Reseller Buyer Agreement transition: retire wholesale program,
-- introduce wants_warehouse_access + tier + agreement linkage on
-- reseller_applications, and seed buyer_v1 agreement template.
-- Idempotent. Run after v20.
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Widen agreement_templates.program_type to include 'reseller'
-- ---------------------------------------------------------------
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'agreement_templates'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%program_type%';
  if cname is not null then
    execute format('alter table agreement_templates drop constraint %I', cname);
  end if;
end$$;

alter table agreement_templates
  add constraint agreement_templates_program_type_check
  check (program_type in ('co_op', 'discard', 'reseller', 'employment'));

-- ---------------------------------------------------------------
-- 2. Seed Reseller Buyer Agreement (buyer_v1)
-- ---------------------------------------------------------------
-- Deactivate any prior reseller templates first.
update agreement_templates
   set is_active = false
 where program_type = 'reseller'
   and is_active = true;

insert into agreement_templates (
  program_type,
  template_slug,
  version_label,
  title,
  body_text,
  is_active
)
values (
  'reseller',
  'reseller_buyer_agreement',
  'buyer_v1',
  'NCT Recycling Reseller Buyer Agreement',
  $$NORTHERN COLORADO TEXTILE RECYCLING LLC
d/b/a NCT EMPORIUM
RESELLER BUYER AGREEMENT
(On-Premises Sorting Access for Bulk Textile Lot Buyers)

IMPORTANT — READ CAREFULLY BEFORE SIGNING
This is a legally binding contract. By signing, you acknowledge that you have read, understood, and agree to all terms. You are giving up certain legal rights, including the right to sue Northern Colorado Textile Recycling LLC for injuries, accidents, or losses that may occur on the premises or in connection with your participation as a Buyer. You may wish to consult independent counsel before signing.

1. Parties
This Reseller Buyer Agreement ("Agreement") is between Northern Colorado Textile Recycling LLC, d/b/a NCT Emporium, a Colorado limited liability company located at 6108 South College Ave, STE C, Fort Collins, Colorado 80525 ("NCT," "Seller"), and the individual or business entity identified by signature below ("Buyer").

2. Nature of the Relationship
2.1 Sale of Goods. Buyer is a customer of NCT who purchases unsorted, mixed-condition bulk textile lots ("Loads") on an "as-is, where-is" basis and takes possession on NCT premises. Each transaction is a sale of goods governed by Article 2 of the Uniform Commercial Code as adopted in Colorado, C.R.S. Title 4, Article 2.
2.2 No Other Relationship. Buyer is not an employee, agent, contractor, joint venturer, partner, or representative of NCT. NCT does not pay Buyer for any services, does not control Buyer's business, does not set Buyer's pricing or methods, and does not direct Buyer's resale activities. Buyer is free to engage in similar transactions with other parties.
2.3 Buyer's Independent Business. Buyer represents that Buyer operates Buyer's own resale, retail, e-commerce, or similar business, and that Buyer is solely responsible for: registering and operating that business; obtaining any required Colorado sales tax license and resale exemption certificate; collecting and remitting all applicable sales, use, and income taxes; and complying with all laws applicable to Buyer's business.

3. Premises Access License
3.1 Limited License. NCT grants Buyer a limited, revocable, non-transferable license to enter NCT's premises during posted Buyer hours for the sole purpose of inspecting, sorting, weighing, paying for, and removing Loads purchased by Buyer.
3.2 No Right of Possession. This license does not grant Buyer any tenancy, leasehold, easement, or other property interest in NCT's premises. NCT may revoke this license at any time, with or without cause, in its sole discretion.
3.3 Hours and Conduct. Buyer shall enter only through the designated customer access point, only during posted Buyer hours, and shall not enter restricted areas. NCT reserves the right to deny entry, eject any person, and refuse any sale.

4. Insurance and Workers' Compensation
4.1 No Coverage by NCT. NCT's workers' compensation, general liability, or other insurance does not cover Buyer or Buyer's employees, agents, or guests for activities under this Agreement. Buyer is solely responsible for any insurance Buyer deems appropriate, including occupational accident, general liability, health, and auto insurance.
4.2 No Employee Status. Nothing in this Agreement creates an employment relationship, and Buyer is not entitled to any benefit available to NCT employees.

5. Assumption of Risk
Buyer acknowledges that on-premises Load purchase and sorting involves inherent risks, including without limitation: slips, trips, and falls; injuries from handling, lifting, sorting, or moving textiles or bales; injuries from forklifts, conveyors, balers, and other warehouse equipment operated on the premises; property damage; exposure to dust, allergens, mold, pests, or unsanitary materials; and incidents during loading, unloading, or transportation of purchased goods. Buyer freely and voluntarily assumes all such risks.

6. Release and Waiver of Liability
In consideration of being granted the limited license to enter NCT's premises and to purchase Loads under this Agreement, Buyer hereby releases, waives, discharges, and covenants not to sue NCT, its members, managers, officers, employees, agents, successors, and assigns from any and all claims arising out of: (a) Buyer's presence on or access to the premises; (b) participation in the Buyer program; (c) any injury to person or property on the premises; and (d) transportation to and from the facility. This release includes claims arising from ordinary negligence. This release does NOT apply to willful and wanton misconduct or intentional misconduct by NCT.
Buyer acknowledges that this release is intended to be enforced to the fullest extent permitted by Colorado law, including under the four-factor test set forth in Jones v. Dressel, 623 P.2d 370 (Colo. 1981).

7. Indemnification
Buyer shall indemnify, defend, and hold harmless NCT from any claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from: (a) Buyer's negligence, acts, or omissions on the premises; (b) Buyer's violation of this Agreement; (c) Buyer's business activities, including the resale, use, donation, disposal, or modification of inventory acquired from NCT; (d) any third-party claim arising from products sold or services rendered by Buyer; and (e) any injury to Buyer or to Buyer's employees, agents, or guests on the premises.
Buyer acknowledges that this indemnification arises from a sale-of-goods and warehouse-access transaction and is not subject to C.R.S. § 13-21-111.5(6), which by its terms applies only to construction agreements.

8. Warehouse and Premises Rules
Buyer agrees to:
1. Check in with staff upon arrival.
2. Wear closed-toe shoes at all times on the premises.
3. Refrain from smoking, vaping, and use of open flames anywhere on the premises.
4. Supervise minor children at all times; minors may not handle Loads or operate equipment.
5. Follow all directions of NCT staff and posted signage.
6. Not access restricted areas, including baling, conveyor, dock, and equipment areas not designated for Buyer access.
7. Not operate any NCT equipment, forklifts, balers, or vehicles.
8. Weigh and pay for all inventory before leaving the premises.
9. Not resell, trade, transfer, or list inventory while on NCT premises.
10. Clean up Buyer's work area and dispose of any unwanted items in designated containers before leaving.
NCT reserves the right to revoke this Agreement and Buyer's premises access at any time.

9. Inventory Sale Terms
9.1 As-Is, Where-Is. All Loads are sold "as-is, where-is" with no warranties of any kind. NCT EXPRESSLY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
9.2 Final Sale. All sales are final. No returns, refunds, exchanges, or credits will be issued for any reason, including condition, contents, weight discrepancies, or unsatisfactory resale outcomes.
9.3 Risk of Loss. Risk of loss passes to Buyer upon payment. Buyer is responsible for safe loading and transportation of purchased Loads.
9.4 Sales Tax and Resale Certificate. Buyer is responsible for collecting and remitting all applicable sales taxes on Buyer's resale activities. To purchase tax-free for resale, Buyer must provide NCT with a valid Colorado sales tax license number and resale exemption certificate.

10. Load Allocation
NCT may allocate available Loads among Buyers using a queue, lottery, first-come-first-served, or other reasonable method, in NCT's sole discretion. NCT does not guarantee any Buyer the right to claim any particular Load. NCT may withhold any Load for its own wholesale, retail, or other use.

11. Confidential Information
Buyer shall not photograph, video, record, copy, list, transmit, or share with any third party any of the following: (a) NCT donor identities or pickup-route information; (b) NCT's wholesale buyer or supplier identities; (c) NCT pricing methodology, internal grading systems, or sorting protocols; (d) NCT software, dashboards, or operational data; or (e) the identities or activities of other Buyers. This obligation survives termination of this Agreement.

12. NCT Employees as Buyers
If Buyer is also an NCT employee, Buyer's participation in the Buyer program is additionally governed by Section 9 of Buyer's Employment Agreement, which restricts the timing, conditions, and information used in connection with such purchases. In the event of any conflict between this Agreement and Buyer's Employment Agreement, the more restrictive provision applies. Termination of employment does not automatically terminate this Agreement, which thereafter continues on its own terms unless revoked by NCT.

13. Governing Law and Venue
This Agreement is governed by the laws of the State of Colorado, without regard to its conflict-of-laws principles. Any dispute arising under or related to this Agreement shall be resolved exclusively in the state or federal courts located in Larimer County, Colorado.

14. Miscellaneous
14.1 Severability. If any provision is held unenforceable, the remaining provisions remain in effect, and a court is authorized to modify the unenforceable provision to the minimum extent necessary to make it enforceable.
14.2 Entire Agreement. This Agreement is the entire agreement between NCT and Buyer regarding the matters addressed herein and supersedes the prior NCT Reseller Partner / Independent Contractor Agreement and all other prior representations.
14.3 Amendment. This Agreement may be amended only by a writing signed by Buyer and an authorized representative of NCT, except that NCT may update the warehouse rules in Section 8 and the Buyer hours in Section 3.3 by reasonable notice.
14.4 No Waiver. NCT's failure to enforce any provision is not a waiver of that provision.
14.5 Counterparts and Electronic Signatures. This Agreement may be signed in counterparts, including by electronic signature.$$,
  true
)
on conflict (program_type, template_slug, version_label) do update
  set body_text = excluded.body_text,
      title     = excluded.title,
      is_active = true;

-- ---------------------------------------------------------------
-- 3. Add new columns to reseller_applications
-- ---------------------------------------------------------------
alter table reseller_applications
  add column if not exists wants_warehouse_access boolean not null default false;

alter table reseller_applications
  add column if not exists tier text not null default 'public';

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'reseller_applications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%tier%';
  if cname is null then
    execute 'alter table reseller_applications
             add constraint reseller_applications_tier_check
             check (tier in (''public'',''employee''))';
  end if;
end$$;

alter table reseller_applications
  add column if not exists agreement_template_id uuid references agreement_templates(id);

alter table reseller_applications
  add column if not exists agreement_version text;

-- ---------------------------------------------------------------
-- 4. Backfill existing rows: grandfather old partner agreement,
--    treat them as having warehouse access (the legacy partner
--    agreement was a warehouse / on-premises license).
-- ---------------------------------------------------------------
update reseller_applications
   set agreement_version = 'partner_v1_legacy',
       wants_warehouse_access = true
 where agreement_version is null
   and contract_agreed = true;

-- ---------------------------------------------------------------
-- 5. RLS — restrict tier updates to service role
-- ---------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'reseller_applications'
      and policyname = 'reseller_applications_no_tier_update'
  ) then
    execute $p$
      create policy reseller_applications_no_tier_update
      on reseller_applications
      as restrictive
      for update
      using (
        auth.role() = 'service_role'
        or tier is not distinct from (
          select tier from reseller_applications r2 where r2.id = reseller_applications.id
        )
      )
    $p$;
  end if;
end$$;

-- ---------------------------------------------------------------
-- 6. Helpful index for active-template lookup
-- ---------------------------------------------------------------
create index if not exists idx_agreement_templates_program_active
  on agreement_templates(program_type, is_active);
