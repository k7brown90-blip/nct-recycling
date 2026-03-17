import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — generate a signed URL to view a DR 0563 file
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("file");

  if (!fileName) {
    return NextResponse.json({ error: "File name required." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from("dr0563")
    .createSignedUrl(fileName, 300); // 5-minute expiry

  if (error) {
    return NextResponse.json({ error: "Could not generate link." }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
