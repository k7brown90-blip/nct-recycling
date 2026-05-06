-- =====================================================
-- NCT Recycling — Schema v22
-- Track B Phase B1: Employment compliance scaffolding.
--   * Widens agreement_templates.program_type to include 'employment'
--   * Adds employee_acknowledgments table (one row per signed doc/version)
--   * Adds equipment_authorizations table (baler / forklift / other,
--     with grant + expire + revoke fields tracking 29 CFR 1910.178)
--   * Seeds employment-document templates from the live .docx packet:
--       - employment_agreement_v3
--       - role_addendum_intake_sorter
--       - role_addendum_inventory_listing
--       - role_addendum_ecommerce_shipping
--       - baler_operator_authorization
--       - forklift_operator_authorization
-- Idempotent. Run after v21.
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Widen agreement_templates.program_type to include 'employment'
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
-- 2. employee_acknowledgments
--    Tracks each signed acknowledgment of a versioned agreement
--    template by an employee. One row per (employee, template).
-- ---------------------------------------------------------------
create table if not exists employee_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  employee_id uuid not null references employee_profiles(id) on delete cascade,
  template_id uuid not null references agreement_templates(id) on delete restrict,
  template_slug text not null,
  version_label text not null,
  signed_name text not null,
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  pdf_url text,
  unique (employee_id, template_id)
);

create index if not exists idx_employee_acknowledgments_employee
  on employee_acknowledgments(employee_id);
create index if not exists idx_employee_acknowledgments_template
  on employee_acknowledgments(template_id);
create index if not exists idx_employee_acknowledgments_slug
  on employee_acknowledgments(template_slug);

alter table employee_acknowledgments enable row level security;

-- service-role only; admins use service client, employees fetch via API.
drop policy if exists employee_acknowledgments_service_only on employee_acknowledgments;
create policy employee_acknowledgments_service_only
  on employee_acknowledgments
  for all
  using (false)
  with check (false);

-- ---------------------------------------------------------------
-- 3. equipment_authorizations
--    Tracks per-employee equipment operator authorizations
--    (baler, forklift, other). Mandatory re-eval handled via
--    expires_at; revocation via revoked_at + revoked_reason.
-- ---------------------------------------------------------------
create table if not exists equipment_authorizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  employee_id uuid not null references employee_profiles(id) on delete cascade,
  equipment_type text not null
    check (equipment_type in ('baler', 'forklift', 'other')),
  equipment_label text,
  authorized_at timestamptz not null default now(),
  authorized_by_employee_id uuid references employee_profiles(id) on delete set null,
  authorized_by_label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  notes text
);

create index if not exists idx_equipment_authorizations_employee
  on equipment_authorizations(employee_id);
create index if not exists idx_equipment_authorizations_active
  on equipment_authorizations(employee_id, equipment_type)
  where revoked_at is null;

drop trigger if exists set_equipment_authorizations_updated_at on equipment_authorizations;
create trigger set_equipment_authorizations_updated_at
before update on equipment_authorizations
for each row execute procedure update_updated_at();

alter table equipment_authorizations enable row level security;

drop policy if exists equipment_authorizations_service_only on equipment_authorizations;
create policy equipment_authorizations_service_only
  on equipment_authorizations
  for all
  using (false)
  with check (false);

-- ---------------------------------------------------------------
-- 4. Seed employment templates
--    Deactivate any prior employment templates per-slug, then
--    insert/upsert the v3 / v1 bodies. Idempotent.
-- ---------------------------------------------------------------
update agreement_templates
   set is_active = false
 where program_type = 'employment'
   and is_active = true;

