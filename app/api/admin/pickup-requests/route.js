import { createServiceClient } from "@/lib/supabase";
import { getCanonicalCoOpRequests, updateCanonicalCoOpRequestStatus } from "@/lib/co-op-canonical";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — list pickup requests with nonprofit info, optional status filter
export async function GET(request) {
  if (!checkAdminAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const db = createServiceClient();
  try {
    const { data: nonprofits } = await db
      .from("nonprofit_applications")
      .select("id")
      .eq("status", "approved");

    const requestLists = await Promise.all(
      (nonprofits || []).map((nonprofit) => getCanonicalCoOpRequests(db, nonprofit.id))
    );

    const canonicalAvailable = requestLists.some((requests) => requests !== null);
    if (canonicalAvailable) {
      const canonicalRequests = requestLists
        .flat()
        .filter(Boolean)
        .filter((request) => !status || request.status === status)
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));

      const nonprofitIds = [...new Set(canonicalRequests.map((request) => request.nonprofit_id).filter(Boolean))];
      const { data: nonprofitRows } = nonprofitIds.length
        ? await db
            .from("nonprofit_applications")
            .select("id, org_name, contact_name, email, address_street, address_city, address_state")
            .in("id", nonprofitIds)
        : { data: [] };

      const nonprofitById = new Map((nonprofitRows || []).map((row) => [row.id, row]));
      return NextResponse.json({
        requests: canonicalRequests.map((request) => ({
          ...request,
          nonprofit_applications: nonprofitById.get(request.nonprofit_id) || null,
        })),
      });
    }
  } catch (canonicalError) {
    console.error("Canonical co-op pickup request admin load error:", canonicalError);
  }

  let query = db
    .from("nonprofit_pickup_requests")
    .select(`
      id, estimated_bags, estimated_weight_lbs, preferred_date, notes, status, created_at,
      nonprofit_id,
      nonprofit_applications (id, org_name, contact_name, email, address_street, address_city, address_state)
    `)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ requests: data || [] });
}

// PATCH — update request status
export async function PATCH(request) {
  if (!checkAdminAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id, status } = await request.json();
  if (!id || !status) return NextResponse.json({ error: "Missing id or status." }, { status: 400 });

  const valid = ["pending", "scheduled", "cancelled"];
  if (!valid.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db
    .from("nonprofit_pickup_requests")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

  try {
    const { data: requestRow } = await db
      .from("nonprofit_pickup_requests")
      .select("nonprofit_id")
      .eq("id", id)
      .maybeSingle();

    if (requestRow?.nonprofit_id) {
      await updateCanonicalCoOpRequestStatus(db, requestRow.nonprofit_id, status);
    }
  } catch (canonicalError) {
    console.error("Canonical co-op pickup request admin update sync error:", canonicalError);
  }

  return NextResponse.json({ success: true });
}
