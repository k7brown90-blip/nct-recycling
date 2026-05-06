import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — list signed acknowledgments for an employee + the active employment
// templates so admin can see what's pending vs signed.
export async function GET(request, { params }) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id: employeeId } = await params;
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employee id." }, { status: 400 });
  }

  const db = createServiceClient();

  const [signedRes, templatesRes] = await Promise.all([
    db
      .from("employee_acknowledgments")
      .select(
        "id, template_id, template_slug, version_label, signed_name, signed_at, ip_address",
      )
      .eq("employee_id", employeeId)
      .order("signed_at", { ascending: false }),
    db
      .from("agreement_templates")
      .select("id, template_slug, version_label, title")
      .eq("program_type", "employment")
      .eq("is_active", true)
      .order("title", { ascending: true }),
  ]);

  if (signedRes.error) {
    return NextResponse.json(
      { error: "Failed to fetch acknowledgments." },
      { status: 500 },
    );
  }
  if (templatesRes.error) {
    return NextResponse.json(
      { error: "Failed to fetch templates." },
      { status: 500 },
    );
  }

  const signed = signedRes.data || [];
  const templates = templatesRes.data || [];
  const signedTemplateIds = new Set(signed.map((s) => s.template_id));
  const pending = templates.filter((t) => !signedTemplateIds.has(t.id));

  return NextResponse.json({ signed, pending, active_templates: templates });
}
