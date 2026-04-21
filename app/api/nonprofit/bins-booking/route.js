import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const NONPROFIT_BINS_CAPACITY = 2; // max 2 volunteer spots per shopping day

// GET — upcoming shopping days with nonprofit bins availability
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (profile?.role !== "nonprofit") return NextResponse.json({ error: "Not a nonprofit account." }, { status: 403 });

  const today = new Date().toISOString().split("T")[0];
  const { data: days } = await db
    .from("shopping_days")
    .select("id, shopping_date, status")
    .eq("status", "open")
    .gte("shopping_date", today)
    .order("shopping_date", { ascending: true })
    .limit(10);

  const dayIds = (days || []).map((d) => d.id);

  const { data: allBookings } = await db
    .from("shopping_bookings")
    .select("shopping_day_id, nonprofit_id, status")
    .in("shopping_day_id", dayIds.length ? dayIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("slot_type", "nonprofit_bins")
    .eq("status", "confirmed");

  const result = (days || []).map((day) => {
    const dayBookings = allBookings?.filter((b) => b.shopping_day_id === day.id) || [];
    const myBooking = dayBookings.find((b) => b.nonprofit_id === profile.application_id);
    return {
      id: day.id,
      shopping_date: day.shopping_date,
      booked: dayBookings.length,
      available: NONPROFIT_BINS_CAPACITY - dayBookings.length,
      capacity: NONPROFIT_BINS_CAPACITY,
      my_booking: !!myBooking,
    };
  });

  return NextResponse.json({ days: result });
}

// POST — nonprofit books a bins volunteer slot
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (profile?.role !== "nonprofit" || !profile?.application_id) {
    return NextResponse.json({ error: "Not a nonprofit account." }, { status: 403 });
  }

  const { shopping_day_id } = await request.json();
  if (!shopping_day_id) return NextResponse.json({ error: "Missing shopping_day_id." }, { status: 400 });

  // Check day is open
  const { data: day } = await db
    .from("shopping_days").select("id, shopping_date, status").eq("id", shopping_day_id).maybeSingle();
  if (!day || day.status !== "open") {
    return NextResponse.json({ error: "This shopping day is not available." }, { status: 400 });
  }

  // Check capacity
  const { count } = await db
    .from("shopping_bookings")
    .select("id", { count: "exact" })
    .eq("shopping_day_id", shopping_day_id)
    .eq("slot_type", "nonprofit_bins")
    .eq("status", "confirmed");

  if (count >= NONPROFIT_BINS_CAPACITY) {
    return NextResponse.json({ error: "Nonprofit bins slots are full for this day." }, { status: 409 });
  }

  const { error: bookingError } = await db.from("shopping_bookings").insert({
    shopping_day_id,
    nonprofit_id: profile.application_id,
    slot_type: "nonprofit_bins",
    status: "confirmed",
  });

  if (bookingError) {
    if (bookingError.code === "23505") {
      return NextResponse.json({ error: "You already have a bins booking for this day." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to book slot." }, { status: 500 });
  }

  // Get nonprofit info for confirmation email
  const { data: np } = await db
    .from("nonprofit_applications")
    .select("org_name, contact_name, email")
    .eq("id", profile.application_id)
    .maybeSingle();

  const dateStr = new Date(day.shopping_date).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  resend.emails.send({
    from: "NCT Recycling <donate@nctrecycling.com>",
    to: np.email,
    subject: `Bins Visit Confirmed — ${dateStr}`,
    html: `
      <h2>Your Bins Visit is Confirmed</h2>
      <p>Hi ${np.contact_name?.split(" ")[0] || "there"},</p>
      <p><strong>${np.org_name}</strong> is confirmed for a bins sourcing visit.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px;margin:16px 0">
        <tr style="background:#0b2a45;color:white">
          <td style="padding:10px 16px;font-weight:bold">Date</td>
          <td style="padding:10px 16px">${dateStr}</td>
        </tr>
        <tr style="background:#f9f5e8">
          <td style="padding:10px 16px;font-weight:bold;color:#0b2a45">Time</td>
          <td style="padding:10px 16px;font-weight:bold;color:#d49a22">12:00 PM – 4:00 PM</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:bold;color:#666">Volunteers</td>
          <td style="padding:10px 16px">Up to 2 volunteers</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:bold;color:#666">Location</td>
          <td style="padding:10px 16px">6108 South College Ave, STE C — Fort Collins, CO 80525</td>
        </tr>
      </table>
      <p>Check in with NCT staff on arrival. All visitors must wear closed-toe shoes.</p>
      <p>Questions? <a href="tel:+19702329108">(970) 232-9108</a> or <a href="mailto:donate@nctrecycling.com">donate@nctrecycling.com</a></p>
      <p>— NCT Recycling Team</p>
    `,
  }).catch((err) => console.error("Nonprofit bins email error:", err));

  return NextResponse.json({ success: true });
}

// DELETE — cancel nonprofit bins booking
export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (profile?.role !== "nonprofit") return NextResponse.json({ error: "Not a nonprofit account." }, { status: 403 });

  const { shopping_day_id } = await request.json();
  await db
    .from("shopping_bookings")
    .update({ status: "cancelled" })
    .eq("shopping_day_id", shopping_day_id)
    .eq("nonprofit_id", profile.application_id)
    .eq("slot_type", "nonprofit_bins");

  return NextResponse.json({ success: true });
}
