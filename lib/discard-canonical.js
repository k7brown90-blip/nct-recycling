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

function mapCanonicalStatusToLegacy(status) {
  if (status === "reviewed") return "pending";
  if (status === "declined") return "cancelled";
  return status;
}

function mapLegacyStatusToCanonical(status) {
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "scheduled") return "scheduled";
  return "pending";
}

function getNestedRecord(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function mapInventoryEventToLegacyEntry(event) {
  let entryType = "add";

  if (event.event_type === "pickup_collected") {
    entryType = "pickup";
  } else if (event.event_type === "adjustment" || event.event_type === "reset") {
    entryType = "adjustment";
  }

  return {
    id: event.id,
    bag_count: event.quantity_bags || 0,
    entry_type: entryType,
    notes: event.notes,
    created_at: event.created_at,
  };
}

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeLifecycleStatus(status) {
  if (status === "inactive") return "inactive";
  if (status === "terminated") return "terminated";
  return "active";
}

export async function getDiscardCanonicalContext(db, legacyAccountId) {
  const orgMap = await runOptional(
    db
      .from("migration_organization_map")
      .select("organization_id")
      .eq("source_table", "discard_accounts")
      .eq("source_id", legacyAccountId)
      .maybeSingle()
  );

  const enrollmentMap = await runOptional(
    db
      .from("migration_enrollment_map")
      .select("enrollment_id")
      .eq("source_table", "discard_accounts")
      .eq("source_id", legacyAccountId)
      .maybeSingle()
  );

  if (!orgMap?.organization_id || !enrollmentMap?.enrollment_id) {
    return null;
  }

  const enrollmentDetails = await runOptional(
    db
      .from("current_organization_enrollments")
      .select("discard_account_type")
      .eq("enrollment_id", enrollmentMap.enrollment_id)
      .maybeSingle()
  );

  return {
    organizationId: orgMap.organization_id,
    enrollmentId: enrollmentMap.enrollment_id,
    accountType: enrollmentDetails?.discard_account_type || "ltl",
  };
}

async function ensureDiscardCanonicalContext(db, legacyAccountId) {
  const existing = await getDiscardCanonicalContext(db, legacyAccountId);
  if (existing) {
    return existing;
  }

  const legacyAccount = await runOptional(
    db
      .from("discard_accounts")
      .select("*")
      .eq("id", legacyAccountId)
      .maybeSingle()
  );

  if (!legacyAccount) {
    return null;
  }

  await syncDiscardAccountToCanonical(db, legacyAccount);
  return getDiscardCanonicalContext(db, legacyAccountId);
}

export async function getCanonicalDiscardBagCount(db, legacyAccountId, limit = 30) {
  const context = await getDiscardCanonicalContext(db, legacyAccountId);
  if (!context) {
    return null;
  }

  const inventory = await runOptional(
    db
      .from("current_organization_inventory")
      .select("current_bag_count")
      .eq("enrollment_id", context.enrollmentId)
      .maybeSingle()
  );

  const events = await runOptional(
    db
      .from("inventory_events")
      .select("id, quantity_bags, event_type, notes, created_at")
      .eq("enrollment_id", context.enrollmentId)
      .order("created_at", { ascending: false })
      .limit(limit)
  );

  if (inventory === null && events === null) {
    return null;
  }

  const allEntries = (events || []).map(mapInventoryEventToLegacyEntry);
  const sinceLastPickup = [];
  for (const entry of allEntries) {
    if (entry.entry_type === "pickup") {
      break;
    }
    sinceLastPickup.push(entry);
  }

  const fallbackTotal = sinceLastPickup.reduce((sum, entry) => sum + (entry.bag_count || 0), 0);

  return {
    total: Math.max(Number(inventory?.current_bag_count ?? fallbackTotal ?? 0), 0),
    entries: allEntries,
    allEntries,
    sinceLastPickup,
  };
}

export async function addCanonicalDiscardBagCount(db, legacyAccountId, bagCount, notes) {
  const context = await getDiscardCanonicalContext(db, legacyAccountId);
  if (!context) {
    return false;
  }

  const result = await runOptional(
    db.from("inventory_events").insert({
      organization_id: context.organizationId,
      enrollment_id: context.enrollmentId,
      event_type: "reported_add",
      quantity_bags: bagCount,
      notes: normalizeNullableString(notes),
    })
  );

  return result !== null;
}

export async function markCanonicalDiscardPickupCollected(db, legacyAccountId) {
  const snapshot = await getCanonicalDiscardBagCount(db, legacyAccountId, 10);
  if (!snapshot) {
    return false;
  }

  if (!snapshot.total) {
    return true;
  }

  const context = await getDiscardCanonicalContext(db, legacyAccountId);
  if (!context) {
    return false;
  }

  const result = await runOptional(
    db.from("inventory_events").insert({
      organization_id: context.organizationId,
      enrollment_id: context.enrollmentId,
      event_type: "pickup_collected",
      quantity_bags: snapshot.total,
      notes: "Admin marked as picked up",
    })
  );

  return result !== null;
}

export async function getCanonicalDiscardRequests(db, legacyAccountId) {
  const context = await getDiscardCanonicalContext(db, legacyAccountId);
  if (!context) {
    return null;
  }

  const requests = await runOptional(
    db
      .from("pickup_requests")
      .select("id, created_at, preferred_date, scheduled_date, estimated_bags, estimated_weight_lbs, notes, admin_notes, status")
      .eq("enrollment_id", context.enrollmentId)
      .order("created_at", { ascending: false })
  );

  if (requests === null) {
    return null;
  }

  return requests.map((request) => ({
    ...request,
    status: mapCanonicalStatusToLegacy(request.status),
  }));
}

export async function getCanonicalDiscardPickups(db, legacyAccountId) {
  const context = await ensureDiscardCanonicalContext(db, legacyAccountId);
  if (!context) {
    return null;
  }

  const stops = await runOptional(
    db
      .from("pickup_run_stops")
      .select(`
        id,
        pickup_run_id,
        created_at,
        actual_weight_lbs,
        notes,
        completed_at,
        pickup_runs (scheduled_date, scheduled_time, status, notes),
        pickup_payouts (amount_owed, payment_status, payment_method, payment_date, calculated_from, notes)
      `)
      .eq("enrollment_id", context.enrollmentId)
      .order("created_at", { ascending: false })
  );

  if (stops === null) {
    return null;
  }

  const mappings = await runOptional(
    db
      .from("migration_pickup_run_map")
      .select("source_id, pickup_run_id")
      .eq("source_table", "discard_pickups")
  );

  const runIdToLegacyId = new Map((mappings || []).map((row) => [row.pickup_run_id, row.source_id]));

  return (stops || []).map((stop) => {
    const run = getNestedRecord(stop.pickup_runs);
    const payout = getNestedRecord(stop.pickup_payouts);
    const calculatedFrom = payout?.calculated_from || {};

    return {
      id: runIdToLegacyId.get(stop.pickup_run_id) || stop.id,
      account_id: legacyAccountId,
      pickup_date: run?.scheduled_date || stop.completed_at?.split("T")?.[0] || null,
      pickup_time: run?.scheduled_time || null,
      weight_lbs: stop.actual_weight_lbs || 0,
      load_type: calculatedFrom.legacy_load_type || "recurring",
      amount_owed: payout?.amount_owed ?? 0,
      payment_status: payout?.payment_status || "pending",
      payment_method: payout?.payment_method || null,
      payment_date: payout?.payment_date || null,
      accepted: calculatedFrom.legacy_rejected ? false : true,
      rejection_reason: calculatedFrom.legacy_rejection_reason || null,
      notes: payout?.notes || stop.notes || run?.notes || null,
      created_at: stop.created_at,
    };
  });
}

export async function createCanonicalDiscardPickupRequest(db, legacyRequestId, legacyAccountId, payload) {
  const context = await ensureDiscardCanonicalContext(db, legacyAccountId);
  if (!context) {
    return false;
  }

  const { data, error } = await db
    .from("pickup_requests")
    .insert({
      organization_id: context.organizationId,
      enrollment_id: context.enrollmentId,
      request_channel: "partner_portal",
      request_type: context.accountType === "fl" ? "full_load_pickup" : "ltl_pickup",
      preferred_date: payload.preferred_date || null,
      estimated_bags: payload.estimated_bags ?? null,
      estimated_weight_lbs: payload.estimated_weight_lbs ?? null,
      notes: normalizeNullableString(payload.notes),
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      return false;
    }
    throw error;
  }

  const mapResult = await runOptional(
    db.from("migration_pickup_request_map").upsert(
      {
        source_table: "discard_pickup_requests",
        source_id: legacyRequestId,
        pickup_request_id: data.id,
      },
      { onConflict: "source_table,source_id" }
    )
  );

  return mapResult !== null;
}

export async function updateCanonicalDiscardPickupRequest(db, legacyRequestId, updates) {
  const mapping = await runOptional(
    db
      .from("migration_pickup_request_map")
      .select("pickup_request_id")
      .eq("source_table", "discard_pickup_requests")
      .eq("source_id", legacyRequestId)
      .maybeSingle()
  );

  if (!mapping?.pickup_request_id) {
    return false;
  }

  const canonicalUpdates = {};

  if (updates.status !== undefined) {
    canonicalUpdates.status = mapLegacyStatusToCanonical(updates.status);
    canonicalUpdates.completed_at = updates.status === "completed" ? new Date().toISOString() : null;
    canonicalUpdates.cancelled_at = updates.status === "cancelled" ? new Date().toISOString() : null;
  }
  if (updates.admin_notes !== undefined) {
    canonicalUpdates.admin_notes = normalizeNullableString(updates.admin_notes);
  }
  if (updates.scheduled_date !== undefined) {
    canonicalUpdates.scheduled_date = updates.scheduled_date || null;
  }

  const result = await runOptional(
    db.from("pickup_requests").update(canonicalUpdates).eq("id", mapping.pickup_request_id)
  );

  return result !== null;
}

export async function createCanonicalDiscardPickup(db, legacyPickupId, legacyAccountId, payload) {
  const context = await ensureDiscardCanonicalContext(db, legacyAccountId);
  if (!context) {
    return false;
  }

  const runNotes = normalizeNullableString(payload.notes);
  const stopNotes = [
    normalizeNullableString(payload.notes),
    payload.accepted === false ? `Rejected: ${normalizeNullableString(payload.rejection_reason) || "No reason recorded"}` : null,
  ].filter(Boolean).join("\n") || null;

  const { data: run, error: runError } = await db
    .from("pickup_runs")
    .insert({
      run_type: "single_run",
      scheduled_date: payload.pickup_date,
      scheduled_time: payload.pickup_time || null,
      status: "completed",
      completion_type: "full",
      notes: runNotes,
    })
    .select("id")
    .single();

  if (runError) {
    if (isMissingRelationError(runError)) {
      return false;
    }
    throw runError;
  }

  await runOptional(
    db.from("migration_pickup_run_map").upsert(
      {
        source_table: "discard_pickups",
        source_id: legacyPickupId,
        pickup_run_id: run.id,
      },
      { onConflict: "source_table,source_id" }
    )
  );

  const { data: stop, error: stopError } = await db
    .from("pickup_run_stops")
    .insert({
      pickup_run_id: run.id,
      organization_id: context.organizationId,
      enrollment_id: context.enrollmentId,
      actual_weight_lbs: payload.weight_lbs,
      no_inventory: false,
      stop_status: "completed",
      completed_at: new Date().toISOString(),
      notes: stopNotes,
    })
    .select("id")
    .single();

  if (stopError) {
    throw stopError;
  }

  const payoutResult = await runOptional(
    db.from("pickup_payouts").insert({
      pickup_run_stop_id: stop.id,
      organization_id: context.organizationId,
      enrollment_id: context.enrollmentId,
      amount_owed: payload.amount_owed,
      payment_status: payload.accepted === false ? "voided" : payload.payment_status,
      payment_method: payload.payment_method || null,
      payment_date: payload.payment_date || null,
      calculated_from: {
        legacy_load_type: payload.load_type || "recurring",
        legacy_rejected: payload.accepted === false,
        legacy_rejection_reason: payload.rejection_reason || null,
      },
      notes: runNotes,
    })
  );

  return payoutResult !== null;
}

export async function updateCanonicalDiscardPickup(db, legacyPickupId, updates) {
  const mapping = await runOptional(
    db
      .from("migration_pickup_run_map")
      .select("pickup_run_id")
      .eq("source_table", "discard_pickups")
      .eq("source_id", legacyPickupId)
      .maybeSingle()
  );

  if (!mapping?.pickup_run_id) {
    return false;
  }

  const stop = await runOptional(
    db
      .from("pickup_run_stops")
      .select("id")
      .eq("pickup_run_id", mapping.pickup_run_id)
      .maybeSingle()
  );

  if (!stop?.id) {
    return false;
  }

  const payoutUpdates = {};
  if (updates.payment_status !== undefined) payoutUpdates.payment_status = updates.payment_status;
  if (updates.payment_method !== undefined) payoutUpdates.payment_method = updates.payment_method || null;
  if (updates.payment_date !== undefined) payoutUpdates.payment_date = updates.payment_date || null;
  if (updates.amount_owed !== undefined) payoutUpdates.amount_owed = updates.amount_owed;
  if (updates.notes !== undefined) payoutUpdates.notes = normalizeNullableString(updates.notes);

  if (Object.keys(payoutUpdates).length > 0) {
    const payoutResult = await runOptional(
      db.from("pickup_payouts").update(payoutUpdates).eq("pickup_run_stop_id", stop.id)
    );

    if (payoutResult === null) {
      return false;
    }
  }

  if (updates.notes !== undefined) {
    await runOptional(
      db.from("pickup_run_stops").update({ notes: normalizeNullableString(updates.notes) }).eq("id", stop.id)
    );
    await runOptional(
      db.from("pickup_runs").update({ notes: normalizeNullableString(updates.notes) }).eq("id", mapping.pickup_run_id)
    );
  }

  return true;
}

export async function deleteCanonicalDiscardPickup(db, legacyPickupId) {
  const mapping = await runOptional(
    db
      .from("migration_pickup_run_map")
      .select("pickup_run_id")
      .eq("source_table", "discard_pickups")
      .eq("source_id", legacyPickupId)
      .maybeSingle()
  );

  if (!mapping?.pickup_run_id) {
    return false;
  }

  const result = await runOptional(
    db.from("pickup_runs").delete().eq("id", mapping.pickup_run_id)
  );

  return result !== null;
}

export async function syncDiscardAccountToCanonical(db, legacyAccount) {
  const existingContext = await getDiscardCanonicalContext(db, legacyAccount.id);

  let organizationId = existingContext?.organizationId || null;
  if (!organizationId) {
    const { data: insertedOrganization, error: organizationError } = await db
      .from("organizations")
      .insert({
        legal_name: legacyAccount.org_name,
        display_name: legacyAccount.org_name,
        status: legacyAccount.status === "active" ? "active" : "inactive",
        main_email: normalizeNullableString(legacyAccount.contact_email),
        main_phone: normalizeNullableString(legacyAccount.contact_phone),
        address_street: normalizeNullableString(legacyAccount.address_street),
        address_city: normalizeNullableString(legacyAccount.address_city),
        address_state: normalizeNullableString(legacyAccount.address_state),
        address_zip: normalizeNullableString(legacyAccount.address_zip),
        pickup_address: normalizeNullableString(legacyAccount.address_street),
        pickup_city: normalizeNullableString(legacyAccount.address_city),
        pickup_state: normalizeNullableString(legacyAccount.address_state),
        pickup_zip: normalizeNullableString(legacyAccount.address_zip),
        internal_notes: normalizeNullableString(legacyAccount.notes),
      })
      .select("id")
      .single();

    if (organizationError) {
      if (isMissingRelationError(organizationError)) {
        return false;
      }
      throw organizationError;
    }

    organizationId = insertedOrganization.id;
    await runOptional(
      db.from("migration_organization_map").upsert(
        {
          source_table: "discard_accounts",
          source_id: legacyAccount.id,
          organization_id: organizationId,
        },
        { onConflict: "source_table,source_id" }
      )
    );
  } else {
    await runOptional(
      db.from("organizations").update({
        legal_name: legacyAccount.org_name,
        display_name: legacyAccount.org_name,
        status: legacyAccount.status === "active" ? "active" : "inactive",
        main_email: normalizeNullableString(legacyAccount.contact_email),
        main_phone: normalizeNullableString(legacyAccount.contact_phone),
        address_street: normalizeNullableString(legacyAccount.address_street),
        address_city: normalizeNullableString(legacyAccount.address_city),
        address_state: normalizeNullableString(legacyAccount.address_state),
        address_zip: normalizeNullableString(legacyAccount.address_zip),
        pickup_address: normalizeNullableString(legacyAccount.address_street),
        pickup_city: normalizeNullableString(legacyAccount.address_city),
        pickup_state: normalizeNullableString(legacyAccount.address_state),
        pickup_zip: normalizeNullableString(legacyAccount.address_zip),
        internal_notes: normalizeNullableString(legacyAccount.notes),
      }).eq("id", organizationId)
    );
  }

  let enrollmentId = existingContext?.enrollmentId || null;
  if (!enrollmentId) {
    const { data: insertedEnrollment, error: enrollmentError } = await db
      .from("organization_program_enrollments")
      .insert({
        organization_id: organizationId,
        program_type: "discard",
        onboarding_source: "admin_created",
        lifecycle_status: normalizeLifecycleStatus(legacyAccount.status),
        is_current: true,
        activated_at: legacyAccount.status === "active" ? new Date().toISOString() : null,
        submitted_at: legacyAccount.contract_date || null,
        partner_notes: normalizeNullableString(legacyAccount.notes),
      })
      .select("id")
      .single();

    if (enrollmentError) {
      if (isMissingRelationError(enrollmentError)) {
        return false;
      }
      throw enrollmentError;
    }

    enrollmentId = insertedEnrollment.id;
    await runOptional(
      db.from("migration_enrollment_map").upsert(
        {
          source_table: "discard_accounts",
          source_id: legacyAccount.id,
          enrollment_id: enrollmentId,
        },
        { onConflict: "source_table,source_id" }
      )
    );
  } else {
    await runOptional(
      db.from("organization_program_enrollments").update({
        lifecycle_status: normalizeLifecycleStatus(legacyAccount.status),
        partner_notes: normalizeNullableString(legacyAccount.notes),
      }).eq("id", enrollmentId)
    );
  }

  await runOptional(
    db.from("discard_program_details").upsert(
      {
        enrollment_id: enrollmentId,
        account_type: legacyAccount.account_type || "ltl",
        pickup_frequency: legacyAccount.pickup_frequency || "weekly",
        projected_lbs_week: legacyAccount.projected_lbs_week ?? null,
        negotiated_rate_per_1000_lbs: legacyAccount.rate_per_1000_lbs ?? null,
        flat_rate_per_pickup: legacyAccount.flat_rate_per_pickup ?? null,
        min_lbs_weekly: legacyAccount.min_lbs_weekly ?? null,
        min_lbs_biweekly: legacyAccount.min_lbs_biweekly ?? null,
        min_lbs_monthly: legacyAccount.min_lbs_biweekly ?? null,
        min_lbs_adhoc: legacyAccount.min_lbs_adhoc ?? null,
        initial_term_months: 12,
        termination_notice_days: 60,
        agreement_generated_at: legacyAccount.contract_date || null,
      },
      { onConflict: "enrollment_id" }
    )
  );

  return true;
}