-- 4a. Employment Agreement v3
insert into agreement_templates (
  program_type, template_slug, version_label, title, body_text, is_active
) values (
  'employment',
  'employment_agreement_v3',
  'v3',
  'NCT Employment Agreement',
  $$NORTHERN COLORADO TEXTILE RECYCLING LLC
d/b/a NCT EMPORIUM
EMPLOYMENT AGREEMENT

IMPORTANT — READ CAREFULLY BEFORE SIGNING
This is a legally binding contract. By signing, you acknowledge that you have read, understood, and agree to all terms and conditions. You may wish to consult independent counsel before signing.

1. Parties
This Employment Agreement ("Agreement") is entered into between Northern Colorado Textile Recycling LLC, d/b/a NCT Emporium, a Colorado limited liability company located at 6108 South College Ave, STE C, Fort Collins, Colorado 80525 ("Employer," "Company," or "NCT"), and the individual identified by signature below ("Employee").

2. At-Will Employment
Employee's employment with NCT is at-will. Either Employee or NCT may terminate the employment relationship at any time, with or without cause, and with or without notice. No representation may modify the at-will nature of Employee's employment except by a written agreement signed by an authorized officer of NCT and expressly stating that the at-will nature is being modified. Provisions of this Agreement that protect confidential information, define duties during employment, and govern post-employment obligations remain in effect according to their terms.

3. Position, Duties, and Reporting
3.1 Position. Employee is hired to the position identified on the Position Schedule (Exhibit A) and the Role Responsibilities Addendum applicable to the position. The Position Schedule sets forth the title, classification (exempt or non-exempt), schedule, rate of pay, supervisor, and primary responsibilities for the position.
3.2 Core Duties. Employee's duties include those identified on the Position Schedule and the applicable Role Responsibilities Addendum, plus all reasonable duties consistent with the position as assigned by NCT.
3.3 Sorting While On the Clock. While clocked in, Employee shall sort, grade, and stage all inventory exclusively for the Company's account — including wholesale, ecommerce, export, and other Company-designated channels. Employee shall not, while on the clock: (a) reserve, set aside, remove, hide, mark, or earmark any item for Employee's personal acquisition or for any third party; (b) photograph, list, or transmit information about specific items, loads, or donor sources for any purpose other than NCT business; or (c) perform any work for any person or entity other than NCT.
3.4 Reporting. Employee shall report to the supervisor identified on Exhibit A and shall comply with the reporting structure, schedules, and procedures established by NCT, as updated from time to time.
3.5 Tier-Specific Duties. The Company operates a multi-tier sorting flow. Employees performing each role have specific duties as set forth in the applicable Role Responsibilities Addendum and as summarized below.
(a) Intake Sorting. Employees performing intake sort shall classify items between the Company's resale stream ("keep") and the export bale stream ("discard") in accordance with the Company's grading standards. Employees shall not under-classify items into the discard stream for any personal benefit, for the benefit of any third party, or in coordination with any Buyer.
(b) Baling and Discard-Pile Recovery. Employees performing baling and discard-pile recovery shall pull from the discard pile any item meeting the Company's resale criteria, applying the Company's published recovery standards. Recovered items become Company inventory and shall be routed to the Company's wholesale or ecommerce stream. Employees shall not under-pull and shall not personally retain or remove any recovered item. The Company may track recovery rates by employee and may use such metrics for performance evaluation, training, and detection of policy violations.
(c) Second-Tier Sorting and Listing. Employees performing second-tier sorting, photography, listing, pricing, or fulfillment for the Company's wholesale or ecommerce channels shall not use information about specific items, prices, conditions, or expected sale dates for personal benefit or for the benefit of any third party. Pricing decisions and listing timing are Company business and shall not be shared with any non-Company party.
(d) No Personal Retention from Any Tier. Employees shall not personally retain, remove, set aside, mark, hide, or earmark any item from any sorting tier — including intake, baling, second-tier sorting, listing, fulfillment, shipping, or any other point in the workflow — for personal acquisition or for any third party. Any such retention, attempted retention, or unauthorized removal is a material breach of this Agreement and grounds for immediate termination, in addition to any other remedies available to the Company.

4. Compensation
4.1 Wages or Salary. Employee shall be paid the rate set forth on Exhibit A, less applicable tax withholdings and authorized deductions. Pay periods, paydays, and method of payment are set by NCT and may be updated upon reasonable notice in compliance with the Colorado Wage Act.
4.2 Overtime (Non-Exempt Employees). If Employee is classified as non-exempt, Employee is entitled to overtime pay at one and one-half times the regular rate of pay for hours worked in excess of (a) 40 in a workweek, (b) 12 in a workday, or (c) 12 consecutive hours, whichever results in the greater amount, in accordance with COMPS Order #39 (7 CCR 1103-1) and the Fair Labor Standards Act. Compensatory ("comp") time in lieu of overtime pay is not permitted.
4.3 Benefits. Employee may be eligible for benefits as described in any benefits summary provided by NCT. NCT may modify benefits at any time. Eligibility for FAMLI, HFWA paid sick leave, and any required state programs is governed by applicable law.
4.4 Deductions. NCT will make only those deductions from Employee's wages permitted by C.R.S. § 8-4-105 or otherwise authorized in writing by Employee.

5. Hours of Work, Time Tracking, and Off-Clock Prohibition
5.1 Schedule. Employee's scheduled work hours are set by NCT and may be modified with reasonable notice.
5.2 Time Tracking. Employee shall accurately record all time worked using the time-tracking system designated by NCT. Falsification of time records is grounds for immediate termination.
5.3 Meal and Rest Periods. In accordance with COMPS Order #39, non-exempt employees are entitled to a duty-free, 30-minute meal period for shifts exceeding 5 consecutive hours, and to a paid, 10-minute rest period for each 4 hours of work.
5.4 No Off-the-Clock Work. Employee shall not perform any work for NCT while not clocked in. Employee shall not, while off the clock, remain on premises in any role that constitutes work for the benefit of NCT. If a supervisor knowingly or unknowingly directs or permits Employee to perform work off the clock, Employee shall promptly report it to NCT management.

6. Confidential Information and Trade Secrets
6.1 Definition. "Confidential Information" means non-public information of NCT that derives independent economic value from not being generally known, including without limitation: donor and pickup-route information; wholesale buyer and reseller-portal lists; supplier and vendor lists and pricing; load arrival schedules and manifest information; pricing strategies, methodologies, margin data, and cost structures; sorting and grading protocols; financial information; software, code, internal tools, CRM data, and analytics; marketing, sales, and growth strategies; and any other information identified as confidential by NCT.
6.2 Trade Secrets. Confidential Information that meets the definition of a trade secret under the Colorado Uniform Trade Secrets Act, C.R.S. §§ 7-74-101 et seq., is protected by that Act in addition to this Agreement.
6.3 Use and Disclosure. During and after employment, Employee shall not use, disclose, copy, transmit, or remove Confidential Information except as required to perform the duties of the position for NCT. Employee shall not use Confidential Information for personal benefit, including in any side business, resale activity, or activity as a Buyer under the NCT Reseller Buyer Agreement.
6.4 Limitation Required by Colorado Law. In compliance with C.R.S. § 8-2-113(3), nothing in this Section restricts Employee from disclosing or using: (a) information that arises from Employee's general training, knowledge, skill, or experience; (b) information that is readily ascertainable to the public; or (c) information that Employee otherwise has a legal right to disclose, including disclosure required by law or to a government agency for the purpose of reporting a suspected violation of law.
6.5 Defend Trade Secrets Act Notice. Pursuant to 18 U.S.C. § 1833(b), Employee shall not be held criminally or civilly liable for the disclosure of a trade secret made in confidence to a federal, state, or local government official or to an attorney solely for the purpose of reporting or investigating a suspected violation of law, or filed under seal in a lawsuit.
6.6 Return of Information. Upon termination or upon NCT's request, Employee shall promptly return all Confidential Information and all NCT property in any medium.

7. Duty of Loyalty During Employment
7.1 General Duty. During employment, Employee owes NCT a duty of loyalty. Employee shall not, during the term of employment:
- Take any business opportunity belonging to NCT for personal benefit or for the benefit of any third party.
- Solicit, divert, or attempt to divert any donor, supplier, customer, wholesale buyer, employee, or contractor of NCT to any competing business.
- Engage in any business activity that competes with NCT's wholesale, ecommerce, export, or sourcing operations, except as expressly permitted by Section 9.
- Use NCT facilities, equipment, vehicles, supplies, time, or Confidential Information for personal gain or for the benefit of any third party.
- Accept gifts, kickbacks, commissions, discounts, or anything of material value from any donor, supplier, customer, vendor, or other party doing business or seeking to do business with NCT, without prior written disclosure to and approval by NCT management.
7.2 Faithless Servant Acknowledgment. A material breach of the duty of loyalty during employment may, under Colorado common law, result in the forfeiture or disgorgement of compensation paid during the period of disloyalty.

8. Conflict of Interest
8.1 Disclosure Required. Employee shall promptly disclose in writing any actual, potential, or apparent conflict of interest, including:
- Any ownership interest in, employment by, or compensation arrangement with any business that buys textiles or recyclable materials from NCT, sells to NCT, or competes with NCT.
- Any family or romantic relationship with another NCT employee, donor, supplier, or customer that could affect business decisions.
- Any side business engaged in resale of textiles, vintage clothing, or related goods, regardless of whether the inventory is sourced from NCT.
- Any participation in the NCT Reseller Buyer program.
8.2 Resolution. NCT shall determine in its sole discretion whether a disclosed conflict can be managed, requires recusal from specific decisions, or requires cessation of the conflicting activity. Failure to disclose a conflict is itself a material breach of this Agreement.
8.3 Role-Based Eligibility for Reseller Buyer Program. Eligibility to participate in the NCT Reseller Buyer Program as an off-duty Buyer is determined by the Role Responsibilities Addendum applicable to Employee's position. Employees in roles that have visibility into post-intake wholesale or pricing decisions are not eligible to participate in the Buyer Program while holding such positions.

9. Employee Activity as a Reseller-Buyer
9.1 Permitted Status. If Employee's position is identified on the applicable Role Responsibilities Addendum as eligible for the Reseller Buyer Program, Employee may also be a Buyer under the NCT Reseller Buyer Agreement, purchasing whole unsorted Loads from NCT for resale through Employee's own retail or e-commerce channels. Employee's status as a Buyer is a separate, arms-length customer relationship with NCT.
9.2 Strict Separation of Roles. Employee shall maintain a strict separation between the role of NCT employee and the role of NCT customer-Buyer:
1. Employee may participate in Buyer activities only when fully clocked out and not performing any duties for NCT.
2. Employee shall clock out, exit the secure work area, and re-enter through the customer access point before engaging in any Buyer activity.
3. Employee shall not engage in Buyer activity during scheduled work hours, during paid break or meal periods, or in NCT-issued work attire.
4. Employee shall execute and abide by the standalone NCT Reseller Buyer Agreement on the same terms applicable to all other Buyers.
9.3 No Information Advantage. Employee shall not use any Confidential Information — including load arrival schedules, donor route data, pre-sort grading information, or any inventory observation made during the course of work — to inform Employee's purchasing decisions as a Buyer. Specifically:
5. Employee shall not claim, reserve, or purchase any Load that Employee personally received, weighed, sorted, staged, photographed, listed, or had hands-on contact with during the course of employment.
6. Employee shall not claim, reserve, or purchase any Load arriving on a date Employee worked, except where the Load is offered to Employee through the same publicly available queue or notification system used for all other Buyers, with no preferential timing, and only after the standard public claim window has elapsed.
7. Employee shall not solicit, accept, or use any tip-off, advance notice, or insider information from any other NCT employee, supervisor, or manager regarding incoming inventory.
8. Employee shall not share, transmit, or relay any incoming-inventory information to any third party, including any other Buyer.
9.4 Same Pricing and Terms. Employee shall pay the same prices, fees, sales tax, and other charges that any other Buyer would pay for an equivalent Load. No employee discount, rebate, credit, or preferential pricing shall apply unless documented in a separately signed policy approved by NCT management.
9.5 Manager Approval and Logging. Each Load purchased by Employee shall be approved in writing by an NCT manager who is not Employee, and shall be logged with: date and time of purchase, Load identifier, price paid, manager approver, and confirmation that the conditions of Section 9 have been satisfied.
9.6 Resale Limitation: Wholesale Channels. Employee's permitted Buyer activity is for retail or end-consumer resale (e.g., online marketplaces, Employee's own retail store, in-person events). Employee shall not, while employed by NCT, resell purchased inventory through wholesale channels that compete with NCT's wholesale operations.
9.7 NCT's Right to Suspend or Revoke. NCT may, at its sole discretion, suspend or revoke Employee's Buyer privileges at any time, with or without cause, without affecting Employee's status as an employee. Termination of employment does not automatically terminate Buyer privileges, which thereafter are governed by the standard Reseller Buyer Agreement.
9.8 Post-Intake Inventory. The Buyer Program is limited to pre-intake whole-truckload Loads. Inventory that has passed intake sorting and entered the Company's wholesale, ecommerce, or export-bale stream is not available for purchase through the Buyer Program. Baled discard inventory is committed to the Company's commercial export buyer and is not available for purchase by any Buyer, employee, or other party. Employee access to NCT's wholesale reseller portal, if any, is governed by the standard reseller portal terms applicable to all approved resellers.
9.9 Violation Is Material Breach. Violation of any provision of this Section 9 is a material breach of this Agreement and grounds for immediate termination of employment, immediate revocation of Buyer privileges, and any remedies available under this Agreement, the Reseller Buyer Agreement, the Colorado Uniform Trade Secrets Act, the common-law duty of loyalty, and applicable law.

