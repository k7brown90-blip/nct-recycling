import { createServiceClient } from "@/lib/supabase";
import { upsertProfileRecord } from "@/lib/auth-profile";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// POST — called when the user clicks "Activate" on the activate page.
// Generates a fresh one-time Supabase auth link on-demand.
// Because the Supabase link is never embedded in the email or URL,
// email security scanners can't consume it before the real user clicks.
// Each button click generates a fresh, independent auth token.
export async function POST(request) {
  const { discard_token } = await request.json();

  if (!discard_token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const db = createServiceClient();

  // Look up the account by invite token — must not be expired
  const { data: account, error: lookupError } = await db
    .from("discard_accounts")
    .select("id, contact_email, user_id, org_name, contact_name")
    .eq("invite_token", discard_token)
    .gt("invite_expires_at", new Date().toISOString())
    .maybeSingle();

  if (lookupError || !account) {
    return NextResponse.json({
      error: "This activation link has expired or is invalid. Ask NCT Recycling to send a new invite.",
    }, { status: 404 });
  }

  const email = account.contact_email;
  if (!email) {
    return NextResponse.json({ error: "No email on file for this account." }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/update-password%3Fwelcome%3Dtrue`;

  let actionLink;

  if (!account.user_id) {
    // New user — generate an invite link (creates the user in Supabase auth)
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo, data: { role: "discard", discard_account_id: account.id, setup_required: true } },
    });

    if (inviteError) {
      // User exists in auth but we don't have their user_id yet — fall through to magiclink below
      console.warn("Invite link failed, falling back to magiclink:", inviteError.message);
    } else {
      // Upsert profile and link user_id to account
      await upsertProfileRecord({
        id: inviteData.user.id,
        role: "discard",
        discard_account_id: account.id,
      }, db);
      await db.from("discard_accounts").update({ user_id: inviteData.user.id }).eq("id", account.id);
      actionLink = inviteData.properties.action_link;
    }
  }

  if (!actionLink) {
    // User already exists (either we just found out, or user_id was already set) — use magiclink
    const { data: magicData, error: magicError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (magicError) {
      console.error("Magiclink generation failed:", magicError.message);
      return NextResponse.json({ error: "Failed to generate login link. Please contact NCT Recycling." }, { status: 500 });
    }

    // Ensure profile and account link are correct
    await upsertProfileRecord({
      id: magicData.user.id,
      role: "discard",
      discard_account_id: account.id,
    }, db);
    await db.from("discard_accounts").update({ user_id: magicData.user.id }).eq("id", account.id);
    actionLink = magicData.properties.action_link;
  }

  return NextResponse.json({ link: actionLink });
}
