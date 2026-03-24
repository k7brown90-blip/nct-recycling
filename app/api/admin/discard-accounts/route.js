import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — list all discard accounts
export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("discard_accounts")
    .select("*")
    .order("org_name");

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });
  return NextResponse.json({ accounts: data || [] });
}

// POST — create a new discard account
export async function POST(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  if (!body.org_name) return NextResponse.json({ error: "Organization name required." }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("discard_accounts")
    .insert({
      org_name:           body.org_name,
      address_street:     body.address_street     || null,
      address_city:       body.address_city       || null,
      address_state:      body.address_state      || null,
      address_zip:        body.address_zip        || null,
      contact_name:       body.contact_name       || null,
      contact_email:      body.contact_email      || null,
      contact_phone:      body.contact_phone      || null,
      account_type:       body.account_type       || "ltl",
      pickup_frequency:   body.pickup_frequency   || "weekly",
      rate_per_1000_lbs:  body.rate_per_1000_lbs  ?? 20,
      flat_rate_per_pickup: body.flat_rate_per_pickup != null ? parseFloat(body.flat_rate_per_pickup) : null,
      min_lbs_weekly:     body.min_lbs_weekly     ?? 1000,
      min_lbs_biweekly:   body.min_lbs_biweekly   ?? 2500,
      min_lbs_adhoc:      body.min_lbs_adhoc      ?? 5000,
      projected_lbs_week: body.projected_lbs_week || null,
      contract_date:      body.contract_date      || null,
      notes:              body.notes              || null,
      status:             "active",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create account." }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id });
}

// PATCH — update a discard account
export async function PATCH(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const allowed = [
    "org_name", "address_street", "address_city", "address_state", "address_zip",
    "contact_name", "contact_email", "contact_phone",
    "account_type", "pickup_frequency", "rate_per_1000_lbs", "flat_rate_per_pickup",
    "min_lbs_weekly", "min_lbs_biweekly", "min_lbs_adhoc",
    "projected_lbs_week", "contract_date", "notes", "status",
  ];
  const updates = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null;
  }

  const db = createServiceClient();
  const { error } = await db.from("discard_accounts").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — delete a discard account (cascades to pickups)
export async function DELETE(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.from("discard_accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  return NextResponse.json({ success: true });
}
