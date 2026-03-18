import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

async function getApplicationId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("application_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "nonprofit") return null;
  return profile.application_id;
}

// GET — list container pickup requests for this nonprofit
export async function GET() {
  const application_id = await getApplicationId();
  if (!application_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("container_pickup_requests")
    .select("id, status, notes, admin_notes, scheduled_date, container_photo_path, created_at")
    .eq("application_id", application_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

// POST — submit a new container pickup request (multipart/form-data with optional photo)
export async function POST(request) {
  const application_id = await getApplicationId();
  if (!application_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();

  let notes = null;
  let container_photo_path = null;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    notes = formData.get("notes") || null;
    const photo = formData.get("photo");

    if (photo && photo.size > 0) {
      const ext = photo.name.split(".").pop() || "jpg";
      const filename = `container-photos/${application_id}-${Date.now()}.${ext}`;
      const bytes = await photo.arrayBuffer();
      const { error: uploadError } = await db.storage
        .from("nonprofit-docs")
        .upload(filename, bytes, { contentType: photo.type, upsert: false });
      if (uploadError) return NextResponse.json({ error: "Photo upload failed." }, { status: 500 });
      container_photo_path = filename;
    }
  } else {
    const body = await request.json();
    notes = body.notes || null;
  }

  const { error } = await db.from("container_pickup_requests").insert({
    application_id,
    notes,
    container_photo_path,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: "Failed to submit request." }, { status: 500 });
  return NextResponse.json({ success: true });
}
