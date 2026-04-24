import { markCanonicalCoOpPickupCollected } from "@/lib/co-op-canonical";
import { markCanonicalDiscardPickupCollected } from "@/lib/discard-canonical";

const ROUTE_BAG_WEIGHT_LBS = 20;

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

function getNestedRecord(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapPendingRequest(request) {
  if (!request) return null;

  return {
    id: request.id,
    preferred_date: request.preferred_date || null,
    scheduled_date: request.scheduled_date || null,
    estimated_bags: request.estimated_bags ?? null,
    estimated_weight_lbs: request.estimated_weight_lbs ?? null,
    fill_level: request.fill_level || null,
    notes: request.notes || null,
    admin_notes: request.admin_notes || null,
    created_at: request.created_at,
    status: request.status,
  };
}

function buildOrganizationRecord(account, payout = null) {
  return {
    id: account.organization_id,
    org_name: account.org_name,
    email: account.email,
    phone: account.phone,
    address_street: account.address_street,
    address_city: account.address_city,
    address_state: account.address_state,
    address_zip: account.address_zip,
    pickup_address: account.pickup_address,
    pickup_city: account.pickup_city,
    pickup_state: account.pickup_state,
    pickup_zip: account.pickup_zip,
    pickup_access_notes: account.pickup_access_notes,
    dock_instructions: account.dock_instructions,
    available_pickup_hours: account.available_pickup_hours,
    program_type: account.program_type,
    account_type: account.account_type,
    payout,
  };
}

async function updateLegacyRequestsAfterScheduling(db, stops, scheduledDate) {
  const nonprofitIds = [...new Set((stops || []).map((stop) => stop.nonprofit_id).filter(Boolean))];
  if (nonprofitIds.length > 0) {
    await runOptional(
      db
        .from("nonprofit_pickup_requests")
        .update({ status: "scheduled" })
        .in("nonprofit_id", nonprofitIds)
        .eq("status", "pending")
    );
  }

  const flNonprofitIds = [...new Set(
    (stops || [])
      .filter((stop) => stop.nonprofit_id && stop.account_type === "fl")
      .map((stop) => stop.nonprofit_id)
  )];
  if (flNonprofitIds.length > 0) {
    await runOptional(
      db
        .from("container_pickup_requests")
        .update({ status: "scheduled", scheduled_date: scheduledDate })
        .in("application_id", flNonprofitIds)
        .in("status", ["pending", "reviewed"])
    );
  }

  const discardAccountIds = [...new Set((stops || []).map((stop) => stop.discard_account_id).filter(Boolean))];
  if (discardAccountIds.length > 0) {
    await runOptional(
      db
        .from("discard_pickup_requests")
        .update({ status: "scheduled", scheduled_date: scheduledDate })
        .in("discard_account_id", discardAccountIds)
        .eq("status", "pending")
    );
  }
}

async function getAccountMaps(db, enrollmentIds) {
  const ids = enrollmentIds?.filter(Boolean) || [];
  if (ids.length === 0) {
    return {
      inventoryByEnrollmentId: new Map(),
      requestByEnrollmentId: new Map(),
      legacyByEnrollmentId: new Map(),
      organizationById: new Map(),
      enrollmentRows: [],
    };
  }

  const [enrollmentRows, inventoryRows, requestRows, legacyRows, organizationRows] = await Promise.all([
    runOptional(
      db
        .from("current_organization_enrollments")
        .select("*")
        .in("enrollment_id", ids)
    ),
    runOptional(
      db
        .from("current_organization_inventory")
        .select("enrollment_id, current_bag_count, last_inventory_event_at")
        .in("enrollment_id", ids)
    ),
    runOptional(
      db
        .from("pickup_requests")
        .select("id, enrollment_id, preferred_date, scheduled_date, estimated_bags, estimated_weight_lbs, fill_level, notes, admin_notes, created_at, status")
        .in("enrollment_id", ids)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    ),
    runOptional(
      db
        .from("migration_enrollment_map")
        .select("enrollment_id, source_table, source_id")
        .in("enrollment_id", ids)
        .in("source_table", ["nonprofit_applications", "discard_accounts"])
    ),
    runOptional(
      db
        .from("organizations")
        .select("id, address_street, address_city, address_state, address_zip, pickup_address, pickup_city, pickup_state, pickup_zip, pickup_access_notes, dock_instructions, available_pickup_hours")
        .in("id", (enrollmentRows || []).map((row) => row.organization_id).filter(Boolean))
    ),
  ]);

  const inventoryByEnrollmentId = new Map((inventoryRows || []).map((row) => [row.enrollment_id, row]));
  const requestByEnrollmentId = new Map();
  for (const row of requestRows || []) {
    if (!requestByEnrollmentId.has(row.enrollment_id)) {
      requestByEnrollmentId.set(row.enrollment_id, row);
    }
  }
  const legacyByEnrollmentId = new Map((legacyRows || []).map((row) => [row.enrollment_id, row]));
  const organizationById = new Map((organizationRows || []).map((row) => [row.id, row]));

  return {
    enrollmentRows: enrollmentRows || [],
    inventoryByEnrollmentId,
    requestByEnrollmentId,
    legacyByEnrollmentId,
    organizationById,
  };
}

export async function getOperationalServiceAccounts(db, options = {}) {
  const lifecycleStatuses = options.lifecycleStatuses === undefined ? ["active"] : options.lifecycleStatuses;
  const programTypes = options.programTypes || ["co_op", "discard"];
  const enrollmentIds = options.enrollmentIds || null;

  let query = db
    .from("current_organization_enrollments")
    .select("enrollment_id")
    .in("program_type", programTypes);

  if (Array.isArray(lifecycleStatuses) && lifecycleStatuses.length > 0) {
    query = query.in("lifecycle_status", lifecycleStatuses);
  }

  if (Array.isArray(enrollmentIds)) {
    if (enrollmentIds.length === 0) return [];
    query = query.in("enrollment_id", enrollmentIds);
  }

  const enrollmentIdRows = await runOptional(query);
  if (enrollmentIdRows === null) {
    return null;
  }

  const ids = (enrollmentIdRows || []).map((row) => row.enrollment_id).filter(Boolean);
  if (ids.length === 0) {
    return [];
  }

  const {
    enrollmentRows,
    inventoryByEnrollmentId,
    requestByEnrollmentId,
    legacyByEnrollmentId,
    organizationById,
  } = await getAccountMaps(db, ids);

  return enrollmentRows
    .map((row) => {
      const inventory = inventoryByEnrollmentId.get(row.enrollment_id);
      const request = requestByEnrollmentId.get(row.enrollment_id);
      const legacy = legacyByEnrollmentId.get(row.enrollment_id);
      const organization = organizationById.get(row.organization_id) || {};
      const accountType = row.co_op_account_type || row.discard_account_type || "ltl";

      return {
        id: row.enrollment_id,
        enrollment_id: row.enrollment_id,
        organization_id: row.organization_id,
        program_type: row.program_type,
        lifecycle_status: row.lifecycle_status,
        org_name: row.legal_name,
        email: row.main_email,
        phone: row.main_phone,
        address_street: organization.address_street || null,
        address_city: organization.address_city || null,
        address_state: organization.address_state || null,
        address_zip: organization.address_zip || null,
        pickup_address: organization.pickup_address || null,
        pickup_city: organization.pickup_city || null,
        pickup_state: organization.pickup_state || null,
        pickup_zip: organization.pickup_zip || null,
        pickup_access_notes: organization.pickup_access_notes || null,
        dock_instructions: organization.dock_instructions || null,
        available_pickup_hours: organization.available_pickup_hours || null,
        account_type: accountType,
        estimated_bags: row.default_estimated_bags ?? null,
        bag_count: inventory?.current_bag_count ?? null,
        bag_count_updated: inventory?.last_inventory_event_at || null,
        bag_count_is_admin: false,
        pending_request: mapPendingRequest(request),
        discard_pickup_frequency: row.discard_pickup_frequency || null,
        projected_lbs_week: row.projected_lbs_week ?? null,
        rate_per_1000_lbs: row.negotiated_rate_per_1000_lbs ?? null,
        flat_rate_per_pickup: row.flat_rate_per_pickup ?? null,
        legacy_source_table: legacy?.source_table || null,
        legacy_source_id: legacy?.source_id || null,
        nonprofit_id: legacy?.source_table === "nonprofit_applications" ? legacy.source_id : null,
        discard_account_id: legacy?.source_table === "discard_accounts" ? legacy.source_id : null,
      };
    })
    .sort((left, right) => (left.org_name || "").localeCompare(right.org_name || ""));
}

async function getOperationalAccountsByEnrollmentId(db, enrollmentIds) {
  const accounts = await getOperationalServiceAccounts(db, { lifecycleStatuses: null, enrollmentIds });
  if (accounts === null) return null;
  return new Map((accounts || []).map((account) => [account.enrollment_id, account]));
}

export async function getOperationalRoutes(db, options = {}) {
  let query = db
    .from("pickup_runs")
    .select("id, scheduled_date, shopping_date, scheduled_time, status, completion_type, notes, nonprofits_notified_at, resellers_notified_at")
    .eq("run_type", "route")
    .order("scheduled_date", { ascending: false });

  if (Array.isArray(options.statuses) && options.statuses.length > 0) {
    query = query.in("status", options.statuses);
  } else if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.scheduledDate) {
    query = query.eq("scheduled_date", options.scheduledDate);
  }

  if (options.startDate) {
    query = query.gte("scheduled_date", options.startDate);
  }

  if (options.endDate) {
    query = query.lte("scheduled_date", options.endDate);
  }

  const runs = await runOptional(query);
  if (runs === null) {
    return null;
  }

  const runIds = (runs || []).map((run) => run.id);
  if (runIds.length === 0) {
    return [];
  }

  const stops = await runOptional(
    db
      .from("pickup_run_stops")
      .select("id, pickup_run_id, organization_id, enrollment_id, pickup_request_id, stop_order, estimated_bags, actual_bags, actual_weight_lbs, no_inventory, stop_status, completed_at, notes")
      .in("pickup_run_id", runIds)
      .order("stop_order")
  );

  if (stops === null) {
    return null;
  }

  const stopIds = (stops || []).map((stop) => stop.id);
  const payouts = stopIds.length
    ? await runOptional(
        db
          .from("pickup_payouts")
          .select("pickup_run_stop_id, amount_owed, payment_status, payment_method, payment_date, calculated_from, notes")
          .in("pickup_run_stop_id", stopIds)
      )
    : [];

  const accountByEnrollmentId = await getOperationalAccountsByEnrollmentId(
    db,
    [...new Set((stops || []).map((stop) => stop.enrollment_id).filter(Boolean))]
  );

  if (accountByEnrollmentId === null) {
    return null;
  }

  const payoutByStopId = new Map((payouts || []).map((payout) => [payout.pickup_run_stop_id, payout]));
  const stopsByRunId = new Map();

  for (const stop of stops || []) {
    const account = accountByEnrollmentId.get(stop.enrollment_id) || null;
    const payout = payoutByStopId.get(stop.id) || null;
    const mappedStop = {
      id: stop.id,
      route_id: stop.pickup_run_id,
      stop_order: stop.stop_order,
      organization_id: stop.organization_id,
      enrollment_id: stop.enrollment_id,
      pickup_request_id: stop.pickup_request_id,
      estimated_bags: stop.estimated_bags,
      actual_bags: stop.actual_bags,
      actual_weight_lbs: stop.actual_weight_lbs,
      no_inventory: stop.no_inventory,
      stop_status: stop.stop_status,
      completed_at: stop.completed_at,
      notes: stop.notes,
      program_type: account?.program_type || null,
      account_type: account?.account_type || null,
      nonprofit_id: account?.nonprofit_id || null,
      discard_account_id: account?.discard_account_id || null,
      organization: account ? buildOrganizationRecord(account, payout) : null,
      payout,
    };

    if (!stopsByRunId.has(stop.pickup_run_id)) {
      stopsByRunId.set(stop.pickup_run_id, []);
    }
    stopsByRunId.get(stop.pickup_run_id).push(mappedStop);
  }

  return (runs || []).map((run) => {
    const runStops = stopsByRunId.get(run.id) || [];
    return {
      id: run.id,
      scheduled_date: run.scheduled_date,
      shopping_date: run.shopping_date,
      scheduled_time: run.scheduled_time,
      status: run.status,
      completion_type: run.completion_type,
      notes: run.notes,
      nonprofits_notified_at: run.nonprofits_notified_at,
      resellers_notified_at: run.resellers_notified_at,
      estimated_total_bags: runStops.reduce((sum, stop) => sum + Number(stop.estimated_bags || 0), 0),
      actual_total_bags: runStops.reduce((sum, stop) => sum + Number(stop.actual_bags || 0), 0),
      stops: runStops,
    };
  });
}

