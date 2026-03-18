import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const application_id = searchParams.get("application_id");
  if (!application_id) {
    return NextResponse.json({ error: "Missing application_id." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: signedUrl, error } = await db.storage
    .from("nonprofit-docs")
    .createSignedUrl(`agreements/${application_id}.pdf`, 300); // 5 min

  if (error || !signedUrl) {
    return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl });
}
