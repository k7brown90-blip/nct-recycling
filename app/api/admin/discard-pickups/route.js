import { createServiceClient } from "@/lib/supabase";
import { createCanonicalDiscardPickup, deleteCanonicalDiscardPickup, getCanonicalDiscardPickups, updateCanonicalDiscardPickup } from "@/lib/discard-canonical";
import { sendContaminationNotice } from "@/lib/contamination-emails";
import { NextResponse } from "next/server";

const CONTAMINATION_SEVERITIES = new Set(["none", "minor", "major", "rejected"]);

async function notifyPartnerOfContamination(db, pickupId, accountId, severity) {
  if (!CONTAMINATION_SEVERITIES.has(severity) || severity === "none") return;
  try {
    const [{ data: account }, { data: pickup }, { data: photos }] = await Promise.all([
      db.from("discard_accounts").select("org_name, contact_name, contact_email").eq("id", accountId).single(),
      db.from("discard_pickups").select("id, pickup_date, weight_lbs, contamination_severity, contamination_notes, contamination_source").eq("id", pickupId).single(),
      db.from("discard_pickup_photos").select("storage_bucket, storage_path, original_filename").eq("pickup_id", pickupId),
    ]);
    if (!account?.contact_email || !pickup) return;
    const result = await sendContaminationNotice(db, { account, pickup, photos: photos || [] });
    if (result.success) {
      await db.from("discard_pickups").update({ partner_notified_at: new Date().toISOString() }).eq("id", pickupId);
    } else {
      console.error("Contamination email failed:", result.error);
    }
  } catch (err) {
    console.error("notifyPartnerOfContamination error:", err);
  }
}

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
  try {
    const canonical = await getCanonicalDiscardPickups(db, account_id);
    if (canonical !== null) {
      return NextResponse.json({ pickups: canonical || [] });
    }
  } catch (canonicalError) {
    console.error("Canonical discard pickups load error:", canonicalError);
  }

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
  const {
    account_id, pickup_date, pickup_time, weight_lbs, load_type, accepted, rejection_reason, notes,
    contamination_severity, contamination_notes, contamination_source, contamination_reported_by,
  } = body;

  if (!account_id || !pickup_date || weight_lbs == null) {
    return NextResponse.json({ error: "account_id, pickup_date, and weight_lbs are required." }, { status: 400 });
  }

  const db = createServiceClient();

  // Fetch account for rate calculation
  const { data: account, error: acctError } = await db
    .from("discard_accounts")
    .select("pickup_frequency, rate_per_1000_lbs, flat_rate_per_pickup, min_lbs_weekly, min_lbs_biweekly, min_lbs_adhoc")
    .eq("id", account_id)
    .single();

  if (acctError || !account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  // Contamination handling: 'rejected' forces accepted=false and voids payment.
  const severity = CONTAMINATION_SEVERITIES.has(contamination_severity) ? contamination_severity : null;
  const isContaminated = severity && severity !== "none";
  const isRejected = severity === "rejected";
  const isAccepted = isRejected ? false : accepted !== false;
  const amount_owed = isAccepted ? calcPayment(weight_lbs, load_type || "recurring", account) : 0;
  const finalRejectionReason = !isAccepted
    ? (rejection_reason || (isRejected ? contamination_notes : null) || null)
    : null;

  const pickupPayload = {
    account_id,
    pickup_date,
    pickup_time: pickup_time || null,
    weight_lbs,
    load_type: load_type || "recurring",
    amount_owed,
    payment_status: amount_owed === 0 ? "voided" : "pending",
    accepted: isAccepted,
    rejection_reason: finalRejectionReason,
    notes: notes || null,
    contamination_reported: !!isContaminated,
    contamination_severity: severity,
    contamination_notes: isContaminated ? (contamination_notes || null) : null,
    contamination_reported_at: isContaminated ? new Date().toISOString() : null,
    contamination_reported_by: isContaminated ? (contamination_reported_by || null) : null,
    contamination_source: isContaminated ? (contamination_source === "driver" ? "driver" : "admin") : null,
  };

  const { data: insertedPickup, error } = await db
    .from("discard_pickups")
    .insert(pickupPayload)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Failed to log pickup." }, { status: 500 });

  try {
    await createCanonicalDiscardPickup(db, insertedPickup.id, account_id, pickupPayload);
  } catch (canonicalError) {
    console.error("Canonical discard pickup sync error:", canonicalError);
  }

  // Fire partner notification email asynchronously (don't block save on email failures).
  if (isContaminated) {
    notifyPartnerOfContamination(db, insertedPickup.id, account_id, severity).catch((err) =>
      console.error("Contamination email dispatch error:", err)
    );
  }

  return NextResponse.json({ success: true, id: insertedPickup.id, amount_owed, contaminated: !!isContaminated });
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

  // Retroactive contamination flag from admin UI. If 'rejected', auto-void & zero out.
  let contaminationApplied = null;
  if (body.contamination_severity !== undefined) {
    const severity = CONTAMINATION_SEVERITIES.has(body.contamination_severity) ? body.contamination_severity : null;
    const isContaminated = severity && severity !== "none";
    updates.contamination_reported = !!isContaminated;
    updates.contamination_severity = severity;
    updates.contamination_notes = isContaminated ? (body.contamination_notes || null) : null;
    updates.contamination_reported_at = isContaminated ? new Date().toISOString() : null;
    updates.contamination_reported_by = isContaminated ? (body.contamination_reported_by || null) : null;
    updates.contamination_source = isContaminated ? (body.contamination_source === "driver" ? "driver" : "admin") : null;
    if (severity === "rejected") {
      updates.amount_owed = 0;
      updates.payment_status = "voided";
      updates.accepted = false;
      updates.rejection_reason = body.rejection_reason || body.contamination_notes || "Contaminated load — no payment per Section 8.";
    }
    contaminationApplied = isContaminated ? severity : null;
  }

  const db = createServiceClient();
  const { data: updatedRow, error } = await db
    .from("discard_pickups")
    .update(updates)
    .eq("id", id)
    .select("account_id")
    .single();
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

  try {
    await updateCanonicalDiscardPickup(db, id, updates);
  } catch (canonicalError) {
    console.error("Canonical discard pickup update error:", canonicalError);
  }

  // Send/resend partner notification when contamination is newly applied or notify_partner is set.
  if (contaminationApplied || body.notify_partner) {
    const accountId = updatedRow?.account_id || body.account_id;
    if (accountId) {
      notifyPartnerOfContamination(db, id, accountId, contaminationApplied || "rejected").catch((err) =>
        console.error("Contamination email dispatch error:", err)
      );
    }
  }

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

  try {
    await deleteCanonicalDiscardPickup(db, id);
  } catch (canonicalError) {
    console.error("Canonical discard pickup delete error:", canonicalError);
  }

  return NextResponse.json({ success: true });
}
