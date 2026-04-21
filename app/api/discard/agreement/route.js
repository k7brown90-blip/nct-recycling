import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { createSignedStorageUrl, findSignedAgreementDocumentForLegacySource, getDiscardAgreementStoragePath } from "@/lib/agreement-documents";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (!profile || profile.role !== "discard" || !profile.discard_account_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const canonicalDocument = await findSignedAgreementDocumentForLegacySource(db, "discard_accounts", profile.discard_account_id);
  if (canonicalDocument?.storage_bucket && canonicalDocument?.storage_path) {
    const canonicalUrl = await createSignedStorageUrl(db, canonicalDocument.storage_bucket, canonicalDocument.storage_path, 300);
    if (canonicalUrl) {
      return NextResponse.json({ url: canonicalUrl });
    }
  }

  const fallbackUrl = await createSignedStorageUrl(db, "nonprofit-docs", getDiscardAgreementStoragePath(profile.discard_account_id), 300);
  if (fallbackUrl) {
    return NextResponse.json({ url: fallbackUrl });
  }

  return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
}