export async function createOperationalRoute(db, payload) {
  const validStops = (payload.stops || []).filter((stop) => stop.organization_id && stop.enrollment_id);
  if (validStops.length === 0) {
    return null;
  }

  const { data: run, error: runError } = await db
    .from("pickup_runs")
    .insert({
      run_type: "route",
      scheduled_date: payload.scheduled_date,
      shopping_date: payload.shopping_date || null,
      scheduled_time: payload.scheduled_time || null,
      status: "scheduled",
      notes: normalizeNullableString(payload.notes),
    })
    .select("id")
    .single();

  if (runError) {
    if (isMissingRelationError(runError)) {
      return null;
    }
    throw runError;
  }

  const { error: stopError } = await db.from("pickup_run_stops").insert(
    validStops.map((stop, index) => ({
      pickup_run_id: run.id,
      organization_id: stop.organization_id,
      enrollment_id: stop.enrollment_id,
      pickup_request_id: stop.pickup_request_id || null,
      stop_order: stop.stop_order ?? index + 1,
      estimated_bags: stop.estimated_bags || null,
      no_inventory: false,
      stop_status: "pending",
      notes: normalizeNullableString(stop.notes),
    }))
  );

  if (stopError) {
    throw stopError;
  }

  const requestIds = validStops.map((stop) => stop.pickup_request_id).filter(Boolean);
  if (requestIds.length > 0) {
    await runOptional(
      db
        .from("pickup_requests")
        .update({ status: "scheduled", scheduled_date: payload.scheduled_date })
        .in("id", requestIds)
    );
  }

  await updateLegacyRequestsAfterScheduling(db, validStops, payload.scheduled_date);

  return run.id;
}

