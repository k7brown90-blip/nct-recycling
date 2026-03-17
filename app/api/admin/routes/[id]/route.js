import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// PATCH — update route status
export async function PATCH(request, { params }) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const { status, actual_total_bags, notes } = await request.json();

  const db = createServiceClient();
  const { error } = await db
    .from("pickup_routes")
    .update({
      ...(status && { status }),
      ...(actual_total_bags !== undefined && { actual_total_bags }),
      ...(notes !== undefined && { notes }),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  return NextResponse.json({ success: true });
}
