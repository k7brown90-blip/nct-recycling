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

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapInventoryEventToLegacyEntry(event) {
  let entryType = "add";

  if (event.event_type === "pickup_collected") {
    entryType = "pickup";
  } else if (event.event_type === "adjustment" || event.event_type === "reset") {
    entryType = "admin_override";
  }

  return {
    id: event.id,
    bag_count: event.quantity_bags || 0,
    entry_type: entryType,
    notes: event.notes,
    created_at: event.created_at,
  };
}

export async function getCoOpCanonicalContext(db, legacyNonprofitId) {
  const orgMap = await runOptional(
    db
      .from("migration_organization_map")
      .select("organization_id")
      .eq("source_table", "nonprofit_applications")
      .eq("source_id", legacyNonprofitId)
      .maybeSingle()
  );

  const enrollmentMap = await runOptional(
    db
      .from("migration_enrollment_map")
      .select("enrollment_id")
      .eq("source_table", "nonprofit_applications")
      .eq("source_id", legacyNonprofitId)
      .maybeSingle()
  );

  if (!orgMap?.organization_id || !enrollmentMap?.enrollment_id) {
    return null;
  }

  const enrollmentDetails = await runOptional(
    db
      .from("current_organization_enrollments")
      .select("co_op_account_type, co_op_storage_capacity_bags")
      .eq("enrollment_id", enrollmentMap.enrollment_id)
      .maybeSingle()
  );

  return {
    organizationId: orgMap.organization_id,
    enrollmentId: enrollmentMap.enrollment_id,
    accountType: enrollmentDetails?.co_op_account_type || "ltl",
    storageCapacityBags: enrollmentDetails?.co_op_storage_capacity_bags || null,
  };
}

export async function getCanonicalCoOpBagCount(db, legacyNonprofitId, limit = 30) {
  const context = await getCoOpCanonicalContext(db, legacyNonprofitId);
  if (!context) {
    return null;
  }

  const inventory = await runOptional(
    db
      .from("current_organization_inventory")
      .select("current_bag_count, last_inventory_event_at")
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
  const mostRecentEntry = allEntries[0] || null;

  return {
    total: Math.max(Number(inventory?.current_bag_count ?? fallbackTotal ?? 0), 0),
    allEntries,
    sinceLastPickup,
    bag_count_updated: mostRecentEntry?.created_at || inventory?.last_inventory_event_at || null,
    bag_count_is_admin: mostRecentEntry?.entry_type === "admin_override",
  };
}

export async function addCanonicalCoOpBagCount(db, legacyNonprofitId, bagCount, notes, eventType = "reported_add") {
  const context = await getCoOpCanonicalContext(db, legacyNonprofitId);
  if (!context) {
    return false;
  }

  const result = await runOptional(
    db.from("inventory_events").insert({
      organization_id: context.organizationId,
      enrollment_id: context.enrollmentId,
      event_type: eventType,
      quantity_bags: bagCount,
      notes: normalizeNullableString(notes),
    })
  );

  return result !== null;
}

export async function markCanonicalCoOpPickupCollected(db, legacyNonprofitId, notes = "Picked up by NCT") {
  const snapshot = await getCanonicalCoOpBagCount(db, legacyNonprofitId, 10);
  if (!snapshot) {
    return false;
  }

  if (!snapshot.total) {
    return true;
  }

  return addCanonicalCoOpBagCount(db, legacyNonprofitId, snapshot.total, notes, "pickup_collected");
}

export async function getCanonicalCoOpRequests(db, legacyNonprofitId, onlyPending = false) {
  const context = await getCoOpCanonicalContext(db, legacyNonprofitId);
  if (!context) {
    return null;
  }

  let query = db
    .from("pickup_requests")
    .select("id, created_at, preferred_date, scheduled_date, estimated_bags, estimated_weight_lbs, fill_level, notes, admin_notes, status")
    .eq("enrollment_id", context.enrollmentId)
    .order("created_at", { ascending: false });

  if (onlyPending) {
    query = query.eq("status", "pending");
  }

  const requests = await runOptional(query);

  if (requests === null) {
    return null;
  }

  return requests.map((request) => ({
    ...request,
    nonprofit_id: legacyNonprofitId,
    status: mapCanonicalStatusToLegacy(request.status),
  }));
}

export async function createCanonicalCoOpPickupRequest(db, legacyNonprofitId, payload) {
  const context = await getCoOpCanonicalContext(db, legacyNonprofitId);
  if (!context) {
    return false;
  }

  const { error } = await db
    .from("pickup_requests")
    .insert({
      organization_id: context.organizationId,
      enrollment_id: context.enrollmentId,
      request_channel: "partner_portal",
      request_type: context.accountType === "fl" ? "full_load_pickup" : "ltl_pickup",
      preferred_date: payload.preferred_date || null,
      estimated_bags: payload.estimated_bags ?? null,
      estimated_weight_lbs: payload.estimated_weight_lbs ?? null,
      fill_level: normalizeNullableString(payload.fill_level),
      notes: normalizeNullableString(payload.notes),
      status: "pending",
    });

  if (error) {
    if (isMissingRelationError(error)) {
      return false;
    }
    throw error;
  }

  return true;
}

export async function updateCanonicalCoOpRequestStatus(db, legacyNonprofitId, status, requestId = null) {
  const context = await getCoOpCanonicalContext(db, legacyNonprofitId);
  if (!context) {
    return false;
  }

  let query = db
    .from("pickup_requests")
    .update({ status: mapLegacyStatusToCanonical(status) })
    .eq("enrollment_id", context.enrollmentId);

  if (requestId) {
    query = query.eq("id", requestId);
  } else {
    query = query.eq("status", "pending");
  }

  const { error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      return false;
    }
    throw error;
  }

  return true;
}

