import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Server-side OTP verification that bypasses Supabase's PKCE-only `verify`
// endpoint. Required for admin-generated invite/recovery/magiclink emails
// because those flows never set a PKCE code_verifier in the user's browser.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") || "/dashboard";

  // Resolve the destination URL up front so we can fall back to a friendly
  // error page when the link is malformed or already redeemed.
  const safeNext = next.startsWith("/") ? next : "/dashboard";
  const failureUrl = `${origin}/auth/update-password?error=link_expired`;

  if (!token_hash || !type) {
    return NextResponse.redirect(failureUrl);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) {
    console.error("auth/confirm verifyOtp failed:", error.message);
    return NextResponse.redirect(failureUrl);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
