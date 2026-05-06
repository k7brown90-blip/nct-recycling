// Helpers for building auth links from Supabase admin.generateLink() results.
//
// We deliberately do NOT use the Supabase verify endpoint (action_link) for
// admin-generated invite/recovery/magiclink emails. That endpoint, under the
// project's PKCE flow, redirects with a `?code=` that requires a code_verifier
// cookie set during a *client-side* sign-in call. Admin-generated links never
// set one, so exchangeCodeForSession fails and the user lands on a session-less
// page. Instead, we surface the `hashed_token` to our own /auth/confirm route
// and call `verifyOtp` server-side, which sets cookies directly.

const SITE_URL = () => process.env.NEXT_PUBLIC_SITE_URL;

// URL for an interstitial activation page (shown when we want the user to see
// branded copy before redeeming the token).
export function buildActivateUrl(properties, { next } = {}) {
  const url = new URL(`${SITE_URL()}/auth/activate`);
  url.searchParams.set("token_hash", properties.hashed_token);
  url.searchParams.set("type", properties.verification_type);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

// URL that immediately redeems the token and redirects to `next`.
export function buildConfirmUrl(properties, { next } = {}) {
  const url = new URL(`${SITE_URL()}/auth/confirm`);
  url.searchParams.set("token_hash", properties.hashed_token);
  url.searchParams.set("type", properties.verification_type);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
