import { createServiceClient } from "@/lib/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET — lots assigned to this nonprofit
export async function GET(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data: profile } = await db.from("profiles").select("application_id, role").eq("id", user.id).single();
  if (!profile || profile.role !== "nonprofit") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { data, error } = await db
    .from("tax_receipts")
    .select("*")
    .eq("application_id", profile.application_id)
    .order("lot_date", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ lots: data });
}

// POST — nonprofit uploads a receipt file for a lot
export async function POST(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data: profile } = await db.from("profiles").select("application_id, role").eq("id", user.id).single();
  if (!profile || profile.role !== "nonprofit") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const formData = await request.formData();
  const lot_id = formData.get("lot_id");
  const file = formData.get("file");

  if (!lot_id || !file || file.size === 0) {
    return NextResponse.json({ error: "lot_id and file are required." }, { status: 400 });
  }

  // Verify the lot belongs to this nonprofit
  const { data: lot } = await db
    .from("tax_receipts")
    .select("id, application_id")
    .eq("id", lot_id)
    .eq("application_id", profile.application_id)
    .single();

  if (!lot) return NextResponse.json({ error: "Lot not found." }, { status: 404 });

  // Upload file to storage
  const ext = file.name.split(".").pop();
  const filePath = `receipts/${profile.application_id}/${lot_id}.${ext}`;
  const { error: uploadError } = await db.storage
    .from("nonprofit-docs")
    .upload(filePath, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Receipt upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  // Update the tax_receipts record
  const { error: updateError } = await db
    .from("tax_receipts")
    .update({ receipt_file_path: filePath, receipt_status: "uploaded", uploaded_by: user.id })
    .eq("id", lot_id);

  if (updateError) return NextResponse.json({ error: "Failed to record upload." }, { status: 500 });

  return NextResponse.json({ success: true });
}