async function getStopWithRoute(db, stopId) {
  const rows = await runOptional(
    db
      .from("pickup_run_stops")
      .select(`
        id,
        pickup_run_id,
        organization_id,
        enrollment_id,
        pickup_request_id,
        stop_order,
        estimated_bags,
        actual_bags,
        actual_weight_lbs,
        no_inventory,
        stop_status,
        completed_at,
        notes,
        pickup_runs (id, scheduled_date, scheduled_time, status, notes)
      `)
      .eq("id", stopId)
      .limit(1)
  );

  return rows?.[0] || null;
}

async function resetLegacyBagCounter(db, account, noteText) {
  if (account.nonprofit_id) {
    await db.from("bag_counts").insert({
      nonprofit_id: account.nonprofit_id,
      bag_count: 0,
      entry_type: "pickup",
      notes: noteText,
    });
    return;
  }

  if (account.discard_account_id) {
    await db.from("discard_bag_counts").insert({
      discard_account_id: account.discard_account_id,
      bag_count: 0,
      entry_type: "pickup",
      notes: noteText,
    });
  }
}

async function updateLegacyRequestsAfterCompletion(db, account) {
  if (account.nonprofit_id) {
    await runOptional(
      db
        .from("nonprofit_pickup_requests")
        .update({ status: "completed" })
        .eq("nonprofit_id", account.nonprofit_id)
        .in("status", ["pending", "scheduled"])
    );

    if (account.account_type === "fl") {
      await runOptional(
        db
          .from("container_pickup_requests")
          .update({ status: "completed" })
          .eq("application_id", account.nonprofit_id)
          .in("status", ["pending", "reviewed", "scheduled"])
      );
    }

    return;
  }

  if (account.discard_account_id) {
    await runOptional(
      db
        .from("discard_pickup_requests")
        .update({ status: "completed" })
        .eq("discard_account_id", account.discard_account_id)
        .in("status", ["pending", "scheduled"])
    );
  }
}

