import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// Calculate payment owed based on agreement terms
function calcPayment(weight_lbs, load_type, account) {
  // Flat rate overrides per-lb calculation
  if (account.flat_rate_per_pickup != null) {
    return parseFloat(account.flat_rate_per_pickup);
  }

  const { pickup_frequency, rate_per_1000_lbs, min_lbs_weekly, min_lbs_biweekly, min_lbs_adhoc } = account;

  let min;
  if (load_type === "single_run") {
    min = min_lbs_adhoc;
  } else if (pickup_frequency === "weekly") {
    min = min_lbs_weekly;
  } else {
    // biweekly or monthly treated the same for minimums
    min = min_lbs_biweekly;
  }

  if (weight_lbs < min) return 0;
  return Math.floor(weight_lbs / 1000) * rate_per_1000_lbs;
}

// GET — list pickups for an account
export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const account_id = searchParams.get("account_id");
  if (!account_id) return NextResponse.json({ error: "Missing account_id." }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("discard_pickups")
    .select("*")
    .eq("account_id", account_id)
    .order("pickup_date", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });
  return NextResponse.json({ pickups: data || [] });
}

// POST — log a new pickup (calculates amount_owed automatically)
export async function POST(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const { account_id, pickup_date, pickup_time, weight_lbs, load_type, accepted, rejection_reason, notes } = body;

  if (!account_id || !pickup_date || weight_lbs == null) {
    return NextResponse.json({ error: "account_id, pickup_date, and weight_lbs are required." }, { status: 400 });
  }

  const db = createServiceClient();

  // Fetch account for rate calculation
  const { data: account, error: acctError } = await db
    .from("discard_accounts")
    .select("pickup_frequency, rate_per_1000_lbs, min_lbs_weekly, min_lbs_biweekly, min_lbs_adhoc")
    .eq("id", account_id)
    .single();

  if (acctError || !account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const isAccepted = accepted !== false;
  const amount_owed = isAccepted ? calcPayment(weight_lbs, load_type || "recurring", account) : 0;

  const { error } = await db.from("discard_pickups").insert({
    account_id,
    pickup_date,
    pickup_time: pickup_time || null,
    weight_lbs,
    load_type: load_type || "recurring",
    amount_owed,
    payment_status: amount_owed === 0 ? "voided" : "pending",
    accepted: isAccepted,
    rejection_reason: !isAccepted ? (rejection_reason || null) : null,
    notes: notes || null,
  });

  if (error) return NextResponse.json({ error: "Failed to log pickup." }, { status: 500 });
  return NextResponse.json({ success: true, amount_owed });
}

// PATCH — update pickup (mark paid, void, update payment details)
export async function PATCH(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const updates = {};
  if (body.payment_status !== undefined) {
    const valid = ["pending", "paid", "voided"];
    if (!valid.includes(body.payment_status)) return NextResponse.json({ error: "Invalid payment_status." }, { status: 400 });
    updates.payment_status = body.payment_status;
  }
  if (body.payment_method !== undefined) updates.payment_method = body.payment_method || null;
  if (body.payment_date    !== undefined) updates.payment_date    = body.payment_date    || null;
  if (body.notes           !== undefined) updates.notes           = body.notes           || null;
  if (body.amount_owed     !== undefined) updates.amount_owed     = body.amount_owed;

  const db = createServiceClient();
  const { error } = await db.from("discard_pickups").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — remove a pickup record
export async function DELETE(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.from("discard_pickups").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  return NextResponse.json({ success: true });
}