10. Outside Activities and Competing Employment
10.1 Disclosure. Employee shall disclose in writing any other employment, contract work, business ownership, or regular volunteer commitment that could (a) interfere with the performance of duties for NCT, (b) involve textile recycling, sorting, wholesale, or related operations, or (c) create a conflict of interest as defined in Section 8.
10.2 Approval. NCT may, in its sole discretion, prohibit or place reasonable conditions on outside activities that materially interfere with employment or that compete with NCT's textile recycling or wholesale operations.

11. Intellectual Property Assignment
11.1 Assignment. Employee assigns to NCT all right, title, and interest in any inventions, improvements, processes, software, written materials, sorting protocols, training materials, marketing content, photographs, video, listings, and other works of authorship that Employee creates, alone or with others, within the scope of employment or using NCT's resources or Confidential Information.
11.2 Statutory Exclusion. In compliance with C.R.S. § 8-2-113.5, this Section does not apply to any invention for which no equipment, supplies, facilities, or trade secret information of NCT was used and which was developed entirely on Employee's own time, unless: (a) the invention relates at the time of conception or reduction to practice to NCT's business or actual or demonstrably anticipated research or development, or (b) the invention results from any work performed by Employee for NCT.
11.3 Cooperation. Employee shall execute reasonable documents and take reasonable actions to perfect and enforce NCT's rights under this Section, both during and after employment.