async function updateCanonicalRequestsAfterCompletion(db, stop, completedAt) {
  if (stop.pickup_request_id) {
    await runOptional(
      db
        .from("pickup_requests")
        .update({ status: "completed", completed_at: completedAt })
        .eq("id", stop.pickup_request_id)
    );
    return;
  }

  await runOptional(
    db
      .from("pickup_requests")
      .update({ status: "completed", completed_at: completedAt })
      .eq("enrollment_id", stop.enrollment_id)
      .in("status", ["pending", "scheduled"])
  );
}

function calculateDiscardPayout(weightLbs, programDetails) {
  const flatRate = Number(programDetails?.flat_rate_per_pickup ?? 0);
  if (flatRate > 0) {
    return flatRate;
  }

  const recurringRate = Number(programDetails?.negotiated_rate_per_1000_lbs ?? 0);
  const frequency = programDetails?.pickup_frequency || "weekly";
  let minimum = Number(programDetails?.min_lbs_weekly ?? 0);

  if (frequency === "adhoc") {
    minimum = Number(programDetails?.min_lbs_adhoc ?? minimum);
  } else if (frequency === "monthly") {
    minimum = Number(programDetails?.min_lbs_monthly ?? programDetails?.min_lbs_biweekly ?? minimum);
  } else if (frequency === "biweekly") {
    minimum = Number(programDetails?.min_lbs_biweekly ?? minimum);
  }

  if (weightLbs < minimum) {
    return 0;
  }

  return Math.floor(weightLbs / 1000) * recurringRate;
}

