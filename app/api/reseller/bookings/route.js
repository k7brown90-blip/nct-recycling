import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

const SLOT_LABELS = {
  wholesale: "Wholesale Sort",
  bins: "Bins",
};

async function getResellerProfile(user, db) {
  const profile = await getOrCreateProfile(user, db);
  if (!["reseller", "both"].includes(profile?.role) || !profile?.application_id) return null;
  const { data: reseller } = await db
    .from("reseller_applications")
    .select("id, full_name, email")
    .eq("id", profile.application_id)
    .maybeSingle();
  return reseller;
}

// GET — all confirmed bookings for this reseller (upcoming + past)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const reseller = await getResellerProfile(user, db);
  if (!reseller) return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });

  const today = new Date().toISOString().split("T")[0];

  const { data: bookings } = await db
    .from("shopping_bookings")
    .select("id, slot_type, status, shopping_day_id, shopping_days(shopping_date, status)")
    .eq("reseller_id", reseller.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(30);

  const upcoming = (bookings || []).filter((b) => b.shopping_days?.shopping_date >= today);
  const past = (bookings || []).filter((b) => b.shopping_days?.shopping_date < today);

  return NextResponse.json({ upcoming, past });
}

// DELETE — cancel a booking by booking id
export async function DELETE(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const reseller = await getResellerProfile(user, db);
  if (!reseller) return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });

  const { booking_id } = await request.json();
  if (!booking_id) return NextResponse.json({ error: "Missing booking_id." }, { status: 400 });

  // Verify ownership before cancelling
  const { data: booking } = await db
    .from("shopping_bookings")
    .select("reseller_id, status")
    .eq("id", booking_id)
    .maybeSingle();

  if (!booking || booking.reseller_id !== reseller.id) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  // Fetch booking details for email before cancelling
  const { data: bookingDetail } = await db
    .from("shopping_bookings")
    .select("slot_type, shopping_days(shopping_date)")
    .eq("id", booking_id)
    .maybeSingle();

  await db.from("shopping_bookings").update({ status: "cancelled" }).eq("id", booking_id);

  // Send cancellation email
  if (bookingDetail?.shopping_days?.shopping_date) {
    const dateStr = new Date(bookingDetail.shopping_days.shopping_date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const slotLabel = SLOT_LABELS[bookingDetail.slot_type] || bookingDetail.slot_type;
    resend.emails.send({
      from: "NCT Recycling <donate@nctrecycling.com>",
      to: reseller.email,
      subject: `Booking Cancelled — ${slotLabel} · ${dateStr}`,
      html: `
        <p>Hi ${reseller.full_name?.split(" ")[0] || "there"},</p>
        <p>Your <strong>${slotLabel}</strong> booking for <strong>${dateStr}</strong> has been cancelled.</p>
        <p>If you'd like to rebook, visit your <a href="https://www.nctrecycling.com/reseller/dashboard">reseller portal</a>.</p>
        <p>Questions? Call <a href="tel:+19702329108">(970) 232-9108</a> or email <a href="mailto:donate@nctrecycling.com">donate@nctrecycling.com</a>.</p>
        <p>— NCT Recycling Team</p>
      `,
    }).catch((err) => console.error("Cancellation email error:", err));
  }

  return NextResponse.json({ success: true });
}