12. Return of Property
Upon termination or upon NCT's request, Employee shall immediately return all NCT property, including: keys, key cards, uniforms, equipment, vehicles, fuel cards, mobile devices, computers, login credentials, documents, and any Confidential Information in any medium. Employee shall not retain any copies, including digital copies, screenshots, photographs, or backups.

13. Termination
13.1 Voluntary. Employee may resign at any time. Employee is requested but not required to provide at least two weeks of advance written notice.
13.2 Involuntary. NCT may terminate employment at any time, with or without cause and with or without notice.
13.3 Final Pay. Final wages will be paid in accordance with C.R.S. § 8-4-109. If termination is initiated by NCT, final wages are due immediately. If Employee resigns, final wages are due on the next regular payday.
13.4 Survival. Sections 6, 7 (with respect to acts during employment), 11, 12, 13, and 15 survive termination.

14. Required Notices and Compliance
14.1 Anti-Discrimination. NCT is an equal opportunity employer and complies with the Colorado Anti-Discrimination Act, C.R.S. §§ 24-34-401 et seq., and all applicable federal anti-discrimination laws.
14.2 Whistleblower Protections and POWR Act. NCT will not retaliate against Employee for reporting suspected unlawful conduct or for exercising rights under federal, state, or local law. Nothing in this Agreement limits Employee's right to file a charge or complaint with any government agency, to participate in any agency investigation, to communicate with any government agency, or to discuss workplace conduct that Employee reasonably believes to be unlawful.
14.3 Required Notices. Required posters and notices, including the COMPS Order #39 poster, FAMLI notice, and HFWA notice, are posted at the workplace.

15. Miscellaneous
15.1 Governing Law. This Agreement is governed by Colorado law. Pursuant to C.R.S. § 8-2-113(6), Colorado law governs the enforceability of any restrictive covenant in this Agreement.
15.2 Venue. Disputes shall be resolved exclusively in the state or federal courts located in Larimer County, Colorado.
15.3 Severability. If any provision is held unenforceable, the remaining provisions remain in full force, and a court is authorized to modify any unenforceable provision to the minimum extent necessary to make it enforceable, except no provision void under C.R.S. § 8-2-113 shall be modified.
15.4 Entire Agreement. This Agreement, together with the Position Schedule (Exhibit A), the Conflict-of-Interest Acknowledgment (Exhibit B), and the applicable Role Responsibilities Addendum, constitutes the entire agreement and supersedes all prior agreements between NCT and Employee on these subjects.
15.5 Amendment. This Agreement may be amended only by a writing signed by Employee and an authorized officer of NCT.
15.6 No Waiver. NCT's failure to enforce any provision is not a waiver.
15.7 Counterparts and Electronic Signatures. This Agreement may be signed in counterparts, including by electronic signature.
15.8 Independent Counsel. Employee acknowledges the opportunity to review this Agreement and consult independent counsel before signing.

EXHIBIT B — CONFLICT-OF-INTEREST ACKNOWLEDGMENT
By signing this Employment Agreement, Employee additionally acknowledges that Employee has read Sections 7, 8, and 9 and understands:
1. Employee owes a duty of loyalty to NCT during employment.
2. Employee must promptly disclose any actual, potential, or apparent conflict of interest.
3. While clocked in, Employee shall sort exclusively for NCT and shall not reserve, set aside, or earmark any item for personal acquisition.
4. Eligibility for the Reseller Buyer Program is determined by Employee's Role Responsibilities Addendum. If eligible, Employee will follow the strict separation rules in Section 9.
5. Violation of these provisions is a material breach of this Employment Agreement and may result in immediate termination, revocation of Buyer privileges, disgorgement of compensation, and other legal remedies.$$,
  true
)
on conflict (program_type, template_slug, version_label) do update
set title = excluded.title,
    body_text = excluded.body_text,
    is_active = true;