async function upsertDiscardRoutePayout(db, stop, actualBags) {
  const programDetails = await runOptional(
    db
      .from("discard_program_details")
      .select("pickup_frequency, negotiated_rate_per_1000_lbs, flat_rate_per_pickup, min_lbs_weekly, min_lbs_biweekly, min_lbs_monthly, min_lbs_adhoc")
      .eq("enrollment_id", stop.enrollment_id)
      .maybeSingle()
  );

  if (programDetails === null) {
    return null;
  }

  const estimatedWeight = Number(actualBags || 0) * ROUTE_BAG_WEIGHT_LBS;
  const amountOwed = calculateDiscardPayout(estimatedWeight, programDetails || {});
  const payoutNotes = `Route payout estimated from ${Number(actualBags || 0)} bag(s) at ${ROUTE_BAG_WEIGHT_LBS} lbs per bag.`;

  await runOptional(
    db
      .from("pickup_run_stops")
      .update({ actual_weight_lbs: estimatedWeight })
      .eq("id", stop.id)
  );

  await runOptional(
    db.from("pickup_payouts").upsert(
      {
        pickup_run_stop_id: stop.id,
        organization_id: stop.organization_id,
        enrollment_id: stop.enrollment_id,
        amount_owed: amountOwed,
        payment_status: amountOwed > 0 ? "pending" : "voided",
        calculated_from: {
          source: "route_completion_bag_estimate",
          bag_count: Number(actualBags || 0),
          estimated_weight_lbs: estimatedWeight,
        },
        notes: payoutNotes,
      },
      { onConflict: "pickup_run_stop_id" }
    )
  );

  return {
    amount_owed: amountOwed,
    estimated_weight_lbs: estimatedWeight,
    payment_status: amountOwed > 0 ? "pending" : "voided",
  };
}

