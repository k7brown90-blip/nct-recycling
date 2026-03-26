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

// PATCH — send quote OR schedule/update an appointment
export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const { id, action } = body;

  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();

  // ── Send delivery cost quote ──
  if (action === "send_quote") {
    const { labor_cost, shipping_cost, admin_notes } = body;

    if (labor_cost == null || shipping_cost == null) {
      return NextResponse.json({ error: "Labor cost and shipping cost are required." }, { status: 400 });
    }

    const { data: appt, error } = await db
      .from("exchange_appointments")
      .update({
        labor_cost: parseFloat(labor_cost),
        shipping_cost: parseFloat(shipping_cost),
        quote_status: "quoted",
        quote_sent_at: new Date().toISOString(),
        ...(admin_notes !== undefined && { admin_notes }),
      })
      .eq("id", id)
      .select(`*, nonprofit_applications (org_name, contact_name, email)`)
      .single();

    if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

    const np = appt.nonprofit_applications;
    const total = parseFloat(labor_cost) + parseFloat(shipping_cost);
    const firstName = np.contact_name?.split(" ")[0] || "there";

    resend.emails.send({
      from: "NCT Recycling <donate@nctrecycling.com>",
      to: np.email,
      subject: `Delivery Quote Ready — ${np.org_name}`,
      html: `
        <h2>Your Delivery Cost Quote</h2>
        <p>Hi ${firstName},</p>
        <p>We've reviewed your exchange delivery request and prepared the following cost quote.</p>
        <table style="border-collapse:collapse;width:100%;max-width:480px;margin:16px 0">
          <tr style="background:#0b2a45;color:white">
            <td style="padding:10px 16px;font-weight:bold">Labor (curation)</td>
            <td style="padding:10px 16px;text-align:right">$${parseFloat(labor_cost).toFixed(2)}</td>
          </tr>
          <tr style="background:#f9f5e8">
            <td style="padding:10px 16px;font-weight:bold;color:#0b2a45">FedEx Shipping</td>
            <td style="padding:10px 16px;text-align:right;color:#0b2a45">$${parseFloat(shipping_cost).toFixed(2)}</td>
          </tr>
          <tr style="background:#0b2a45;color:#d49a22">
            <td style="padding:10px 16px;font-weight:bold">Total</td>
            <td style="padding:10px 16px;text-align:right;font-weight:bold">$${total.toFixed(2)}</td>
          </tr>
        </table>
        ${admin_notes ? `<p><strong>Notes from NCT:</strong> ${admin_notes}</p>` : ""}
        <p>Please log in to your portal to <strong>confirm or decline</strong> this quote. We won't ship until you confirm.</p>
        <p style="margin-top:16px">
          <a href="https://www.nctrecycling.com/nonprofit/dashboard" style="background:#0b2a45;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block">
            Review Quote →
          </a>
        </p>
        <p style="margin-top:12px;font-size:13px;color:#666">
          Questions? <a href="tel:+19702329108" style="color:#0b2a45">(970) 232-9108</a> &nbsp;|&nbsp;
          <a href="mailto:donate@nctrecycling.com" style="color:#0b2a45">donate@nctrecycling.com</a>
        </p>
        <p>— NCT Recycling Team</p>
      `,
    }).catch((err) => console.error("Quote email error:", err));

    return NextResponse.json({ success: true });
  }

  // ── Schedule / update an appointment ──
  const { status, scheduled_date, scheduled_time, admin_notes } = body;

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
    const dateStr = new Date(scheduled_date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const typeLabel = appt.appointment_type === "in_person" ? "in-person warehouse visit" : "delivery";
    const totalCost = (appt.labor_cost != null && appt.shipping_cost != null)
      ? `$${(parseFloat(appt.labor_cost) + parseFloat(appt.shipping_cost)).toFixed(2)}`
      : null;

    resend.emails.send({
      from: "NCT Recycling <donate@nctrecycling.com>",
      to: np.email,
      subject: `Exchange Appointment Confirmed — ${dateStr}`,
      html: `
        <h2>Your Exchange Appointment is Confirmed</h2>
        <p>Hi ${np.contact_name?.split(" ")[0] || "there"},</p>
        <p>Your <strong>${typeLabel}</strong> appointment has been scheduled.</p>
        <p><strong>Date:</strong> ${dateStr}${scheduled_time ? `<br><strong>Time:</strong> ${scheduled_time}` : ""}</p>
        ${totalCost ? `<p><strong>Total Cost:</strong> ${totalCost} (labor + shipping)</p>` : ""}
        ${admin_notes ? `<p><strong>Notes from NCT:</strong> ${admin_notes}</p>` : ""}
        ${appt.appointment_type === "in_person"
          ? "<p>Please arrive at 6108 South College Ave, STE C, Fort Collins, CO 80525. Check in with staff when you arrive.</p>"
          : "<p>We will prepare your lot and ship to the address on file. You will receive a FedEx tracking number once shipped.</p>"
        }
        <p>Questions? Call us at (970) 232-9108 or reply to this email.</p>
        <p>— NCT Recycling Team</p>
      `,
    }).catch((err) => console.error("Appointment email error:", err));
  }

  return NextResponse.json({ success: true });
}