-- 4b. Role Addendum — Intake Sorter
insert into agreement_templates (
  program_type, template_slug, version_label, title, body_text, is_active
) values (
  'employment',
  'role_addendum_intake_sorter',
  'v2',
  'Role Responsibilities Addendum — Intake Sorter',
  $$NORTHERN COLORADO TEXTILE RECYCLING LLC
d/b/a NCT EMPORIUM
ROLE RESPONSIBILITIES ADDENDUM — Intake Sorter

This Role Responsibilities Addendum supplements the Employment Agreement between Employer and Employee. In the event of any conflict, the Employment Agreement controls.

Note on equipment authorizations: Operation of the industrial baler and operation of the forklift are governed by separate Equipment Operator Authorization documents. An Intake Sorter may be cross-trained and authorized to operate the baler, the forklift, both, or neither, depending on demonstrated competency. Equipment authorization is documented separately and may be granted, suspended, or revoked independently of this role.

1. Role Summary
The Intake Sorter is the first NCT employee to handle a Load after it is brought in or after a Reseller Buyer has completed first-tier sorting. The Intake Sorter classifies items between the Company's resale stream ("keep") and the export bale stream ("discard") according to NCT grading standards. Discard items are staged for baling. The Intake Sorter is the operational gatekeeper between donated/purchased volume and downstream value-extraction. Sorters may, with separate authorization, also operate the baler to compress staged discard and/or operate the forklift to move completed bales.

2. Classification and Compensation
Classification: Non-Exempt (hourly, eligible for overtime)
Eligible for Reseller Buyer Program: YES (subject to Section 9 of the Employment Agreement)
Rate of Pay, Standard Schedule, and Direct Supervisor: as set on Exhibit A.

3. Specific Responsibilities
- Receive and inspect incoming Loads, including those that have completed Reseller Buyer first-tier sorting and those that NCT will sort directly.
- Classify each item as keep (resale stream) or discard (bale stream) according to the published NCT grading standards.
- Apply the grading standards uniformly. Do not under-classify items to discard for any personal benefit, for the benefit of any third party, or in coordination with any Buyer.
- Stage classified items to the appropriate downstream area: keep items to second-tier sort/listing area; discard items to bale-pile staging.
- Load discard items into the baler if and only if Employee holds a current Baler Operator Authorization.
- Operate the forklift to move completed bales if and only if Employee holds a current Forklift Operator Authorization.
- Maintain cleanliness and organization of the intake sort area and surrounding work zones.
- Report damaged donations, hazardous materials (sharp objects, batteries, contaminated items), suspected stolen goods, or biohazards to a supervisor immediately. Do not handle hazardous items.
- Track personal sort throughput in the time-tracking and inventory system as directed.
- Perform other duties consistent with the role as assigned, including assisting with discard-pile recovery work as directed.

4. Required Training
- Hazard Communication training (29 CFR 1910.1200) on first day; annual refresher.
- Bloodborne pathogens awareness training (recommended for textile handling).
- NCT Grading Standards training and proficiency check before solo sorting.
- Walking-working surfaces awareness (29 CFR 1910 Subpart D).
Equipment training (separate authorization required before operation): Baler Operator and Forklift Operator each require their own training, evaluation, and authorization documents. Do not operate either without current authorization on file.

5. Performance Metrics
Employee performance in this role may be evaluated on:
- Sort throughput (items or pounds per hour, normalized to load type).
- Grading accuracy (audit sampling of keep vs discard classification).
- Recovery contribution (rate at which downstream second-tier sort accepts items the Intake Sorter classified as keep).
- Attendance and punctuality.
- Safety record.

6. Required PPE and Safety
Employee shall wear and use the following at all times during work activity:
- Closed-toe shoes at all times on the warehouse floor.
- Cut-resistant or work gloves provided by NCT.
- Optional: dust mask or N95 respirator (provided by NCT on request).
- Hi-vis vest at all times when forklift activity is occurring in shared space.
- Additional PPE as required by Baler or Forklift Operator Authorization, if applicable.
Employee shall comply with all applicable OSHA regulations (29 CFR 1910), report unsafe conditions to a supervisor immediately, and shall not operate any equipment without current authorization.

7. Role-Specific Conflict-of-Interest Provisions
- Intake Sorter is eligible to participate in the Reseller Buyer Program off the clock, subject to Section 9 of the Employment Agreement.
- Intake Sorter shall not claim or purchase any Load that the Sorter personally handled at intake during the course of employment.
- Intake Sorter shall not share information about specific incoming Loads, donor sources, or items observed during sort with any Buyer or third party.
- Intake Sorter shall not under-classify items to discard. Any pattern of under-classification is grounds for performance review and may result in disciplinary action up to and including termination.

8. Acknowledgment
By signing, Employee acknowledges Employee has read and understood this Role Responsibilities Addendum, agrees to perform the responsibilities listed, and agrees to comply with all role-specific provisions. Equipment authorizations are governed by separate documents. This Addendum becomes effective upon signature and remains in effect until Employee's role changes or employment terminates.$$,
  true
)
on conflict (program_type, template_slug, version_label) do update
set title = excluded.title,
    body_text = excluded.body_text,
    is_active = true;