async function getConsecutiveNoInventoryFlag(db, enrollmentId) {
  const rows = await runOptional(
    db
      .from("pickup_run_stops")
      .select("no_inventory, completed_at")
      .eq("enrollment_id", enrollmentId)
      .eq("stop_status", "completed")
      .order("completed_at", { ascending: false })
      .limit(2)
  );

  return Boolean(rows?.length === 2 && rows.every((row) => row.no_inventory));
}

export async function completeOperationalStop(db, stopId, options = {}) {
  const stop = await getStopWithRoute(db, stopId);
  if (!stop) {
    return null;
  }

  const accountsByEnrollmentId = await getOperationalAccountsByEnrollmentId(db, [stop.enrollment_id]);
  if (accountsByEnrollmentId === null) {
    return null;
  }

  const account = accountsByEnrollmentId.get(stop.enrollment_id);
  if (!account) {
    return null;
  }

  const completedAt = options.completedAt || new Date().toISOString();
  const actualBags = options.noInventory ? 0 : options.actualBags ?? null;
  const noInventory = options.noInventory || Number(actualBags || 0) === 0;

  await runOptional(
    db
      .from("pickup_run_stops")
      .update({
        actual_bags: actualBags,
        no_inventory: noInventory,
        stop_status: "completed",
        completed_at: completedAt,
        notes: options.notes !== undefined ? normalizeNullableString(options.notes) : stop.notes,
      })
      .eq("id", stop.id)
  );

  let payout = null;
  if (!noInventory && account.program_type === "discard") {
    payout = await upsertDiscardRoutePayout(db, stop, actualBags);
  }

  if (!noInventory) {
    const noteText = `Picked up by NCT - ${new Date(completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    await resetLegacyBagCounter(db, account, noteText);

    if (account.nonprofit_id) {
      await markCanonicalCoOpPickupCollected(db, account.nonprofit_id, noteText);
    } else if (account.discard_account_id) {
      await markCanonicalDiscardPickupCollected(db, account.discard_account_id);
    }
  }

  await Promise.all([
    updateCanonicalRequestsAfterCompletion(db, stop, completedAt),
    updateLegacyRequestsAfterCompletion(db, account),
  ]);

  const consecutiveNoInventory = noInventory ? await getConsecutiveNoInventoryFlag(db, stop.enrollment_id) : false;

  return {
    route_id: stop.pickup_run_id,
    stop_id: stop.id,
    organization: buildOrganizationRecord(account, payout),
    program_type: account.program_type,
    account_type: account.account_type,
    no_inventory: noInventory,
    actual_bags: actualBags,
    payout,
    consecutive_no_inventory: consecutiveNoInventory,
  };
}

export async function updateOperationalRouteStatus(db, routeId, status) {
  const runs = await runOptional(
    db
      .from("pickup_runs")
      .select("id")
      .eq("id", routeId)
      .eq("run_type", "route")
      .limit(1)
  );

  if (runs === null) {
    return null;
  }

  if (!runs?.[0]) {
    return false;
  }

  const updates = { status };

  if (status === "completed") {
    const stops = await runOptional(
      db
        .from("pickup_run_stops")
        .select("no_inventory, stop_status")
        .eq("pickup_run_id", routeId)
    );
    const completedStops = stops || [];
    updates.completion_type = completedStops.some((stop) => stop.no_inventory || stop.stop_status === "skipped") ? "partial" : "full";
  } else {
    updates.completion_type = null;
  }

  await runOptional(
    db
      .from("pickup_runs")
      .update(updates)
      .eq("id", routeId)
  );

  return updates;
}