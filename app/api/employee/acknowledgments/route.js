import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { activateEmployeeProfileByUserId } from "@/lib/employee-profile";
import { REQUIRED_TEMPLATE_SLUGS } from "@/lib/employee-acknowledgments";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (profile?.role !== "employee") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const employee = await activateEmployeeProfileByUserId(user.id, db);
  if (!employee?.id) {
    return NextResponse.json({ error: "Employee profile not found." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const templateId = body?.template_id;
  const signedName = (body?.signed_name || "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "template_id is required." }, { status: 400 });
  }
  if (!signedName) {
    return NextResponse.json({ error: "signed_name is required." }, { status: 400 });
  }

  const { data: tpl, error: tplErr } = await db
    .from("agreement_templates")
    .select("id, program_type, template_slug, version_label, is_active")
    .eq("id", templateId)
    .maybeSingle();

  if (tplErr) {
    return NextResponse.json({ error: "Template lookup failed." }, { status: 500 });
  }
  if (!tpl) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  if (tpl.program_type !== "employment") {
    return NextResponse.json(
      { error: "Template is not an employment document." },
      { status: 400 },
    );
  }
  if (!tpl.is_active) {
    return NextResponse.json(
      { error: "Template is no longer active." },
      { status: 400 },
    );
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;

  const { error: insertErr } = await db.from("employee_acknowledgments").insert({
    employee_id: employee.id,
    template_id: tpl.id,
    template_slug: tpl.template_slug,
    version_label: tpl.version_label,
    signed_name: signedName,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "You already signed this version." },
        { status: 409 },
      );
    }
    console.error("Acknowledgment insert error:", insertErr);
    return NextResponse.json(
      { error: "Failed to save acknowledgment." },
      { status: 500 },
    );
  }

  // If this completes the required set, mark onboarding_complete.
  if (REQUIRED_TEMPLATE_SLUGS.includes(tpl.template_slug)) {
    const { data: signedRequired } = await db
      .from("employee_acknowledgments")
      .select("template_slug")
      .eq("employee_id", employee.id)
      .in("template_slug", REQUIRED_TEMPLATE_SLUGS);
    const signedSlugs = new Set((signedRequired || []).map((r) => r.template_slug));
    const allSigned = REQUIRED_TEMPLATE_SLUGS.every((s) => signedSlugs.has(s));
    if (allSigned && !employee.onboarding_complete) {
      await db
        .from("employee_profiles")
        .update({
          onboarding_complete: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", employee.id);
    }
  }

  return NextResponse.json({ success: true });
}