-- 4c. Role Addendum — Inventory & Listing Specialist
insert into agreement_templates (
  program_type, template_slug, version_label, title, body_text, is_active
) values (
  'employment',
  'role_addendum_inventory_listing',
  'v1',
  'Role Responsibilities Addendum — Inventory & Listing Specialist',
  $$NORTHERN COLORADO TEXTILE RECYCLING LLC
d/b/a NCT EMPORIUM
ROLE RESPONSIBILITIES ADDENDUM — Inventory & Listing Specialist

This Role Responsibilities Addendum supplements the Employment Agreement between Employer and Employee. In the event of any conflict between this Addendum and the Employment Agreement, the Employment Agreement controls.

1. Role Summary
The Inventory & Listing Specialist is responsible for the value-acquisition phase of recovered inventory: second-tier sorting, photography, listing creation, condition grading, pricing, and ongoing inventory accuracy for NCT's wholesale reseller portal at nctrecycling.com. This role has direct visibility into pricing, inventory, and demand data and is therefore not eligible for the Reseller Buyer Program.

2. Classification and Compensation
Classification: Non-Exempt (hourly, eligible for overtime)
Eligible for Reseller Buyer Program: NO (per Section 8.3 of the Employment Agreement, this role has visibility into post-intake operations)
Rate of Pay, Standard Schedule, and Direct Supervisor: as set on Exhibit A.

3. Specific Responsibilities
- Receive recovered items from the Intake Sorter and Baler tiers and perform second-tier sorting into specific wholesale categories.
- Photograph items in accordance with NCT photography standards (lighting, angles, condition documentation).
- Write listings: titles, descriptions, condition notes, measurements, and tags as applicable.
- Apply condition grading according to NCT published grading scale.
- Set listing prices according to NCT pricing methodology, comp data, and any pricing-review workflow established by the Company.
- Schedule listings for the timed wholesale portal drop (e.g., weekly Friday release) per NCT schedule.
- Maintain inventory records: SKU assignment, location tracking, status updates from listed to sold to fulfilled.
- Coordinate with the Ecommerce Sales & Shipping role on order fulfillment, inventory holds, and post-sale issues.
- Identify high-value items, slow-moving categories, and pricing anomalies; report to supervisor.
- Maintain cleanliness and organization of the listing studio and inventory storage areas.
- Perform other duties consistent with the role as assigned.

4. Required Training and Certifications
- NCT Grading Standards training and proficiency check before solo listing.
- NCT Photography Standards training.
- NCT Pricing Methodology training.
- CRM and listing-platform proficiency.
- Hazard Communication training (29 CFR 1910.1200) on first day.

5. Performance Metrics
Employee performance in this role may be evaluated on the following metrics:
- Listings created per shift.
- Listing quality audit score (photo quality, description accuracy, grading accuracy).
- Sell-through rate (percentage of listings sold within target window).
- Average margin per listing relative to acquisition cost.
- Inventory accuracy (audit reconciliation).
- Pricing variance from comp data and review workflow.

6. Required PPE and Safety
Employee shall wear and use the following at all times during work activity:
- Closed-toe shoes at all times on the warehouse floor.
- Cut-resistant gloves during sorting (provided on request).
- Hi-vis vest if working near forklift activity.
Employee shall comply with all applicable OSHA regulations (29 CFR 1910), including but not limited to general industry, walking-working surfaces, hazard communication, and the specific standards identified in this Addendum. Employee shall report any unsafe condition to a supervisor immediately and shall not operate any equipment without current authorization.

7. Role-Specific Conflict-of-Interest Provisions
- Inventory & Listing Specialist is NOT eligible to participate in the Reseller Buyer Program while holding this role. This restriction is structural: the role has visibility into post-intake pricing, inventory, and listing decisions that creates an unmanageable conflict of interest with Buyer activity.
- If Employee was previously enrolled as a Reseller Buyer prior to assuming this role, Employee shall terminate Buyer status before signing this Addendum.
- Inventory & Listing Specialist shall not purchase any item from the wholesale reseller portal at any time during employment in this role, regardless of when the listing was created or by whom.
- Inventory & Listing Specialist shall not share pre-drop information about scheduled wholesale listings, including item descriptions, conditions, prices, expected drop dates, or any other listing detail, with any third party.
- Inventory & Listing Specialist shall not set listing prices with any expectation, intention, or arrangement to facilitate a personal or third-party purchase. All pricing decisions must reflect honest market judgment per NCT pricing methodology.
- Listings, photographs, and descriptions created by Employee are works for hire and are assigned to NCT under Section 11 of the Employment Agreement.

8. Acknowledgment
By signing, Employee acknowledges that Employee has read and understood this Role Responsibilities Addendum, agrees to perform the responsibilities listed, and agrees to comply with all role-specific provisions, including the conflict-of-interest provisions and Reseller Buyer Program eligibility status set forth above.$$,
  true
)
on conflict (program_type, template_slug, version_label) do update
set title = excluded.title,
    body_text = excluded.body_text,
    is_active = true;

