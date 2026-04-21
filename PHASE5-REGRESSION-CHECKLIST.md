# Phase 5 Manual Regression Checklist

Use this after Phase 4 database verification is complete. Mark each item with pass/fail notes during live validation.

## Pre-Manual Smoke Validation

- `npm run build` completed successfully on April 21, 2026.
- Public routes rendered locally without server errors: `/`, `/apply`, `/co-op-apply`.
- Protected UI routes redirected to login locally as expected when unauthenticated: `/nonprofit/dashboard`, `/discard/dashboard`, `/admin`.
- Auth pages rendered locally: `/login`, `/auth/forgot-password`.
- Protected API routes failed closed locally instead of throwing server errors:
	- `GET /api/admin/dashboard` -> `401`
	- `GET /api/nonprofit/bag-count` -> `401`
	- `GET /api/discard/request-pickup` -> `401`
	- `GET /api/account` -> `405` on unauthenticated GET, which is consistent with a non-GET-only handler rather than a crash

## 1. Co-op Application Flow - Application submitted successfully

- Submit a new co-op application from `/co-op-apply`.
- Confirm the new applicant appears in admin co-op applications with canonical status/account details.
- Approve the applicant in admin and confirm the status updates correctly.
- Log into the partner account and confirm the nonprofit dashboard shows the expected status, account type, and agreement state.

## 2. Discard Onboarding Flow

- Create or update a discard account in admin.
- Upload a signed discard agreement in admin. - NO DISCARD AGREEMENT BUTTON VISABLE AFTER THE DISCARD ACCOUNT IS SELECTED. CANNOT UPLOAD OR VIEW ONE AFTER CREATION.
- Confirm the discard partner can download the agreement from the discard dashboard.
- Confirm the discard dashboard shows the expected canonical status and account details.

## 3. Co-op Bag Count And Pickup Requests - NO BAG COUNT LOGGING OPTION, I CAN ONLY SEE WHAT WAS PREVIOUSLY LOGGED.

- Log a co-op bag count from the nonprofit dashboard.
- Confirm the admin bag levels screen reflects the new count.
- Submit a co-op pickup request from the nonprofit dashboard.
- Confirm the admin pickup request queue shows the request.
- Cancel or schedule the request and confirm the partner dashboard reflects the updated state.

## 4. Discard Bag Count, Pickup Requests, And Payments - BAG LEVELS NOT UPDATING ON ADMIN DASHBOARD

- Log a discard bag count from the discard dashboard.
- Confirm the admin discard bag count screen reflects the updated count.
- Submit a discard pickup request from the discard dashboard.
- Confirm the admin discard request queue shows the request.
- Log a discard pickup in admin and confirm the discard partner payment history reflects it.
- Update the pickup payment status in admin and confirm the partner dashboard reflects the change.

## 5. Route And Shopping Day Flow - REMAINS UNTESTED LIVE UPDATES WILL TRIGGER EMAILS TO RESELLERS. WILL TEST THIS LIVE WITH AN ACTIVE ROUTE.

- Create a route in admin using co-op stops with live pending requests.
- Confirm the route appears in admin routes and any linked shopping day reflects capacity/linkage correctly.
- Complete a stop normally and confirm bags collected roll up correctly.
- Complete a stop with `no inventory` and confirm partial/full route completion semantics remain correct.
- Complete the route and confirm partner recent pickup history updates.

## 6. Cross-Surface Consistency

- Compare admin co-op account status with the nonprofit dashboard status for the same organization.
- Compare admin discard account status with the discard dashboard status for the same organization.
- Confirm agreement visibility is consistent between admin and partner surfaces.
- Confirm pickup history and request status are consistent between admin and partner surfaces.

## 7. Release Gate

- No Phase 5 scenario has a blocking failure.
- Any non-blocking discrepancies are documented with owner and follow-up plan.
- Admin and partner surfaces agree on status, agreement, and history state.
- Release sign-off is ready.