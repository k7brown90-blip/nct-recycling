import { createServiceClient } from "@/lib/supabase";
import {
  markCanonicalDiscardPickupCollected,
  updateCanonicalDiscardPickupRequest,
} from "@/lib/discard-canonical";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — pickup requests for an account
export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const account_id = searchParams.get("account_id");
  if (!account_id) return NextResponse.json({ error: "Missing account_id." }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("discard_pickup_requests")
    .select("*")
    .eq("discard_account_id", account_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ requests: data || [] });
}

// PATCH — update request status / schedule it / add admin notes
export async function PATCH(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  if (body.status === "scheduled" && !body.scheduled_date) {
    return NextResponse.json({ error: "Scheduled date required." }, { status: 400 });
  }

  const updates = {};
  if (body.status !== undefined) {
    const valid = ["pending", "scheduled", "completed", "cancelled"];
    if (!valid.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    updates.status = body.status;
  }
  if (body.admin_notes !== undefined) updates.admin_notes = body.admin_notes || null;
  if (body.scheduled_date !== undefined) updates.scheduled_date = body.scheduled_date || null;

  const db = createServiceClient();
  let requestAccountId = null;
  if (body.status === "completed") {
    const { data: requestRecord, error: requestError } = await db
      .from("discard_pickup_requests")
      .select("discard_account_id")
      .eq("id", id)
      .maybeSingle();

    if (requestError) {
      console.error("Discard request lookup error:", requestError);
      return NextResponse.json({ error: "Failed to load request." }, { status: 500 });
    }

    requestAccountId = requestRecord?.discard_account_id || null;
  }

  const { error } = await db.from("discard_pickup_requests").update(updates).eq("id", id);
  if (error) {
    console.error("Discard request update error:", error);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  if (body.status === "completed" && requestAccountId) {
    const { error: legacyPickupError } = await db.from("discard_bag_counts").insert({
      discard_account_id: requestAccountId,
      bag_count: 0,
      entry_type: "pickup",
      notes: `Picked up by NCT - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    });

    if (legacyPickupError) {
      console.error("Discard pickup reset insert error:", legacyPickupError);
      return NextResponse.json({ error: "Failed to reset bag count." }, { status: 500 });
    }
  }

  try {
    await updateCanonicalDiscardPickupRequest(db, id, updates);
    if (body.status === "completed" && requestAccountId) {
      await markCanonicalDiscardPickupCollected(db, requestAccountId);
    }
  } catch (canonicalError) {
    console.error("Canonical discard request update error:", canonicalError);
  }

  return NextResponse.json({ success: true });
}