-- 4d. Role Addendum — Ecommerce Sales & Shipping
insert into agreement_templates (
  program_type, template_slug, version_label, title, body_text, is_active
) values (
  'employment',
  'role_addendum_ecommerce_shipping',
  'v1',
  'Role Responsibilities Addendum — Ecommerce Sales & Shipping',
  $$NORTHERN COLORADO TEXTILE RECYCLING LLC
d/b/a NCT EMPORIUM
ROLE RESPONSIBILITIES ADDENDUM — Ecommerce Sales & Shipping

This Role Responsibilities Addendum supplements the Employment Agreement between Employer and Employee. In the event of any conflict between this Addendum and the Employment Agreement, the Employment Agreement controls.

1. Role Summary
The Ecommerce Sales & Shipping role is responsible for order fulfillment, packaging, shipping, customer communications, returns processing, and post-sale operations for the NCT wholesale reseller portal. This role has direct visibility into customer (reseller) identities, order patterns, and inventory movement and is therefore not eligible for the Reseller Buyer Program.

2. Classification and Compensation
Classification: Non-Exempt (hourly, eligible for overtime)
Eligible for Reseller Buyer Program: NO (per Section 8.3 of the Employment Agreement, this role has visibility into post-intake operations)
Rate of Pay, Standard Schedule, and Direct Supervisor: as set on Exhibit A.

3. Specific Responsibilities
- Process incoming orders from the wholesale reseller portal: pick items, verify SKU and condition match listing, package per NCT shipping standards.
- Generate shipping labels, weigh and dimension packages, dispatch via designated carriers (USPS, UPS, FedEx, freight as applicable).
- Coordinate with the Inventory & Listing Specialist on inventory holds, oversold items, and damaged or misgraded items found during pick.
- Communicate with reseller-customers via the platform messaging system regarding order status, shipping questions, and post-sale issues. Use professional tone; do not share confidential business information.
- Process returns according to NCT return policy: receive returned items, inspect, route to appropriate disposition (relist, regrade, discard).
- Track packaging supply inventory and reorder as needed.
- Maintain shipping area cleanliness, organization, and safety.
- Generate and review fulfillment metrics; flag delays, recurring complaints, or carrier issues to supervisor.
- Perform other duties consistent with the role as assigned.

4. Required Training and Certifications
- Shipping platform / carrier label-generation proficiency.
- NCT packaging standards training.
- CRM and order-management system proficiency.
- Customer service basics training.
- Hazard Communication training (29 CFR 1910.1200) on first day.

5. Performance Metrics
Employee performance in this role may be evaluated on the following metrics:
- Orders fulfilled per shift.
- Time-to-ship (order received to label generated, target window).
- Pick accuracy (correct SKU, correct condition, correct quantity).
- Shipping cost variance vs. quoted/charged shipping.
- Customer satisfaction (platform feedback ratings, complaint frequency).
- Return rate and return reason distribution.
- Damage/loss rate in transit (carrier-attributable vs. packaging-attributable).

6. Required PPE and Safety
Employee shall wear and use the following at all times during work activity:
- Closed-toe shoes at all times in shipping area.
- Back support / proper lifting practices for packages over 25 lbs; team lift required over 50 lbs.
- Cut-resistant gloves when opening incoming returns or packaging materials.
- Hi-vis vest if working near forklift activity in shared dock space.
Employee shall comply with all applicable OSHA regulations (29 CFR 1910), including but not limited to general industry, walking-working surfaces, hazard communication, and the specific standards identified in this Addendum.

7. Role-Specific Conflict-of-Interest Provisions
- Ecommerce Sales & Shipping is NOT eligible to participate in the Reseller Buyer Program while holding this role. The role has visibility into customer order patterns, item movement, and post-sale issues that creates a conflict of interest with Buyer activity.
- If Employee was previously enrolled as a Reseller Buyer prior to assuming this role, Employee shall terminate Buyer status before signing this Addendum.
- Ecommerce Sales & Shipping shall not purchase any item from the wholesale reseller portal at any time during employment in this role.
- Ecommerce Sales & Shipping shall not share customer (reseller) identities, order history, or order patterns with any third party. Customer information is Confidential Information under Section 6 of the Employment Agreement.
- Ecommerce Sales & Shipping shall not retain, set aside, or earmark any item during pick, packaging, or returns processing for personal acquisition.
- Communications generated by Employee on behalf of NCT are works for hire and are assigned to NCT under Section 11 of the Employment Agreement.

8. Acknowledgment
By signing, Employee acknowledges that Employee has read and understood this Role Responsibilities Addendum, agrees to perform the responsibilities listed, and agrees to comply with all role-specific provisions, including the conflict-of-interest provisions and Reseller Buyer Program eligibility status set forth above.$$,
  true
)
on conflict (program_type, template_slug, version_label) do update
set title = excluded.title,
    body_text = excluded.body_text,
    is_active = true;

-- 4e. Baler Operator Authorization
insert into agreement_templates (
  program_type, template_slug, version_label, title, body_text, is_active
) values (
  'employment',
  'baler_operator_authorization',
  'v1',
  'NCT Baler Operator Authorization',
  $$NORTHERN COLORADO TEXTILE RECYCLING LLC
d/b/a NCT EMPORIUM
BALER OPERATOR AUTHORIZATION

Purpose. This document authorizes the named Employee to operate the NCT industrial baler. It is a layered authorization that supplements the Employee's Role Responsibilities Addendum and Employment Agreement. It does not authorize forklift operation; forklift operation requires separate authorization.

1. Required Training (must be completed before authorization)
By signing this authorization, Employee certifies that the trainer has covered, and Employee has demonstrated proficiency in, each of the following:
- Manufacturer operator manual review and walkthrough.
- Live demonstration of baler operation by qualified trainer or supervisor.
- Identification of all controls: start, stop, reverse, emergency stop, safety interlocks.
- Identification of all guards, doors, and safety devices. Trainee acknowledges that no guard or interlock may be bypassed under any circumstance.
- Lockout/Tagout (LOTO) procedure under 29 CFR 1910.147 — demonstrated proficiency. Trainee can identify all energy sources (electrical, hydraulic) and apply LOTO before any servicing, jam clearing, maintenance, or cleaning.
- Hazard recognition: pinch points, crushing hazards, hydraulic injection injury, fall hazards from material handling.
- Loading procedure: how to safely load discard into baler, what items must NOT be loaded (rigid objects, hazardous materials, unknown sealed containers, items prohibited by NCT policy).
- Bale tying procedure: how to safely tie off a completed bale.
- Bale weight target (1,000 lb ± NCT tolerance) and how to verify.
- Hazard Communication training (29 CFR 1910.1200) for any chemicals encountered (cleaners, hydraulic fluid).
- Emergency procedures: what to do if a person is caught in the baler, baler malfunction, fire, or hydraulic leak.
- First-aid awareness and location of first-aid supplies.
- Demonstration of competency by trainee — trainee successfully operates baler under supervision through full cycle.

2. Operating Rules
When operating the baler, Employee shall:
- Inspect the baler before each shift: hydraulic levels, controls function, guards and interlocks intact, work area clear, electrical panel accessible.
- Wear required PPE: steel-toe or composite-toe footwear, cut-resistant gloves, safety glasses (Z87.1-rated), and any additional PPE specified by NCT.
- Never bypass, defeat, or disable any guard, interlock, or emergency stop.
- Apply LOTO before any servicing, jam clearing, cleaning, or non-routine adjustment. Do not reach into the baler chamber under any circumstance unless LOTO is in place.
- Never operate the baler with another person inside, near, or reaching into the chamber.
- Stop operation immediately and notify a supervisor if any malfunction, unusual noise, leak, or guard issue is observed.
- Maintain accurate bale logs as directed (count, weight, date).
- Keep the work area clear of trip hazards, accumulated material, and personnel during baler cycles.
- Operate the baler only in good physical and mental condition. Do not operate while impaired by fatigue, illness, medication, alcohol, or any controlled substance.

3. Suspension and Revocation
NCT may suspend or revoke this authorization at any time, with or without cause, in its sole discretion. Authorization is automatically suspended pending re-evaluation in any of the following events:
- Any baler-related incident, injury, or near-miss.
- Any LOTO violation.
- Any bypass or defeat of a guard, interlock, or safety device.
- Any 6-month or longer period of non-use.
- Failure to complete scheduled re-evaluation by the due date.

4. Re-Evaluation
Re-evaluation should be performed at minimum every 36 months and after any incident, near-miss, or extended period of non-use.

5. Authorization
By signing, the Employee certifies that the Employee has completed all required training items in Section 1, demonstrated competent operation of the baler under supervision, understands the operating rules in Section 2, and agrees to operate the baler only in compliance with these rules and all applicable OSHA regulations.$$,
  true
)
on conflict (program_type, template_slug, version_label) do update
set title = excluded.title,
    body_text = excluded.body_text,
    is_active = true;

