import { createServiceClient } from "@/lib/supabase";
import { createSignedStorageUrl } from "@/lib/agreement-documents";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const BUCKET = "discard-contamination";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PER_PICKUP = 10;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
]);

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET ?pickup_id= — list photos with short-lived signed URLs (5 min).
export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const pickup_id = searchParams.get("pickup_id");
  if (!pickup_id) return NextResponse.json({ error: "Missing pickup_id." }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("discard_pickup_photos")
    .select("id, pickup_id, storage_bucket, storage_path, original_filename, mime_type, caption, source, uploaded_at")
    .eq("pickup_id", pickup_id)
    .order("uploaded_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Failed to load photos." }, { status: 500 });

  const photos = await Promise.all(
    (data || []).map(async (row) => ({
      ...row,
      signed_url: await createSignedStorageUrl(db, row.storage_bucket || BUCKET, row.storage_path, 300),
    }))
  );

  return NextResponse.json({ photos });
}

// POST multipart — upload one or more photos for a given pickup.
export async function POST(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const form = await request.formData();
  const pickup_id = form.get("pickup_id");
  const caption = form.get("caption");
  const source = (form.get("source") || "admin").toString();
  if (!pickup_id) return NextResponse.json({ error: "Missing pickup_id." }, { status: 400 });

  const files = form.getAll("files").filter((f) => f && typeof f === "object" && "arrayBuffer" in f);
  if (!files.length) return NextResponse.json({ error: "No files." }, { status: 400 });

  const db = createServiceClient();

  // Enforce per-pickup cap.
  const { count: existingCount } = await db
    .from("discard_pickup_photos")
    .select("id", { count: "exact", head: true })
    .eq("pickup_id", pickup_id);
  if ((existingCount || 0) + files.length > MAX_PER_PICKUP) {
    return NextResponse.json({ error: `Max ${MAX_PER_PICKUP} photos per pickup.` }, { status: 400 });
  }

  const inserted = [];
  const errors = [];

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      errors.push(`${file.name}: exceeds 10 MB.`);
      continue;
    }
    if (!ALLOWED_MIME.has((file.type || "").toLowerCase())) {
      errors.push(`${file.name}: unsupported type ${file.type || "unknown"}.`);
      continue;
    }

    const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".jpg").toLowerCase();
    const path = `${pickup_id}/${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message || "upload failed"}.`);
      continue;
    }

    const { data: row, error: insertError } = await db
      .from("discard_pickup_photos")
      .insert({
        pickup_id,
        storage_bucket: BUCKET,
        storage_path: path,
        original_filename: file.name || null,
        mime_type: file.type || null,
        caption: caption ? String(caption) : null,
        source: source === "driver" ? "driver" : "admin",
      })
      .select("id, storage_path, original_filename, mime_type, source, uploaded_at")
      .single();

    if (insertError) {
      // Best-effort cleanup of the uploaded object.
      await db.storage.from(BUCKET).remove([path]).catch(() => null);
      errors.push(`${file.name}: ${insertError.message || "insert failed"}.`);
      continue;
    }
    inserted.push(row);
  }

  return NextResponse.json({
    success: inserted.length > 0,
    uploaded: inserted,
    errors: errors.length ? errors : undefined,
  });
}

// DELETE — remove a single photo (admin only).
export async function DELETE(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();
  const { data: row, error: loadError } = await db
    .from("discard_pickup_photos")
    .select("storage_bucket, storage_path")
    .eq("id", id)
    .single();
  if (loadError || !row) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

  await db.storage.from(row.storage_bucket || BUCKET).remove([row.storage_path]).catch((e) => {
    console.error("Storage remove failed:", e);
  });

  const { error: deleteError } = await db.from("discard_pickup_photos").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: "Delete failed." }, { status: 500 });

  return NextResponse.json({ success: true });
}
