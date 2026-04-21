function isMissingRelationError(error) {
  return Boolean(
    error && (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.message?.includes("Could not find the table")
    )
  );
}

async function runOptional(queryPromise) {
  const { data, error } = await queryPromise;
  if (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw error;
  }
  return data;
}

export function getDiscardAgreementStoragePath(accountId) {
  return `discard-agreements/${accountId}/signed-agreement.pdf`;
}

export async function getCanonicalContextForLegacySource(db, sourceTable, sourceId) {
  const orgMap = await runOptional(
    db
      .from("migration_organization_map")
      .select("organization_id")
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId)
      .maybeSingle()
  );

  const enrollmentMap = await runOptional(
    db
      .from("migration_enrollment_map")
      .select("enrollment_id")
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId)
      .maybeSingle()
  );

  if (!orgMap?.organization_id || !enrollmentMap?.enrollment_id) {
    return null;
  }

  return {
    organizationId: orgMap.organization_id,
    enrollmentId: enrollmentMap.enrollment_id,
  };
}

export async function findSignedAgreementDocumentForLegacySource(db, sourceTable, sourceId) {
  const context = await getCanonicalContextForLegacySource(db, sourceTable, sourceId);
  if (!context) {
    return null;
  }

  const rows = await runOptional(
    db
      .from("organization_documents")
      .select("id, storage_bucket, storage_path, original_filename, mime_type, uploaded_at")
      .eq("enrollment_id", context.enrollmentId)
      .eq("document_type", "signed_agreement")
      .eq("status", "active")
      .order("uploaded_at", { ascending: false })
      .limit(1)
  );

  return rows?.[0] || null;
}

export async function upsertCanonicalSignedAgreementDocument(db, sourceTable, sourceId, document) {
  const context = await getCanonicalContextForLegacySource(db, sourceTable, sourceId);
  if (!context) {
    return false;
  }

  await runOptional(
    db
      .from("organization_documents")
      .update({ status: "superseded" })
      .eq("enrollment_id", context.enrollmentId)
      .eq("document_type", "signed_agreement")
      .eq("status", "active")
  );

  const { error } = await db.from("organization_documents").insert({
    organization_id: context.organizationId,
    enrollment_id: context.enrollmentId,
    document_type: "signed_agreement",
    status: "active",
    storage_bucket: document.storageBucket,
    storage_path: document.storagePath,
    original_filename: document.originalFilename,
    mime_type: document.mimeType,
    metadata: {
      legacy_source_table: sourceTable,
      legacy_source_id: sourceId,
      uploaded_from: document.uploadedFrom || "admin_upload",
    },
  });

  if (error) {
    if (isMissingRelationError(error)) {
      return false;
    }
    throw error;
  }

  return true;
}

export async function createSignedStorageUrl(db, bucket, path, expiresIn = 300) {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}