-- 4f. Forklift Operator Authorization
insert into agreement_templates (
  program_type, template_slug, version_label, title, body_text, is_active
) values (
  'employment',
  'forklift_operator_authorization',
  'v1',
  'NCT Forklift Operator Authorization',
  $$NORTHERN COLORADO TEXTILE RECYCLING LLC
d/b/a NCT EMPORIUM
FORKLIFT OPERATOR AUTHORIZATION

Purpose. This document authorizes the named Employee to operate the NCT forklift (Powered Industrial Truck) in compliance with 29 CFR 1910.178. It is required by federal regulation that no employee operate a forklift without documented training, evaluation, and authorization. Re-evaluation is required at minimum every three years per 29 CFR 1910.178(l)(4)(iii).

1. Required Training under 29 CFR 1910.178(l)
By signing this authorization, Employee certifies that the trainer has covered, and Employee has demonstrated proficiency in, each of the following:

Truck-related topics:
- Operating instructions, warnings, and precautions for the type of truck the Employee will operate.
- Differences between the truck and an automobile.
- Truck controls and instrumentation: location, function, method of operation.
- Engine or motor operation.
- Steering and maneuvering.
- Visibility (including restrictions due to loading).
- Fork and attachment adaptation, operation, and use limitations.
- Vehicle capacity and stability.
- Vehicle inspection and maintenance the operator is required to perform.
- Refueling or recharging batteries.
- Operating limitations.

Workplace-related topics:
- Surface conditions where the truck will be operated.
- Composition of likely loads (1,000-lb bales) and load stability.
- Load manipulation, stacking, and unstacking.
- Pedestrian traffic in operating areas.
- Narrow aisles and other restricted places of operation.
- Hazardous (classified) locations, if applicable.
- Operating in closed environments and other areas where insufficient ventilation could cause buildup of carbon monoxide or diesel exhaust.
- Other unique or potentially hazardous environmental conditions in the workplace that could affect safe operation.

Practical evaluation:
- Trainee operates truck under direct supervision of the trainer through pre-defined practical scenarios.
- Trainer evaluates trainee performance directly. Authorization is granted only upon successful evaluation.

2. Operating Rules
When operating the forklift, Employee shall:
- Perform daily pre-operation inspection. Document any issue and do not operate a defective truck.
- Wear required PPE: steel-toe or composite-toe footwear, hi-vis vest, and any additional PPE specified by NCT.
- Operate within the rated capacity of the truck and within the load center stamped on the data plate.
- Travel with forks low (4–6 inches off the floor) and tilted back when carrying a load.
- Sound horn at intersections, blind corners, and when pedestrians are nearby.
- Do not allow any person to ride on the truck unless the truck is designed for a passenger.
- Do not allow any person to walk or stand under elevated forks (loaded or unloaded).
- Do not use the forklift to lift personnel unless using an OSHA-compliant approved work platform.
- Maintain safe stopping distance at all speeds; reduce speed on wet, uneven, or sloped surfaces.
- Park the truck only in designated areas with forks lowered to the floor, controls neutralized, parking brake engaged, and key removed (if applicable).
- Stop operation and notify a supervisor if any malfunction is observed.
- Operate only in good physical and mental condition. Do not operate while impaired by fatigue, illness, medication, alcohol, or any controlled substance.

3. Refresher Training and Re-Evaluation
29 CFR 1910.178(l)(4) requires refresher training in any of the following circumstances:
- The operator has been observed operating the vehicle in an unsafe manner.
- The operator has been involved in an accident or near-miss incident.
- The operator has received an evaluation indicating unsafe operation.
- The operator is assigned to drive a different type of truck.
- A condition in the workplace changes in a manner that could affect safe operation.
Mandatory re-evaluation: At minimum every three years, an evaluation of each operator's performance shall be conducted per 29 CFR 1910.178(l)(4)(iii). This is a federal requirement, not a recommendation.

4. Suspension and Revocation
NCT may suspend or revoke this authorization at any time. Authorization is automatically suspended pending re-evaluation in any of the following events:
- Any forklift-related incident, accident, or near-miss.
- Any observed unsafe operating practice.
- Any 6-month or longer period of non-use.
- Assignment to a different type of truck without prior training on that type.
- Failure to complete the mandatory 36-month re-evaluation by the due date.

5. Authorization
By signing, the Employee certifies that the Employee has completed all required training items in Section 1, demonstrated competent operation of the forklift through the practical evaluation, understands the operating rules in Section 2, and agrees to operate the forklift only in compliance with these rules and all applicable OSHA regulations.$$,
  true
)
on conflict (program_type, template_slug, version_label) do update
set title = excluded.title,
    body_text = excluded.body_text,
    is_active = true;

-- ---------------------------------------------------------------
-- 5. employee_profiles flag for onboarding completion
-- ---------------------------------------------------------------
alter table employee_profiles
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz;
