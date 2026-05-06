import { createServiceClient } from "@/lib/supabase";
import { createCanonicalDiscardPickup } from "@/lib/discard-canonical";
import { sendContaminationNotice } from "@/lib/contamination-emails";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const BUCKET = "discard-contamination";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 10;
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif", "image/webp",
]);

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.DRIVER_PIN}`;
}

// POST multipart — driver refuses a discard load on-site (e.g. obvious contamination
// like bags of pillows / stuffed textiles on the not-accepted list). Creates a
// rejected discard_pickups row, attaches photos, marks the originating pickup
// request completed, and emails the partner per Section 8.
export async function POST(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const form = await request.formData();
  const discard_account_id = form.get("discard_account_id");
  const pickup_request_id = form.get("pickup_request_id");
  const stop_id = form.get("stop_id");
  const pickup_date = form.get("pickup_date") || new Date().toISOString().slice(0, 10);
  const weight_lbs_raw = form.get("weight_lbs");
  const weight_lbs = weight_lbs_raw ? parseFloat(weight_lbs_raw) : 0;
  const notes = (form.get("notes") || "").toString().trim();
  const severity = (form.get("severity") || "rejected").toString();
  const VALID_SEVERITIES = new Set(["minor", "major", "rejected"]);

  if (!discard_account_id) {
    return NextResponse.json({ error: "Missing discard_account_id." }, { status: 400 });
  }
  if (!notes) {
    return NextResponse.json({ error: "Notes describing the contamination are required." }, { status: 400 });
  }
  if (!VALID_SEVERITIES.has(severity)) {
    return NextResponse.json({ error: "Invalid severity." }, { status: 400 });
  }

  const db = createServiceClient();

  // Validate the account exists.
  const { data: account, error: acctError } = await db
    .from("discard_accounts")
    .select("id, org_name, contact_name, contact_email")
    .eq("id", discard_account_id)
    .single();
  if (acctError || !account) {
    return NextResponse.json({ error: "Discard account not found." }, { status: 404 });
  }

  const isRejected = severity === "rejected";
  const pickupPayload = {
    account_id: account.id,
    pickup_date,
    pickup_time: null,
    weight_lbs: isRejected ? 0 : weight_lbs || 0,
    load_type: "recurring",
    amount_owed: 0, // Driver-flagged contamination always voids; admin can edit later if minor/major.
    payment_status: "voided",
    accepted: !isRejected,
    rejection_reason: isRejected ? notes : null,
    notes: `Driver-flagged contamination: ${notes}`,
    contamination_reported: true,
    contamination_severity: severity,
    contamination_notes: notes,
    contamination_reported_at: new Date().toISOString(),
    contamination_source: "driver",
  };

  const { data: pickup, error: pickupError } = await db
    .from("discard_pickups")
    .insert(pickupPayload)
    .select("id")
    .single();
  if (pickupError) {
    console.error("Driver refusal pickup insert error:", pickupError);
    return NextResponse.json({ error: "Failed to record refusal." }, { status: 500 });
  }

  // Upload any attached photos. Best-effort; partial failure is non-fatal.
  const files = form.getAll("photos").filter((f) => f && typeof f === "object" && "arrayBuffer" in f);
  const uploadErrors = [];
  let uploadedCount = 0;
  for (const file of files.slice(0, MAX_PHOTOS)) {
    if (file.size > MAX_BYTES) { uploadErrors.push(`${file.name}: too large.`); continue; }
    if (!ALLOWED_MIME.has((file.type || "").toLowerCase())) {
      uploadErrors.push(`${file.name}: unsupported type.`);
      continue;
    }
    const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".jpg").toLowerCase();
    const path = `${pickup.id}/${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) {
      uploadErrors.push(`${file.name}: ${uploadError.message || "upload failed"}.`);
      continue;
    }
    await db.from("discard_pickup_photos").insert({
      pickup_id: pickup.id,
      storage_bucket: BUCKET,
      storage_path: path,
      original_filename: file.name || null,
      mime_type: file.type || null,
      source: "driver",
    });
    uploadedCount += 1;
  }

  // Canonical sync (best-effort).
  try {
    await createCanonicalDiscardPickup(db, pickup.id, account.id, pickupPayload);
  } catch (canonicalError) {
    console.error("Canonical driver refusal sync error:", canonicalError);
  }

  // Mark the originating pickup request completed (if provided).
  if (pickup_request_id) {
    await db.from("discard_pickup_requests")
      .update({ status: "completed", admin_notes: `Driver refused load on ${pickup_date}: ${notes}` })
      .eq("id", pickup_request_id);
  }

  // Mark the route stop completed (if provided) so route board reflects driver action.
  if (stop_id) {
    await db.from("pickup_route_stops").update({
      stop_status: "completed",
      no_inventory: false,
      completed_at: new Date().toISOString(),
    }).eq("id", stop_id);
  }

  // Notify partner per Section 8 (async).
  (async () => {
    try {
      const { data: photos } = await db
        .from("discard_pickup_photos")
        .select("storage_bucket, storage_path, original_filename")
        .eq("pickup_id", pickup.id);
      const result = await sendContaminationNotice(db, {
        account,
        pickup: { ...pickupPayload, id: pickup.id },
        photos: photos || [],
      });
      if (result.success) {
        await db.from("discard_pickups").update({ partner_notified_at: new Date().toISOString() }).eq("id", pickup.id);
      } else {
        console.error("Driver refusal email failed:", result.error);
      }
    } catch (err) {
      console.error("Driver refusal email dispatch error:", err);
    }
  })();

  return NextResponse.json({
    success: true,
    pickup_id: pickup.id,
    photos_uploaded: uploadedCount,
    upload_errors: uploadErrors.length ? uploadErrors : undefined,
  });
}
