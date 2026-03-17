import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — list exchange appointments with nonprofit info
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const db = createServiceClient();
  let query = db
    .from("exchange_appointments")
    .select(`
      *,
      nonprofit_applications (org_name, contact_name, email, phone)
    `)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ appointments: data });
}

// PATCH — schedule or update an appointment, notify the nonprofit
export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, status, scheduled_date, scheduled_time, admin_notes } = await request.json();

  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();

  const { data: appt, error } = await db
    .from("exchange_appointments")
    .update({
      ...(status && { status }),
      ...(scheduled_date && { scheduled_date }),
      ...(scheduled_time && { scheduled_time }),
      ...(admin_notes !== undefined && { admin_notes }),
      notified_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`*, nonprofit_applications (org_name, contact_name, email)`)
    .single();

  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

  // Notify nonprofit if scheduling
  if (status === "scheduled" && scheduled_date) {
    const np = appt.nonprofit_applications;
    const dateStr = new Date(scheduled_date).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const typeLabel = appt.appointment_type === "in_person" ? "in-person warehouse visit" : "delivery";

    resend.emails.send({
      from: "NCT Recycling <noreply@nctrecycling.com>",
      to: np.email,
      subject: `Exchange Appointment Confirmed — ${dateStr}`,
      html: `
        <h2>Your Exchange Appointment is Confirmed</h2>
        <p>Hi ${np.contact_name?.split(" ")[0] || "there"},</p>
        <p>Your <strong>${typeLabel}</strong> appointment has been scheduled.</p>
        <p><strong>Date:</strong> ${dateStr}${scheduled_time ? `<br><strong>Time:</strong> ${scheduled_time}` : ""}</p>
        ${admin_notes ? `<p><strong>Notes from NCT:</strong> ${admin_notes}</p>` : ""}
        ${appt.appointment_type === "in_person"
          ? "<p>Please arrive at 6108 South College Ave, STE C, Fort Collins, CO 80525. Check in with staff when you arrive.</p>"
          : "<p>We will coordinate delivery details with you separately.</p>"
        }
        <p>Questions? Call us at (970) 232-9108 or reply to this email.</p>
        <p>— NCT Recycling Team</p>
      `,
    }).catch((err) => console.error("Appointment email error:", err));
  }

  return NextResponse.json({ success: true });
}
