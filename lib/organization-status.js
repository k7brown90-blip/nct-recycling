function getNestedRecord(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

export function getProgramStatusPresentation(status) {
  switch (status) {
    case "active":
      return { label: "Active", cardClass: "bg-green-50 border-green-300", textClass: "text-green-800", eyebrowClass: "text-green-700" };
    case "pending_review":
      return { label: "Pending Review", cardClass: "bg-yellow-50 border-yellow-300", textClass: "text-yellow-800", eyebrowClass: "text-yellow-700" };
    case "pending_partner_finalization":
      return { label: "Pending Finalization", cardClass: "bg-yellow-50 border-yellow-300", textClass: "text-yellow-800", eyebrowClass: "text-yellow-700" };
    case "invited":
      return { label: "Invited", cardClass: "bg-blue-50 border-blue-300", textClass: "text-blue-800", eyebrowClass: "text-blue-700" };
    case "inactive":
      return { label: "Inactive", cardClass: "bg-gray-50 border-gray-200", textClass: "text-gray-700", eyebrowClass: "text-gray-500" };
    case "terminated":
      return { label: "Terminated", cardClass: "bg-red-50 border-red-300", textClass: "text-red-800", eyebrowClass: "text-red-700" };
    case "denied":
      return { label: "Denied", cardClass: "bg-red-50 border-red-300", textClass: "text-red-800", eyebrowClass: "text-red-700" };
    default:
      return { label: "Active", cardClass: "bg-green-50 border-green-300", textClass: "text-green-800", eyebrowClass: "text-green-700" };
  }
}

export async function getCanonicalProgramSnapshot(db, sourceTable, sourceId) {
  const { data: orgMap, error: orgMapError } = await db
    .from("migration_organization_map")
    .select("organization_id")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (orgMapError) {
    if (orgMapError.code === "42P01" || orgMapError.code === "PGRST205") return null;
    throw orgMapError;
  }

  const { data: enrollmentMap, error: enrollmentMapError } = await db
    .from("migration_enrollment_map")
    .select("enrollment_id")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (enrollmentMapError) {
    if (enrollmentMapError.code === "42P01" || enrollmentMapError.code === "PGRST205") return null;
    throw enrollmentMapError;
  }

  if (!orgMap?.organization_id || !enrollmentMap?.enrollment_id) {
    return null;
  }

  const { data: enrollment, error: enrollmentError } = await db
    .from("current_organization_enrollments")
    .select("*")
    .eq("enrollment_id", enrollmentMap.enrollment_id)
    .maybeSingle();

  if (enrollmentError) {
    if (enrollmentError.code === "42P01" || enrollmentError.code === "PGRST205") return null;
    throw enrollmentError;
  }

  const { data: agreementPackets, error: agreementError } = await db
    .from("agreement_packets")
    .select("id, signed_at, agreement_signatures(signer_name, signer_title, signer_email, signed_at)")
    .eq("enrollment_id", enrollmentMap.enrollment_id)
    .order("signed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (agreementError && agreementError.code !== "42P01" && agreementError.code !== "PGRST205") {
    throw agreementError;
  }

  const latestPacket = agreementPackets?.[0] || null;
  const latestSignature = getNestedRecord(latestPacket?.agreement_signatures);

  return {
    organizationId: orgMap.organization_id,
    enrollmentId: enrollmentMap.enrollment_id,
    legalName: enrollment?.legal_name || null,
    mainEmail: enrollment?.main_email || null,
    mainPhone: enrollment?.main_phone || null,
    lifecycleStatus: enrollment?.lifecycle_status || null,
    startedAt: enrollment?.activated_at || enrollment?.enrollment_created_at || null,
    accountType: enrollment?.co_op_account_type || enrollment?.discard_account_type || null,
    agreementSignedAt: latestSignature?.signed_at || latestPacket?.signed_at || null,
    agreementSignerName: latestSignature?.signer_name || null,
  };
}