export async function getCanonicalCoOpBagLevels(db, legacyNonprofitIds) {
  const ids = legacyNonprofitIds?.length ? legacyNonprofitIds : ["00000000-0000-0000-0000-000000000000"];

  const maps = await runOptional(
    db
      .from("migration_enrollment_map")
      .select("source_id, enrollment_id")
      .eq("source_table", "nonprofit_applications")
      .in("source_id", ids)
  );

  if (maps === null) {
    return null;
  }

  const enrollmentIds = maps.map((row) => row.enrollment_id);
  if (enrollmentIds.length === 0) {
    return new Map();
  }

  const [inventoryRows, requestRows] = await Promise.all([
    runOptional(
      db
        .from("current_organization_inventory")
        .select("enrollment_id, current_bag_count, last_inventory_event_at")
        .in("enrollment_id", enrollmentIds)
    ),
    runOptional(
      db
        .from("pickup_requests")
        .select("enrollment_id, created_at, preferred_date, estimated_bags, estimated_weight_lbs, fill_level, notes, admin_notes, status")
        .in("enrollment_id", enrollmentIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    ),
  ]);

  if (inventoryRows === null && requestRows === null) {
    return null;
  }

  const sourceIdByEnrollmentId = new Map(maps.map((row) => [row.enrollment_id, row.source_id]));
  const result = new Map();

  for (const row of inventoryRows || []) {
    const legacyId = sourceIdByEnrollmentId.get(row.enrollment_id);
    if (!legacyId) continue;
    result.set(legacyId, {
      bag_count: Math.max(Number(row.current_bag_count ?? 0), 0),
      bag_count_updated: row.last_inventory_event_at || null,
      bag_count_is_admin: false,
      pending_request: null,
    });
  }

  for (const row of requestRows || []) {
    const legacyId = sourceIdByEnrollmentId.get(row.enrollment_id);
    if (!legacyId || result.get(legacyId)?.pending_request) continue;
    const current = result.get(legacyId) || {};
    result.set(legacyId, {
      ...current,
      pending_request: {
        id: row.id,
        nonprofit_id: legacyId,
        estimated_bags: row.estimated_bags,
        estimated_weight_lbs: row.estimated_weight_lbs,
        preferred_date: row.preferred_date,
        fill_level: row.fill_level,
        notes: row.notes,
        admin_notes: row.admin_notes,
        created_at: row.created_at,
        status: mapCanonicalStatusToLegacy(row.status),
      },
    });
  }

  return result;
}

export async function getCanonicalCoOpRoutes(db, status = null, legacyRouteIds = null) {
  let routeMapQuery = db
    .from("migration_pickup_run_map")
    .select("source_id, pickup_run_id")
    .eq("source_table", "pickup_routes");

  if (legacyRouteIds?.length) {
    routeMapQuery = routeMapQuery.in("source_id", legacyRouteIds);
  }

  const routeMaps = await runOptional(routeMapQuery);

  if (routeMaps === null) {
    return null;
  }

  const runIds = routeMaps.map((row) => row.pickup_run_id);
  if (runIds.length === 0) {
    return [];
  }

  let runQuery = db
    .from("pickup_runs")
    .select("id, scheduled_date, shopping_date, scheduled_time, status, completion_type, notes, nonprofits_notified_at, resellers_notified_at")
    .in("id", runIds)
    .eq("run_type", "route")
    .order("scheduled_date", { ascending: false });

  if (status) {
    runQuery = runQuery.eq("status", status);
  }

  const runs = await runOptional(runQuery);
  if (runs === null) {
    return null;
  }

  const filteredRunIds = runs.map((run) => run.id);
  const stops = await runOptional(
    db
      .from("pickup_run_stops")
      .select("pickup_run_id, enrollment_id, stop_order, estimated_bags, actual_bags, no_inventory, stop_status, completed_at, notes")
      .in("pickup_run_id", filteredRunIds.length ? filteredRunIds : ["00000000-0000-0000-0000-000000000000"])
      .order("stop_order")
  );

  if (stops === null) {
    return null;
  }

  const enrollmentIds = [...new Set((stops || []).map((stop) => stop.enrollment_id).filter(Boolean))];
  const enrollmentMaps = await runOptional(
    db
      .from("migration_enrollment_map")
      .select("source_id, enrollment_id")
      .eq("source_table", "nonprofit_applications")
      .in("enrollment_id", enrollmentIds.length ? enrollmentIds : ["00000000-0000-0000-0000-000000000000"])
  );

  const nonprofitIds = [...new Set((enrollmentMaps || []).map((row) => row.source_id))];
  const nonprofits = await runOptional(
    db
      .from("nonprofit_applications")
      .select("id, org_name, contact_name, email, phone, address_street, address_city, address_state")
      .in("id", nonprofitIds.length ? nonprofitIds : ["00000000-0000-0000-0000-000000000000"])
  );

  const sourceIdByRunId = new Map(routeMaps.map((row) => [row.pickup_run_id, row.source_id]));
  const nonprofitIdByEnrollmentId = new Map((enrollmentMaps || []).map((row) => [row.enrollment_id, row.source_id]));
  const nonprofitById = new Map((nonprofits || []).map((row) => [row.id, row]));
  const stopsByRunId = new Map();

  for (const stop of stops || []) {
    const nonprofitId = nonprofitIdByEnrollmentId.get(stop.enrollment_id);
    const nonprofit = nonprofitId ? nonprofitById.get(nonprofitId) : null;
    const legacyRouteId = sourceIdByRunId.get(stop.pickup_run_id) || stop.pickup_run_id;
    const mappedStop = {
      id: `${stop.pickup_run_id}:${stop.stop_order}:${stop.enrollment_id}`,
      route_id: legacyRouteId,
      stop_order: stop.stop_order,
      estimated_bags: stop.estimated_bags,
      actual_bags: stop.actual_bags,
      no_inventory: stop.no_inventory,
      stop_status: stop.stop_status,
      completed_at: stop.completed_at,
      notes: stop.notes,
      nonprofit_id: nonprofitId || null,
      nonprofit_applications: nonprofit || null,
    };

    if (!stopsByRunId.has(stop.pickup_run_id)) {
      stopsByRunId.set(stop.pickup_run_id, []);
    }
    stopsByRunId.get(stop.pickup_run_id).push(mappedStop);
  }

  return runs.map((run) => {
    const runStops = stopsByRunId.get(run.id) || [];
    return {
      id: sourceIdByRunId.get(run.id) || run.id,
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

export async function getCanonicalCoOpRecentPickups(db, legacyNonprofitId, limit = 5) {
  const context = await getCoOpCanonicalContext(db, legacyNonprofitId);
  if (!context) {
    return null;
  }

  const stops = await runOptional(
    db
      .from("pickup_run_stops")
      .select("actual_bags, completed_at, no_inventory, pickup_runs(scheduled_date)")
      .eq("enrollment_id", context.enrollmentId)
      .eq("stop_status", "completed")
      .order("completed_at", { ascending: false })
      .limit(limit)
  );

  if (stops === null) {
    return null;
  }

  return (stops || []).map((stop) => ({
    actual_bags: stop.actual_bags,
    completed_at: stop.completed_at,
    no_inventory: stop.no_inventory,
    pickup_routes: Array.isArray(stop.pickup_runs) ? stop.pickup_runs[0] || null : stop.pickup_runs || null,
  }));
}

export async function createCanonicalCoOpRoute(db, legacyRouteId, payload) {
  const stopContexts = await Promise.all(
    (payload.stops || []).map(async (stop) => ({
      stop,
      context: await getCoOpCanonicalContext(db, stop.nonprofit_id),
    }))
  );

  const validStops = stopContexts.filter((entry) => entry.context);
  if (validStops.length === 0) {
    return false;
  }

  const { data: run, error: runError } = await db
    .from("pickup_runs")
    .insert({
      run_type: "route",
      scheduled_date: payload.scheduled_date,
      shopping_date: payload.shopping_date,
      scheduled_time: payload.scheduled_time || null,
      status: "scheduled",
      notes: normalizeNullableString(payload.notes),
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
        source_table: "pickup_routes",
        source_id: legacyRouteId,
        pickup_run_id: run.id,
      },
      { onConflict: "source_table,source_id" }
    )
  );

  const { error: stopError } = await db.from("pickup_run_stops").insert(
    validStops.map(({ stop, context }) => ({
      pickup_run_id: run.id,
      organization_id: context.organizationId,
      enrollment_id: context.enrollmentId,
      stop_order: stop.stop_order,
      estimated_bags: stop.estimated_bags || null,
      no_inventory: false,
      stop_status: "pending",
      notes: normalizeNullableString(stop.notes),
    }))
  );

  if (stopError) {
    throw stopError;
  }

  return true;
}

export async function updateCanonicalCoOpRouteStatus(db, legacyRouteId, status, extraUpdates = {}) {
  const mapping = await runOptional(
    db
      .from("migration_pickup_run_map")
      .select("pickup_run_id")
      .eq("source_table", "pickup_routes")
      .eq("source_id", legacyRouteId)
      .maybeSingle()
  );

  if (!mapping?.pickup_run_id) {
    return false;
  }

  const updates = {
    status,
    ...extraUpdates,
  };

  if (status !== "completed") {
    updates.completion_type = extraUpdates.completion_type ?? null;
  }

  const result = await runOptional(
    db.from("pickup_runs").update(updates).eq("id", mapping.pickup_run_id)
  );

  return result !== null;
}

export async function completeCanonicalCoOpStop(db, legacyRouteId, legacyNonprofitId, stopOrder, actualBags, completedAt, notes) {
  const [mapping, context] = await Promise.all([
    runOptional(
      db
        .from("migration_pickup_run_map")
        .select("pickup_run_id")
        .eq("source_table", "pickup_routes")
        .eq("source_id", legacyRouteId)
        .maybeSingle()
    ),
    getCoOpCanonicalContext(db, legacyNonprofitId),
  ]);

  if (!mapping?.pickup_run_id || !context) {
    return false;
  }

  const result = await runOptional(
    db
      .from("pickup_run_stops")
      .update({
        actual_bags: actualBags ?? null,
        no_inventory: actualBags == null || Number(actualBags) === 0,
        stop_status: "completed",
        completed_at: completedAt,
        notes: normalizeNullableString(notes),
      })
      .eq("pickup_run_id", mapping.pickup_run_id)
      .eq("enrollment_id", context.enrollmentId)
      .eq("stop_order", stopOrder)
  );

  return result !== null;
}

export async function syncCanonicalCoOpRouteAggregate(db, legacyRouteId) {
  const mapping = await runOptional(
    db
      .from("migration_pickup_run_map")
      .select("pickup_run_id")
      .eq("source_table", "pickup_routes")
      .eq("source_id", legacyRouteId)
      .maybeSingle()
  );

  if (!mapping?.pickup_run_id) {
    return false;
  }

  const stops = await runOptional(
    db
      .from("pickup_run_stops")
      .select("actual_bags, no_inventory, stop_status")
      .eq("pickup_run_id", mapping.pickup_run_id)
  );

  if (stops === null) {
    return false;
  }

  const normalizedStops = stops || [];
  const allResolved = normalizedStops.length > 0 && normalizedStops.every((stop) => ["completed", "skipped"].includes(stop.stop_status));
  const completionType = normalizedStops.some((stop) => stop.no_inventory || stop.stop_status === "skipped") ? "partial" : "full";

  const updates = {
    completion_type: allResolved ? completionType : null,
  };

  if (allResolved) {
    updates.status = "completed";
  }

  const result = await runOptional(
    db.from("pickup_runs").update(updates).eq("id", mapping.pickup_run_id)
  );

  return result !== null;
}

export { isMissingRelationError };