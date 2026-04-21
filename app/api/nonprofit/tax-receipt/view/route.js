import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (!profile || profile.role !== "nonprofit") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { lot_id } = await request.json();
  if (!lot_id) return NextResponse.json({ error: "Missing lot_id." }, { status: 400 });

  // Verify the lot belongs to this nonprofit
  const { data: lot } = await db
    .from("tax_receipts")
    .select("receipt_file_path")
    .eq("id", lot_id)
    .eq("application_id", profile.application_id)
    .single();

  if (!lot?.receipt_file_path) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

  const { data: signedUrl, error } = await db.storage
    .from("nonprofit-docs")
    .createSignedUrl(lot.receipt_file_path, 300);

  if (error || !signedUrl) return NextResponse.json({ error: "Could not generate link." }, { status: 500 });

  return NextResponse.json({ url: signedUrl.signedUrl });
}
