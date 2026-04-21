import { CO_OP_AGREEMENT } from "@/lib/agreement-text";

function normalizeOptional(value) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseInteger(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const digits = String(value).replace(/[^0-9]/g, "");
  if (!digits) {
    return null;
  }

  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMissingRelationError(error) {
  return Boolean(
    error && (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.message?.includes("Could not find the table") ||
      error.message?.includes("relation")
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

export function mapLegacyCoOpStatusToLifecycle(status) {
  if (status === "approved") return "active";
  if (status === "denied") return "denied";
  return "pending_review";
}

function mapCoOpLifecycleToOrganizationStatus(status) {
  if (status === "active") return "active";
  if (status === "denied") return "inactive";
  return "draft";
}

async function findExistingOrganization(supabase, { orgName, email, ein }) {
  if (ein) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id")
      .eq("ein", ein)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.id) {
      return data;
    }
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("legal_name", orgName)
    .eq("main_email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getActiveCoOpTemplateId(supabase) {
  const { data: existingTemplate, error: selectError } = await supabase
    .from("agreement_templates")
    .select("id")
    .eq("program_type", "co_op")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingTemplate?.id) {
    return existingTemplate.id;
  }

  const { data: insertedTemplate, error: insertError } = await supabase
    .from("agreement_templates")
    .insert({
      program_type: "co_op",
      template_slug: "co_op_participation",
      version_label: "v1-app-live",
      title: "NCT Recycling Co-Op Network Participation Agreement",
      body_text: CO_OP_AGREEMENT,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedTemplate.id;
}

export async function syncCanonicalCoOpApplication(supabase, payload) {
  const {
    legacyApplicationId,
    orgName,
    orgType,
    ein,
    contactName,
    contactTitle,
    email,
    phone,
    website,
    addressStreet,
    addressCity,
    addressState,
    addressZip,
    pickupAddress,
    dockInstructions,
    availablePickupHours,
    pickupNotes,
    estimatedDonationLbs,
    categoriesNeeded,
    featureConsent,
    contractAgreedAt,
    contractSignedName,
    authorizedTitle,
    irsLetterStoragePath,
    irsLetterOriginalFilename,
    irsLetterMimeType,
    agreementStoragePath,
    agreementOriginalFilename,
  } = payload;

  const existingOrganization = await findExistingOrganization(supabase, {
    orgName,
    email,
    ein,
  });

  const organizationRecord = {
    legal_name: orgName,
    display_name: orgName,
    org_type: normalizeOptional(orgType),
    status: "draft",
    website: normalizeOptional(website),
    ein: normalizeOptional(ein),
    tax_exempt_status: "pending_verification",
    main_email: email,
    main_phone: normalizeOptional(phone),
    address_street: normalizeOptional(addressStreet),
    address_city: normalizeOptional(addressCity),
    address_state: normalizeOptional(addressState),
    address_zip: normalizeOptional(addressZip),
    pickup_address: normalizeOptional(pickupAddress),
    pickup_access_notes: normalizeOptional(pickupNotes),
    dock_instructions: normalizeOptional(dockInstructions),
    available_pickup_hours: normalizeOptional(availablePickupHours),
    internal_notes: null,
  };

  let organizationId = existingOrganization?.id ?? null;

  if (organizationId) {
    const { error: updateError } = await supabase
      .from("organizations")
      .update(organizationRecord)
      .eq("id", organizationId);

    if (updateError) {
      throw updateError;
    }
  } else {
    const { data: insertedOrganization, error: insertError } = await supabase
      .from("organizations")
      .insert(organizationRecord)
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    organizationId = insertedOrganization.id;
  }

  const { data: existingEnrollment, error: enrollmentSelectError } = await supabase
    .from("organization_program_enrollments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("program_type", "co_op")
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();

  if (enrollmentSelectError) {
    throw enrollmentSelectError;
  }

  const enrollmentRecord = {
    organization_id: organizationId,
    program_type: "co_op",
    onboarding_source: "public_application",
    lifecycle_status: "pending_review",
    is_current: true,
    applied_at: contractAgreedAt,
    submitted_at: contractAgreedAt,
    partner_notes: normalizeOptional(pickupNotes),
  };

  let enrollmentId = existingEnrollment?.id ?? null;

  if (enrollmentId) {
    const { error: updateEnrollmentError } = await supabase
      .from("organization_program_enrollments")
      .update(enrollmentRecord)
      .eq("id", enrollmentId);

    if (updateEnrollmentError) {
      throw updateEnrollmentError;
    }
  } else {
    const { data: insertedEnrollment, error: insertEnrollmentError } = await supabase
      .from("organization_program_enrollments")
      .insert(enrollmentRecord)
      .select("id")
      .single();

    if (insertEnrollmentError) {
      throw insertEnrollmentError;
    }

    enrollmentId = insertedEnrollment.id;
  }

  const { error: detailsError } = await supabase
    .from("co_op_program_details")
    .upsert(
      {
        enrollment_id: enrollmentId,
        account_type: "ltl",
        categories_needed: categoriesNeeded?.length ? categoriesNeeded : null,
        onsite_contact: normalizeOptional(contactName),
        feature_consent: Boolean(featureConsent),
        default_estimated_bags: parseInteger(estimatedDonationLbs),
      },
      { onConflict: "enrollment_id" }
    );

  if (detailsError) {
    throw detailsError;
  }

  let irsDocumentId = null;
  if (irsLetterStoragePath) {
    const { data: irsDocument, error: irsDocumentError } = await supabase
      .from("organization_documents")
      .insert({
        organization_id: organizationId,
        enrollment_id: enrollmentId,
        document_type: "irs_letter",
        status: "active",
        storage_bucket: "nonprofit-docs",
        storage_path: irsLetterStoragePath,
        original_filename: normalizeOptional(irsLetterOriginalFilename),
        mime_type: normalizeOptional(irsLetterMimeType),
        metadata: {
          legacy_source_table: "nonprofit_applications",
          legacy_source_id: legacyApplicationId,
        },
      })
      .select("id")
      .single();

    if (irsDocumentError) {
      throw irsDocumentError;
    }

    irsDocumentId = irsDocument.id;
  }

  let signedAgreementDocumentId = null;
  if (agreementStoragePath) {
    const { data: agreementDocument, error: agreementDocumentError } = await supabase
      .from("organization_documents")
      .insert({
        organization_id: organizationId,
        enrollment_id: enrollmentId,
        document_type: "signed_agreement",
        status: "active",
        storage_bucket: "nonprofit-docs",
        storage_path: agreementStoragePath,
        original_filename: normalizeOptional(agreementOriginalFilename),
        mime_type: "application/pdf",
        metadata: {
          legacy_source_table: "nonprofit_applications",
          legacy_source_id: legacyApplicationId,
          contract_signed_name: contractSignedName,
          irs_document_id: irsDocumentId,
        },
      })
      .select("id")
      .single();

    if (agreementDocumentError) {
      throw agreementDocumentError;
    }

    signedAgreementDocumentId = agreementDocument.id;
  }

  const templateId = await getActiveCoOpTemplateId(supabase);

  const { data: agreementPacket, error: packetError } = await supabase
    .from("agreement_packets")
    .insert({
      organization_id: organizationId,
      enrollment_id: enrollmentId,
      template_id: templateId,
      status: "signed",
      generated_from: {
        legacy_source_table: "nonprofit_applications",
        legacy_source_id: legacyApplicationId,
        contact_name: contactName,
        contact_title: contactTitle,
        email,
      },
      rendered_body: CO_OP_AGREEMENT,
      signed_pdf_document_id: signedAgreementDocumentId,
      signed_at: contractAgreedAt,
    })
    .select("id")
    .single();

  if (packetError) {
    throw packetError;
  }

  const { error: signatureError } = await supabase
    .from("agreement_signatures")
    .insert({
      agreement_packet_id: agreementPacket.id,
      signer_name: contractSignedName,
      signer_title: normalizeOptional(authorizedTitle),
      signer_email: email,
      signature_method: "typed_acceptance",
      accepted_terms: true,
      signed_at: contractAgreedAt,
    });

  if (signatureError) {
    throw signatureError;
  }

  return {
    organizationId,
    enrollmentId,
    irsDocumentId,
    signedAgreementDocumentId,
    agreementPacketId: agreementPacket.id,
  };
}

export async function syncCanonicalCoOpAdminState(supabase, application) {
  const orgMap = await runOptional(
    supabase
      .from("migration_organization_map")
      .select("organization_id")
      .eq("source_table", "nonprofit_applications")
      .eq("source_id", application.id)
      .maybeSingle()
  );

  const enrollmentMap = await runOptional(
    supabase
      .from("migration_enrollment_map")
      .select("enrollment_id")
      .eq("source_table", "nonprofit_applications")
      .eq("source_id", application.id)
      .maybeSingle()
  );

  if (!orgMap?.organization_id || !enrollmentMap?.enrollment_id) {
    return null;
  }

  const lifecycleStatus = mapLegacyCoOpStatusToLifecycle(application.status);

  const { error: organizationError } = await supabase
    .from("organizations")
    .update({
      legal_name: normalizeOptional(application.org_name),
      display_name: normalizeOptional(application.org_name),
      org_type: normalizeOptional(application.org_type),
      status: mapCoOpLifecycleToOrganizationStatus(lifecycleStatus),
      website: normalizeOptional(application.website),
      main_email: normalizeOptional(application.email),
      main_phone: normalizeOptional(application.phone),
      address_street: normalizeOptional(application.address_street),
      address_city: normalizeOptional(application.address_city),
      address_state: normalizeOptional(application.address_state),
      address_zip: normalizeOptional(application.address_zip),
      pickup_address: normalizeOptional(application.pickup_address),
      dock_instructions: normalizeOptional(application.dock_instructions),
      available_pickup_hours: normalizeOptional(application.available_pickup_hours),
      internal_notes: normalizeOptional(application.admin_notes),
    })
    .eq("id", orgMap.organization_id);

  if (organizationError && !isMissingRelationError(organizationError)) {
    throw organizationError;
  }

  const enrollmentUpdates = {
    lifecycle_status: lifecycleStatus,
    partner_notes: normalizeOptional(application.admin_notes),
  };

  if (lifecycleStatus === "active") {
    enrollmentUpdates.activated_at = application.reviewed_at || new Date().toISOString();
  }

  const { error: enrollmentError } = await supabase
    .from("organization_program_enrollments")
    .update(enrollmentUpdates)
    .eq("id", enrollmentMap.enrollment_id);

  if (enrollmentError && !isMissingRelationError(enrollmentError)) {
    throw enrollmentError;
  }

  const { error: detailsError } = await supabase
    .from("co_op_program_details")
    .upsert(
      {
        enrollment_id: enrollmentMap.enrollment_id,
        account_type: normalizeOptional(application.account_type) || "ltl",
        onsite_contact: normalizeOptional(application.contact_name),
        feature_consent: Boolean(application.feature_consent),
        default_estimated_bags: parseInteger(application.estimated_bags),
      },
      { onConflict: "enrollment_id" }
    );

  if (detailsError && !isMissingRelationError(detailsError)) {
    throw detailsError;
  }

  return {
    organizationId: orgMap.organization_id,
    enrollmentId: enrollmentMap.enrollment_id,
    lifecycleStatus,
  };
}