import { createServiceClient as defaultClient } from "@/lib/supabase";

/**
 * List active employment-category templates. These are the documents
 * an employee may need to acknowledge.
 *
 * Returns rows: { id, template_slug, version_label, title, body_text }
 */
export async function listActiveEmploymentTemplates(db) {
  const supabase = db || defaultClient();
  const { data, error } = await supabase
    .from("agreement_templates")
    .select("id, template_slug, version_label, title, body_text")
    .eq("program_type", "employment")
    .eq("is_active", true)
    .order("title", { ascending: true });
  if (error) {
    console.error("listActiveEmploymentTemplates error:", error);
    return [];
  }
  return data || [];
}

/**
 * List all acknowledgments signed by an employee.
 */
export async function listEmployeeAcknowledgments(employeeId, db) {
  if (!employeeId) return [];
  const supabase = db || defaultClient();
  const { data, error } = await supabase
    .from("employee_acknowledgments")
    .select("id, template_id, template_slug, version_label, signed_name, signed_at")
    .eq("employee_id", employeeId)
    .order("signed_at", { ascending: false });
  if (error) {
    console.error("listEmployeeAcknowledgments error:", error);
    return [];
  }
  return data || [];
}

/**
 * Required employment templates (e.g. employment_agreement_v3) that block
 * onboarding completion. Other templates (role addenda, equipment auths)
 * are visible/signable but not required for the gate.
 */
export const REQUIRED_TEMPLATE_SLUGS = ["employment_agreement_v3"];

/**
 * Compute pending vs signed templates for the employee. Pending = active
 * employment templates the employee has NOT signed at the active version.
 */
export async function buildEmployeeAgreementSummary(employeeId, db) {
  const supabase = db || defaultClient();
  const [templates, signed] = await Promise.all([
    listActiveEmploymentTemplates(supabase),
    listEmployeeAcknowledgments(employeeId, supabase),
  ]);
  const signedByTemplateId = new Map(signed.map((s) => [s.template_id, s]));

  const pending = [];
  const completed = [];
  for (const tpl of templates) {
    const ack = signedByTemplateId.get(tpl.id);
    if (ack) {
      completed.push({ ...tpl, acknowledgment: ack });
    } else {
      pending.push(tpl);
    }
  }

  const requiredSlugs = new Set(REQUIRED_TEMPLATE_SLUGS);
  const requiredPending = pending.filter((t) => requiredSlugs.has(t.template_slug));
  const onboardingBlocked = requiredPending.length > 0;

  return {
    pending,
    completed,
    requiredPending,
    onboardingBlocked,
  };
}
