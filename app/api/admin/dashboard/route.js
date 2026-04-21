import { createServiceClient } from "@/lib/supabase";
import { getCanonicalCoOpRoutes } from "@/lib/co-op-canonical";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
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

async function optionalCount(queryPromise) {
  const { count, error } = await queryPromise;
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
  return count || 0;
}

async function optionalData(queryPromise) {
  const { data, error } = await queryPromise;
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
  return data;
}

function mapCanonicalRequestStatus(status) {
  if (status === "reviewed") return "pending";
  if (status === "declined") return "cancelled";
  return status;
}

function mapCanonicalDiscardRequestRow(row) {
  return {
    id: row.id,
    created_at: row.created_at,
    preferred_date: row.preferred_date,
    estimated_bags: row.estimated_bags,
    estimated_weight_lbs: row.estimated_weight_lbs,
    status: mapCanonicalRequestStatus(row.status),
    discard_account_id: row.organization_id,
    discard_accounts: {
      id: row.organization_id,
      org_name: row.legal_name,
      contact_name: null,
    },
  };
}

export async function GET(request) {
  if (!checkAdminAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { count: pendingResellers },
    canonicalPendingNonprofits,
    canonicalPendingPickupRequests,
    canonicalPendingDiscardRequests,
    { data: todayRoute },
    { data: nextShoppingDay },
    canonicalRecentDiscardRequests,
  ] = await Promise.all([
    db.from("reseller_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    optionalCount(
      db.from("current_organization_enrollments")
        .select("enrollment_id", { count: "exact", head: true })
        .eq("program_type", "co_op")
        .eq("lifecycle_status", "pending_review")
    ),
    optionalCount(
      db.from("admin_pickup_request_queue")
        .select("id", { count: "exact", head: true })
        .eq("program_type", "co_op")
        .eq("status", "pending")
    ),
    optionalCount(
      db.from("admin_pickup_request_queue")
        .select("id", { count: "exact", head: true })
        .eq("program_type", "discard")
        .eq("status", "pending")
    ),
    db.from("pickup_routes").select("id, scheduled_date, status, estimated_total_bags, actual_total_bags").eq("scheduled_date", today).neq("status", "cancelled").maybeSingle(),
    db.from("shopping_days").select("id, shopping_date, status").gte("shopping_date", today).order("shopping_date", { ascending: true }).limit(1).maybeSingle(),
    optionalData(
      db.from("admin_pickup_request_queue")
        .select("id, created_at, organization_id, legal_name, preferred_date, estimated_bags, estimated_weight_lbs, status")
        .eq("program_type", "discard")
        .order("created_at", { ascending: false })
        .limit(5)
    ),
  ]);

  const [legacyPendingNonprofits, legacyPendingPickupRequests, legacyPendingDiscardRequests, legacyRecentDiscardRequests] = await Promise.all([
    canonicalPendingNonprofits === null
      ? db.from("nonprofit_applications").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: canonicalPendingNonprofits }),
    canonicalPendingPickupRequests === null
      ? db.from("nonprofit_pickup_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: canonicalPendingPickupRequests }),
    canonicalPendingDiscardRequests === null
      ? db.from("discard_pickup_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: canonicalPendingDiscardRequests }),
    canonicalRecentDiscardRequests === null
      ? db.from("discard_pickup_requests").select(`
          id, created_at, preferred_date, estimated_bags, estimated_weight_lbs, status,
          discard_account_id,
          discard_accounts (id, org_name, contact_name)
        `).order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: canonicalRecentDiscardRequests.map(mapCanonicalDiscardRequestRow) }),
  ]);

  let effectiveTodayRoute = todayRoute || null;
  try {
    const canonicalRoutes = await getCanonicalCoOpRoutes(db, null, todayRoute?.id ? [todayRoute.id] : null);
    const canonicalTodayRoute = todayRoute?.id
      ? canonicalRoutes?.find((route) => route.id === todayRoute.id)
      : canonicalRoutes?.find((route) => route.scheduled_date === today && route.status !== "cancelled");
    if (canonicalTodayRoute) {
      effectiveTodayRoute = canonicalTodayRoute;
    }
  } catch (canonicalError) {
    console.error("Canonical co-op dashboard route merge error:", canonicalError);
  }

  if (!effectiveTodayRoute) {
    try {
      const canonicalRoutes = await getCanonicalCoOpRoutes(db);
      effectiveTodayRoute = canonicalRoutes?.find((route) => route.scheduled_date === today && route.status !== "cancelled") || null;
    } catch (canonicalError) {
      console.error("Canonical co-op dashboard route load error:", canonicalError);
    }
  }

  // Count bookings for next shopping day
  let nextDayBookings = 0;
  if (nextShoppingDay) {
    const { count } = await db
      .from("shopping_bookings")
      .select("id", { count: "exact", head: true })
      .eq("shopping_day_id", nextShoppingDay.id)
      .eq("status", "confirmed");
    nextDayBookings = count || 0;
  }

  return NextResponse.json({
    pending_resellers: pendingResellers || 0,
    pending_nonprofits: legacyPendingNonprofits.count || 0,
    pending_pickup_requests: legacyPendingPickupRequests.count || 0,
    pending_discard_requests: legacyPendingDiscardRequests.count || 0,
    today_route: effectiveTodayRoute,
    next_shopping_day: nextShoppingDay ? { ...nextShoppingDay, booking_count: nextDayBookings } : null,
    recent_discard_requests: legacyRecentDiscardRequests.data || [],
  });
}
