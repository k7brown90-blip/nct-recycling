// Server-side helpers for fetching agreement text from the
// `agreement_templates` table. Falls back to the legacy bundled text
// in lib/agreement-text.js if the database lookup fails (e.g. during
// schema migration windows).

import { createServiceClient } from "@/lib/supabase";
import { RESELLER_PARTNER_AGREEMENT, CO_OP_AGREEMENT } from "@/lib/agreement-text";

const LEGACY_FALLBACK = {
  reseller: {
    template_slug: "reseller_buyer_agreement",
    version_label: "buyer_v1",
    title: "NCT Recycling Reseller Buyer Agreement",
    body_text: RESELLER_PARTNER_AGREEMENT,
    is_active: true,
    id: null,
  },
  co_op: {
    template_slug: "co_op_participation",
    version_label: "v1-live-import",
    title: "NCT Recycling Co-Op Network Participation Agreement",
    body_text: CO_OP_AGREEMENT,
    is_active: true,
    id: null,
  },
};

/**
 * Fetch the active agreement template for a given program type.
 * Returns the row { id, program_type, template_slug, version_label, title, body_text, ... }
 * or a legacy fallback object (id: null) if none is found.
 */
export async function getActiveAgreement(programType) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("agreement_templates")
      .select("id, program_type, template_slug, version_label, title, body_text, is_active")
      .eq("program_type", programType)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("getActiveAgreement error:", error);
      return LEGACY_FALLBACK[programType] || null;
    }
    if (!data) {
      return LEGACY_FALLBACK[programType] || null;
    }
    return data;
  } catch (err) {
    console.error("getActiveAgreement exception:", err);
    return LEGACY_FALLBACK[programType] || null;
  }
}
