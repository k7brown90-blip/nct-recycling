import { createServiceClient } from "@/lib/supabase";
import { createSignedStorageUrl, findSignedAgreementDocumentForLegacySource, getDiscardAgreementStoragePath, upsertCanonicalSignedAgreementDocument } from "@/lib/agreement-documents";
import { syncDiscardAccountToCanonical } from "@/lib/discard-canonical";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account_id");
  if (!accountId) return NextResponse.json({ error: "Missing account_id." }, { status: 400 });

  const db = createServiceClient();
  const canonicalDocument = await findSignedAgreementDocumentForLegacySource(db, "discard_accounts", accountId);
  if (canonicalDocument?.storage_bucket && canonicalDocument?.storage_path) {
    const canonicalUrl = await createSignedStorageUrl(db, canonicalDocument.storage_bucket, canonicalDocument.storage_path, 300);
    if (canonicalUrl) {
      return NextResponse.json({ url: canonicalUrl });
    }
  }

  const fallbackUrl = await createSignedStorageUrl(db, "nonprofit-docs", getDiscardAgreementStoragePath(accountId), 300);
  if (fallbackUrl) {
    return NextResponse.json({ url: fallbackUrl });
  }

  return NextResponse.json({ missing: true });
}

export async function POST(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const formData = await request.formData();
  const accountId = formData.get("account_id");
  const agreementFile = formData.get("agreement_file");

  if (!accountId || !agreementFile || agreementFile.size <= 0) {
    return NextResponse.json({ error: "account_id and agreement_file are required." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: account, error: accountError } = await db
    .from("discard_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Discard account not found." }, { status: 404 });
  }

  const storagePath = getDiscardAgreementStoragePath(accountId);
  const { error: uploadError } = await db.storage
    .from("nonprofit-docs")
    .upload(storagePath, agreementFile, {
      contentType: agreementFile.type || "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Failed to upload agreement." }, { status: 500 });
  }

  try {
    await syncDiscardAccountToCanonical(db, account);
    await upsertCanonicalSignedAgreementDocument(db, "discard_accounts", accountId, {
      storageBucket: "nonprofit-docs",
      storagePath,
      originalFilename: agreementFile.name || "signed-agreement.pdf",
      mimeType: agreementFile.type || "application/pdf",
      uploadedFrom: "admin_discard_upload",
    });
  } catch (canonicalError) {
    console.error("Discard agreement canonical sync error:", canonicalError);
  }

  const url = await createSignedStorageUrl(db, "nonprofit-docs", storagePath, 300);
  return NextResponse.json({ success: true, url });
}