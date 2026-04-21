# NCT Portal Canonical Cutover Execution Checklist

## Hard Stop Definitions

### Code Complete Stop
- All co-op and discard admin and partner surfaces are canonical-first in application behavior.
- Legacy tables remain only as mirrors or compatibility fallbacks.
- No known P1/P2 functional gaps remain in code.

### 100% Complete Stop
- Code Complete Stop is reached.
- Supabase canonical migrations are applied to the live environment.
- Mapping/backfill verification is complete.
- End-to-end regression is complete across admin, co-op, discard, reseller, route, and shopping-day flows.

## Phase 1 - Admin Data Cutover

### Pass Criteria
- [x] Admin dashboard counts are canonical-aware.
- [x] Co-op apps and discard accounts show canonical status/account/agreement state.
- [x] Admin bag levels and pickup requests are canonical-aware.
- [x] Admin route APIs are canonical-aware.
- [x] Admin shopping-day capacity/linkage is canonical-aware.
- [x] Admin route UI explicitly surfaces completion type and no-inventory semantics cleanly.
- [x] Remaining admin legacy-primary screens are reviewed and either cut over or intentionally deferred.

### Deferred / Out Of Canonical Scope
- Reseller admin flows remain on reseller-native tables and are not part of the co-op/discard canonical cutover.
- Warehouse-only admin flows such as exchange appointments, container requests, IRS letters, and tax receipts remain on their existing tables unless later unified by a separate project.

### Stop Point
- Admin code freeze.

## Phase 2 - Partner Data Cutover

### Pass Criteria
- [x] Co-op partner status/agreement summary is canonical-aware.
- [x] Discard partner status/agreement summary is canonical-aware.
- [x] Nonprofit recent pickups have canonical fallback.
- [x] Discard pickup/payment history is canonical-first.
- [x] Remaining partner loaders are reviewed for legacy-primary reads.

### Stop Point
- Partner code freeze.

## Phase 3 - Operational Source-of-Truth Cutover

### Pass Criteria
- [x] Co-op pickup requests, bag counts, routes, and stop completion dual-write into canonical state.
- [x] Discard requests, bag counts, pickups, payouts, and agreements dual-write into canonical state.
- [x] Legacy reads no longer control behavior where canonical data exists.
- [x] Legacy tables are classified as mirror, compatibility, or historical-only.

### Legacy Table Classification
- Compatibility profile stores: `nonprofit_applications`, `discard_accounts` remain the legacy account/profile records used for UI hydration, account editing, and invite linkage while canonical organization and enrollment records carry operational state.
- Mirror operational tables: `bag_counts`, `discard_bag_counts`, `nonprofit_pickup_requests`, `discard_pickup_requests`, `pickup_routes`, `pickup_route_stops`, and `discard_pickups` remain dual-written compatibility mirrors while canonical inventory, request, run, stop, and payout tables drive behavior.
- Out-of-scope warehouse/reseller tables: `exchange_appointments`, `container_requests`, `shopping_days`, reseller-native tables, IRS letter records, and tax receipt records remain on their existing models unless a later unification project targets them.

### Stop Point
- Backend feature-complete cutover.

## Phase 4 - Database Migration and Verification

### Pass Criteria
- [x] Canonical migrations v17-v19 are applied to the target Supabase environment.
- [x] Mapping tables are verified for co-op and discard coverage.
- [x] Agreement/doc/request/run/stop backfills are verified.
- [x] Any duplicate or unmapped legacy rows are reconciled.

### Verified So Far
- User reported `supabase-schema-v17.sql`, `supabase-schema-v18.sql`, and `supabase-schema-v19.sql` executed successfully against the target Supabase environment with no SQL errors.
- Phase 4 summary verification returned `PASS` for all reported checks, including:
	- nonprofit organization/enrollment map coverage: `7 / 7`
	- discard organization/enrollment map coverage: `4 / 4`
	- nonprofit/discard pickup request mappings: `0` unmapped
	- route/discard pickup run mappings: `0` unmapped
	- co-op agreement packet backfill gaps: `0`
	- discard agreement placeholder backfill gaps: `0`
	- duplicate organization/enrollment/request/run mappings: `0`
	- helper views returning live rows: enrollments `11`, inventory `3`, admin pickup queue `5`

### Remaining Database Verification
- Phase 4 is complete. Use [c:/Users/Kyle/Desktop/NCT Recycling/supabase-phase4-verification.sql](c:/Users/Kyle/Desktop/NCT%20Recycling/supabase-phase4-verification.sql) or [c:/Users/Kyle/Desktop/NCT Recycling/supabase-phase4-summary.sql](c:/Users/Kyle/Desktop/NCT%20Recycling/supabase-phase4-summary.sql) for future spot checks.

### Stop Point
- Database cutover complete.

## Phase 5 - End-to-End Validation and Release

### Pass Criteria
- [ ] Co-op application to admin approval to partner dashboard flow passes.
- [ ] Discard account onboarding, agreement upload/download, and partner access pass.
- [ ] Co-op bag count and pickup request lifecycle passes.
- [ ] Discard bag count, pickup request, pickup logging, and payment lifecycle pass.
- [ ] Route creation, stop completion, route completion, and shopping-day behavior pass.
- [ ] Admin and partner views agree on status, agreement, and history state.

### Stop Point
- Release-ready / 100% complete.

## Immediate Execution Order

1. Run the full manual regression checklist.
2. Reconcile any Phase 5 failures discovered during live validation.
3. Confirm release-ready sign-off across admin and partner flows.