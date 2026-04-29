import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

async function loadEnrollmentMaps(db) {
  const { data, error } = await db
    .from("migration_enrollment_map")
    .select("enrollment_id, source_table, source_id")
    .in("source_table", ["nonprofit_applications", "discard_accounts"]);

  if (error) {
    throw new Error(error.message || "Failed to load enrollment maps.");
  }

  return data || [];
}

function buildLegacyActiveSet(rows, keyField, statuses) {
  const active = new Set();
  for (const row of rows || []) {
    if (!row?.[keyField]) continue;
    if (!statuses.includes(row.status)) continue;
    active.add(row[keyField]);
  }
  return active;
}

export async function POST(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dry_run !== false;

  const db = createServiceClient();

  const [maps, legacyCoOpRows, legacyDiscardRows, canonicalRows] = await Promise.all([
    loadEnrollmentMaps(db),
    db
      .from("nonprofit_pickup_requests")
      .select("nonprofit_id, status"),
    db
      .from("discard_pickup_requests")
      .select("discard_account_id, status"),
    db
      .from("pickup_requests")
      .select("id, enrollment_id, status")
      .in("status", ["pending", "scheduled", "reviewed"]),
  ]);

  if (legacyCoOpRows.error) {
    return NextResponse.json({ error: "Failed to load legacy co-op requests.", detail: legacyCoOpRows.error.message }, { status: 500 });
  }
  if (legacyDiscardRows.error) {
    return NextResponse.json({ error: "Failed to load legacy discard requests.", detail: legacyDiscardRows.error.message }, { status: 500 });
  }
  if (canonicalRows.error) {
    return NextResponse.json({ error: "Failed to load canonical requests.", detail: canonicalRows.error.message }, { status: 500 });
  }

  const legacyCoOpActive = buildLegacyActiveSet(legacyCoOpRows.data, "nonprofit_id", ["pending", "scheduled"]);
  const legacyDiscardActive = buildLegacyActiveSet(legacyDiscardRows.data, "discard_account_id", ["pending", "scheduled"]);

  const mapByEnrollmentId = new Map((maps || []).map((row) => [row.enrollment_id, row]));

  const staleCanonicalRequestIds = [];
  for (const requestRow of canonicalRows.data || []) {
    const mapRow = mapByEnrollmentId.get(requestRow.enrollment_id);
    if (!mapRow) continue;

    if (mapRow.source_table === "nonprofit_applications" && !legacyCoOpActive.has(mapRow.source_id)) {
      staleCanonicalRequestIds.push(requestRow.id);
      continue;
    }

    if (mapRow.source_table === "discard_accounts" && !legacyDiscardActive.has(mapRow.source_id)) {
      staleCanonicalRequestIds.push(requestRow.id);
    }
  }

  const uniqueStaleIds = [...new Set(staleCanonicalRequestIds)];

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      stale_canonical_request_count: uniqueStaleIds.length,
      sample_request_ids: uniqueStaleIds.slice(0, 25),
    });
  }

  if (uniqueStaleIds.length > 0) {
    const { error: updateError } = await db
      .from("pickup_requests")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .in("id", uniqueStaleIds);

    if (updateError) {
      return NextResponse.json({ error: "Failed to reconcile canonical requests.", detail: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    stale_canonical_request_count: uniqueStaleIds.length,
    reconciled_request_count: uniqueStaleIds.length,
  });
}
