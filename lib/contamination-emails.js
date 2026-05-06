import { Resend } from "resend";
import { createSignedStorageUrl } from "@/lib/agreement-documents";

const resend = new Resend(process.env.RESEND_API_KEY);

const SEVERITY_LABELS = {
  minor: "Minor contamination — load accepted with notice",
  major: "Major contamination — load accepted under protest",
  rejected: "Load rejected — no payment per Section 8",
};

/**
 * Sends a contamination notice to the partner's contact email.
 *
 * @param {object} db Service-role Supabase client
 * @param {object} ctx
 * @param {string} ctx.account.org_name
 * @param {string} ctx.account.contact_email
 * @param {string} [ctx.account.contact_name]
 * @param {string} ctx.pickup.id
 * @param {string} ctx.pickup.pickup_date
 * @param {number} ctx.pickup.weight_lbs
 * @param {string} ctx.pickup.contamination_severity
 * @param {string} [ctx.pickup.contamination_notes]
 * @param {string} [ctx.pickup.contamination_source]
 * @param {Array<{storage_bucket: string, storage_path: string, original_filename?: string}>} [ctx.photos]
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendContaminationNotice(db, { account, pickup, photos = [] }) {
  if (!account?.contact_email) {
    return { success: false, error: "No partner contact email on file." };
  }

  const severity = pickup.contamination_severity || "rejected";
  const severityLabel = SEVERITY_LABELS[severity] || severity;
  const greeting = account.contact_name ? `Hi ${account.contact_name},` : "Hi,";
  const sourceLabel = pickup.contamination_source === "driver" ? "the driver on-site" : "our intake team";
  const noPayment = severity === "rejected";

  // Generate 24h signed URLs for the photo evidence.
  const photoLinks = [];
  for (const photo of photos) {
    try {
      const url = await createSignedStorageUrl(
        db,
        photo.storage_bucket || "discard-contamination",
        photo.storage_path,
        60 * 60 * 24 // 24 hours
      );
      if (url) photoLinks.push({ url, filename: photo.original_filename || "photo" });
    } catch (urlError) {
      console.error("Failed to sign contamination photo url:", urlError);
    }
  }

  const photoHtml = photoLinks.length
    ? `
      <p style="font-size:14px;margin:18px 0 6px"><strong>Photo evidence (links expire in 24 hours):</strong></p>
      <ul style="font-size:13px;padding-left:18px;margin:0 0 12px">
        ${photoLinks
          .map(
            (p) =>
              `<li><a href="${p.url}" style="color:#0b2a45">${p.filename}</a></li>`
          )
          .join("")}
      </ul>`
    : "";

  const notesHtml = pickup.contamination_notes
    ? `<p style="font-size:14px;margin:0 0 12px"><strong>Notes from ${sourceLabel}:</strong><br>${escapeHtml(pickup.contamination_notes)}</p>`
    : "";

  const subject = noPayment
    ? `Contaminated load notice — no payment will be issued (${pickup.pickup_date})`
    : `Contamination notice — pickup ${pickup.pickup_date}`;

  const { error } = await resend.emails.send({
    from: "NCT Recycling <noreply@nctrecycling.com>",
    to: account.contact_email,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#0b2a45;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:22px">NCT Recycling</h1>
          <p style="color:#d49a22;margin:4px 0 0;font-size:13px;letter-spacing:1px;text-transform:uppercase">Contamination Notice</p>
        </div>
        <div style="background:#f9f9f9;padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">
          <p style="font-size:16px;margin:0 0 12px">${greeting}</p>
          <p style="font-size:15px;margin:0 0 14px">
            On <strong>${pickup.pickup_date}</strong>, ${sourceLabel} flagged the discard load
            from <strong>${escapeHtml(account.org_name || "your organization")}</strong>
            for contamination.
          </p>
          <p style="font-size:14px;margin:0 0 12px"><strong>Severity:</strong> ${severityLabel}</p>
          ${notesHtml}
          ${photoHtml}
          ${
            noPayment
              ? `<div style="background:#fff3cd;border:1px solid #ffc107;padding:14px 18px;border-radius:6px;margin:16px 0">
                  <p style="margin:0;font-size:14px;color:#664d03">
                    Per <strong>Section 8</strong> of the Discard Purchase Agreement, contaminated loads (soiled, wet, hazardous,
                    or otherwise non-conforming material) are not eligible for payment. <strong>No payment will be issued for this load.</strong>
                  </p>
                </div>`
              : `<p style="font-size:14px;margin:0 0 12px">This load was accepted but documented for the record. Repeated contamination may impact future eligibility per Section 8.</p>`
          }
          <p style="font-size:14px;margin:18px 0 0">
            Please review the not-accepted materials list and contamination guidelines in your partner portal.
            Questions? Reply to this email or call (970) 232-9108.
          </p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
          <p style="font-size:12px;color:#999;margin:0">
            NCT Recycling LLC · 6108 South College Ave STE C, Fort Collins CO 80525<br>
            <a href="mailto:donate@nctrecycling.com" style="color:#999">donate@nctrecycling.com</a>
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    return { success: false, error: error.message || String(error) };
  }
  return { success: true };
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
