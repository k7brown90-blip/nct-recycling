import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

const SLOT_CAPACITY = 5; // max resellers per slot type per day

const SLOT_INFO = {
  wholesale: { label: "Wholesale",  hours: "10:00 AM – 12:00 PM", price: "$0.30/lb (unopened bags)" },
  bins:      { label: "Bins",       hours: "12:00 PM – 4:00 PM",  price: "$2.00/lb (sorted bins)"  },
};

async function getResellerProfile(user, db) {
  const { data: profile } = await db
    .from("profiles")
    .select("role, application_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "reseller" || !profile?.application_id) return null;

  const { data: reseller } = await db
    .from("reseller_applications")
    .select("id, full_name, email, business_name")
    .eq("id", profile.application_id)
    .maybeSingle();

  return reseller;
}

// GET — upcoming shopping days with availability and reseller's bookings
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const reseller = await getResellerProfile(user, db);
  if (!reseller) return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });

  // Get open shopping days from today onwards
  const today = new Date().toISOString().split("T")[0];
  const { data: days, error } = await db
    .from("shopping_days")
    .select("id, shopping_date, status, route_id")
    .eq("status", "open")
    .gte("shopping_date", today)
    .order("shopping_date", { ascending: true })
    .limit(10);

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  // Get all bookings for these days
  const dayIds = (days || []).map((d) => d.id);
  const { data: allBookings } = await db
    .from("shopping_bookings")
    .select("shopping_day_id, slot_type, reseller_id, status")
    .in("shopping_day_id", dayIds.length ? dayIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "confirmed");

  // Build availability + my bookings per day
  const result = (days || []).map((day) => {
    const dayBookings = allBookings?.filter((b) => b.shopping_day_id === day.id) || [];
    const wholesaleCount = dayBookings.filter((b) => b.slot_type === "wholesale").length;
    const binsCount      = dayBookings.filter((b) => b.slot_type === "bins").length;
    const myWholesale = dayBookings.find((b) => b.slot_type === "wholesale" && b.reseller_id === reseller.id);
    const myBins      = dayBookings.find((b) => b.slot_type === "bins"      && b.reseller_id === reseller.id);

    return {
      id: day.id,
      shopping_date: day.shopping_date,
      status: day.status,
      slots: {
        wholesale: {
          ...SLOT_INFO.wholesale,
          capacity: SLOT_CAPACITY,
          booked: wholesaleCount,
          available: SLOT_CAPACITY - wholesaleCount,
          my_booking: myWholesale ? true : false,
        },
        bins: {
          ...SLOT_INFO.bins,
          capacity: SLOT_CAPACITY,
          booked: binsCount,
          available: SLOT_CAPACITY - binsCount,
          my_booking: myBins ? true : false,
        },
      },
    };
  });

  return NextResponse.json({ days: result });
}

// POST — book a slot
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const reseller = await getResellerProfile(user, db);
  if (!reseller) return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });

  const { shopping_day_id, slot_type } = await request.json();

  if (!shopping_day_id || !["wholesale", "bins"].includes(slot_type)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Verify shopping day exists and is open
  const { data: day } = await db
    .from("shopping_days")
    .select("id, shopping_date, status")
    .eq("id", shopping_day_id)
    .maybeSingle();

  if (!day || day.status !== "open") {
    return NextResponse.json({ error: "This shopping day is not available." }, { status: 400 });
  }

  // Check capacity
  const { count } = await db
    .from("shopping_bookings")
    .select("id", { count: "exact" })
    .eq("shopping_day_id", shopping_day_id)
    .eq("slot_type", slot_type)
    .eq("status", "confirmed");

  if (count >= SLOT_CAPACITY) {
    return NextResponse.json({ error: `${SLOT_INFO[slot_type].label} slots are full for this day.` }, { status: 409 });
  }

  // Insert booking (unique constraint prevents double-booking same type same day)
  const { error: bookingError } = await db.from("shopping_bookings").insert({
    shopping_day_id,
    reseller_id: reseller.id,
    slot_type,
    status: "confirmed",
  });

  if (bookingError) {
    if (bookingError.code === "23505") {
      return NextResponse.json({ error: "You already have a booking for this slot." }, { status: 409 });
    }
    console.error("Booking error:", bookingError);
    return NextResponse.json({ error: "Failed to book slot." }, { status: 500 });
  }

  // Confirmation email
  const info = SLOT_INFO[slot_type];
  const dateStr = new Date(day.shopping_date).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  resend.emails.send({
    from: "NCT Recycling <noreply@nctrecycling.com>",
    to: reseller.email,
    subject: `Shopping Confirmed — ${info.label} · ${dateStr}`,
    html: `
      <h2>You're Booked!</h2>
      <p>Hi ${reseller.full_name?.split(" ")[0] || "there"},</p>
      <p>Your <strong>${info.label}</strong> shopping slot is confirmed.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px;margin:16px 0">
        <tr style="background:#0b2a45;color:white">
          <td style="padding:10px 16px;font-weight:bold">Date</td>
          <td style="padding:10px 16px">${dateStr}</td>
        </tr>
        <tr style="background:#f9f5e8">
          <td style="padding:10px 16px;font-weight:bold;color:#0b2a45">Slot</td>
          <td style="padding:10px 16px;font-weight:bold;color:#d49a22">${info.label} · ${info.hours}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:bold;color:#666">Pricing</td>
          <td style="padding:10px 16px">${info.price}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:bold;color:#666">Location</td>
          <td style="padding:10px 16px">6108 South College Ave, STE C — Fort Collins, CO 80525</td>
        </tr>
      </table>
      ${slot_type === "wholesale"
        ? "<p><strong>Wholesale reminder:</strong> You'll be sorting on-site. Your discards feed the bins — please leave them neatly for our team to process.</p>"
        : "<p><strong>Bins reminder:</strong> Bins are restocked from the morning wholesale sort. Prices are $2.00/lb weighed at checkout.</p>"
      }
      <p>Questions? Call <a href="tel:+19702329108">(970) 232-9108</a> or email <a href="mailto:donate@nctrecycling.com">donate@nctrecycling.com</a>.</p>
      <p>— NCT Recycling Team</p>
    `,
  }).catch((err) => console.error("Booking email error:", err));

  return NextResponse.json({ success: true });
}

// DELETE — cancel a booking
export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const reseller = await getResellerProfile(user, db);
  if (!reseller) return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });

  const { shopping_day_id, slot_type } = await request.json();

  await db
    .from("shopping_bookings")
    .update({ status: "cancelled" })
    .eq("shopping_day_id", shopping_day_id)
    .eq("reseller_id", reseller.id)
    .eq("slot_type", slot_type);

  return NextResponse.json({ success: true });
}
