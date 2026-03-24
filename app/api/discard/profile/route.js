import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

async function getDiscardAccountId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("role, discard_account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "discard" || !profile?.discard_account_id) return null;
  return profile.discard_account_id;
}

export async function GET() {
  const account_id = await getDiscardAccountId();
  if (!account_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data: account, error } = await db
    .from("discard_accounts")
    .select("*")
    .eq("id", account_id)
    .maybeSingle();

  if (error || !account) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({ account });
}
