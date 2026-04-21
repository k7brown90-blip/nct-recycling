import { createServiceClient } from "@/lib/supabase";
import { createSignedStorageUrl, findSignedAgreementDocumentForLegacySource } from "@/lib/agreement-documents";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request) {
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

  const legacyUrl = await createSignedStorageUrl(db, "nonprofit-docs", `agreements/${profile.application_id}.pdf`, 300);
  if (legacyUrl) {
    return NextResponse.json({ url: legacyUrl });
  }

  const canonicalDocument = await findSignedAgreementDocumentForLegacySource(db, "nonprofit_applications", profile.application_id);
  if (canonicalDocument?.storage_bucket && canonicalDocument?.storage_path) {
    const canonicalUrl = await createSignedStorageUrl(db, canonicalDocument.storage_bucket, canonicalDocument.storage_path, 300);
    if (canonicalUrl) {
      return NextResponse.json({ url: canonicalUrl });
    }
  }

  return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
}
