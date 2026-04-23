import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const CONTENT_W = PAGE_W - 2 * MARGIN;

function formatMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0.00";
  return parsed.toFixed(2);
}

function formatDateTime(value) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/Denver",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: "America/Denver",
    }),
  };
}

function buildAddressBlock(account) {
  return [account.address_street, [account.address_city, account.address_state, account.address_zip].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join("\n");
}

function getFrequencyLabel(frequency) {
  switch (frequency) {
    case "biweekly":
      return "bi-weekly";
    case "monthly":
      return "monthly";
    case "adhoc":
      return "ad hoc";
    default:
      return "weekly";
  }
}

function getRecurringThresholdNote(account) {
  switch (account.pickup_frequency) {
    case "biweekly":
      return `${account.org_name} is expected to meet the bi-weekly threshold of approximately ${Number(account.min_lbs_biweekly || 0).toLocaleString()} lbs under normal operating conditions.`;
    case "monthly":
      return `${account.org_name} is expected to meet the monthly threshold based on its reported accumulation schedule.`;
    case "adhoc":
      return `${account.org_name} operates on an ad hoc pickup cadence and must meet the single-run threshold for payment eligibility.`;
    default:
      return `${account.org_name} is expected to meet the weekly threshold of approximately ${Number(account.min_lbs_weekly || 0).toLocaleString()} lbs under normal operating conditions.`;
  }
}

export function buildDiscardAgreementText(account) {
  const organizationName = account.org_name || "Participating Organization";
  const addressBlock = buildAddressBlock(account);
  const projectedWeeklyLbs = Number(account.projected_lbs_week || 0);
  const recurringRate = Number(account.rate_per_1000_lbs || 0);
  const estimatedRecurringComp = projectedWeeklyLbs > 0 && recurringRate > 0
    ? `$${formatMoney((projectedWeeklyLbs / 1000) * recurringRate)}`
    : "based on actual qualifying volume";

  return `NCT Recycling
Textile Discard Purchase Operating Agreement

This is a legally binding contract. By signing below, the participating organization acknowledges that it has read, understood, and agrees to all terms and conditions contained in this Agreement.

This Agreement is entered into with:
${organizationName}
${addressBlock || "Address on file with NCT Recycling"}

Primary Contact:
${account.contact_name || "Primary contact on file"}
Phone: ${account.contact_phone || "Not provided"}
Email: ${account.contact_email || "Not provided"}

1. Purpose

This Agreement defines a flat-rate, volume-based structure for organizations that elect to sell textile discard rather than participate in the NCT Recycling Co-Op Network. It is intended to ensure operational sustainability and to avoid pickups that result in a net loss.

2. Scope of Material

Material covered under this Agreement includes textile material only, designated by ${organizationName} as discard or overstock.

NCT Recycling is not a general disposal company and does not accept non-textile waste of any kind.

NCT Recycling reserves the right to reject any load that presents safety, contamination, or handling concerns.

3. Compensation Structure

Compensation under this Agreement is volume-based and does not use per-pound market pricing.

- $${formatMoney(account.rate_per_1000_lbs)} per 1,000 lbs of qualifying textile material
- A full truckload is defined as approximately ${Number(account.min_lbs_adhoc || 0).toLocaleString()} lbs
- Compensation for a full truckload is $${formatMoney(account.flat_rate_per_pickup)} per pickup

Compensation does not fluctuate with resale outcomes, quality grades, or market conditions.

For ${organizationName}, projected volume is approximately ${projectedWeeklyLbs.toLocaleString()} lbs per week. At the established rate of $${formatMoney(account.rate_per_1000_lbs)} per 1,000 lbs, expected compensation is approximately ${estimatedRecurringComp} per qualifying ${getFrequencyLabel(account.pickup_frequency)} pickup, subject to meeting minimum volume thresholds.

4. Minimum Volume Requirements for Payment

A. Recurring Pickups (Within an Established Route)

- Weekly pickup: minimum ${Number(account.min_lbs_weekly || 0).toLocaleString()} lbs
- Bi-weekly pickup: minimum ${Number(account.min_lbs_biweekly || 0).toLocaleString()} lbs
- Monthly pickup: minimum ${Number(account.min_lbs_biweekly || 0).toLocaleString()} lbs unless otherwise agreed in writing

${getRecurringThresholdNote(account)}

If the applicable minimum volume is not met, no payment will be issued for that pickup.

B. Single-Run or Non-Recurring Pickups

- Full truckload minimum: approximately ${Number(account.min_lbs_adhoc || 0).toLocaleString()} lbs
- Payment: $${formatMoney(account.flat_rate_per_pickup)}
- Loads below ${Number(account.min_lbs_adhoc || 0).toLocaleString()} lbs are not eligible for payment

These minimums exist to ensure pickups can be completed without operating at a net loss.

5. Pickup Scheduling and Routing

- Recurring pickups must align with established routes and operational availability
- Partial loads must fit within a larger route
- Full truckloads may be scheduled independently
- Scheduling is subject to availability, routing efficiency, and operational capacity

6. Payment Terms

- Payment is issued per completed pickup that meets all requirements of this Agreement
- Payment method and timing will be agreed upon in advance
- No additional compensation is provided for sorting, quality, brand value, or resale outcome

This Agreement reflects a discard purchase, not a resale partnership or revenue-sharing arrangement.

7. No Co-Op Participation or Additional Benefits

This Agreement does not include participation in the NCT Recycling Co-Op Network and provides no redistribution access, promotional or advertising benefits, or partnership designation.

8. Accepted Material, Prohibited Material, Shoes, and Credential Donations

Only textile material is accepted under this Agreement. NCT Recycling is not a disposal company and does not accept non-textile waste under any condition.

Accepted Materials

- Clothing
- Paired shoes and boots
- Towels
- Linens
- Blankets (non-stuffed)
- Bags, backpacks, belts, and hats

All accepted materials must be dry and reasonably contained for transport.

Not Accepted Under Any Condition

- Soiled, contaminated, or wet textiles
- Hazardous or biohazard materials
- Non-textile waste or trash
- Clothes or pant hangers
- Comforters
- Pillows
- Bedding with fill
- Stuffed animals
- Toys

If prohibited material is present, NCT Recycling reserves the right to reject the entire load and issue no payment.

Shoes must be separated from clothing and paired when the load has been reviewed or sorted.

Credential or unreviewed donations may be included in a payable load without prior sorting, provided the material is reasonably contained, non-hazardous, and not knowingly contaminated.

9. Responsibilities of Participating Organization

${organizationName} agrees to:

- Accurately represent volumes
- Provide safe pickup access
- Ensure materials are reasonably contained for transport
- Designate discard material in good faith

10. Term and Termination

This Agreement shall have an initial term of one (1) year.

Following the initial term, this Agreement may be terminated by either party with sixty (60) days written notice.

11. Intended Use

This Agreement governs transactional textile discard sales only and does not establish co-op participation. Textiles collected may still be processed through NCT Recycling systems; however, participation under this Agreement does not grant co-op benefits.`;
}

export async function generateDiscardAgreementPDF({ account, signerName, signedAt }) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pages = [];
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = PAGE_H - MARGIN;

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    y = PAGE_H - MARGIN;
  }

  function ensureSpace(needed) {
    if (y - needed < MARGIN + 48) newPage();
  }

  function wrapText(text, maxW, size, font) {
    const lines = [];
    for (const para of text.split("\n")) {
      if (!para.trim()) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of para.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= maxW) {
          line = test;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function drawBlock(text, { size = 10, font = regular, indent = 0, spaceBefore = 0, spaceAfter = 8, leading = 14 } = {}) {
    y -= spaceBefore;
    const lines = wrapText(text, CONTENT_W - indent, size, font);
    for (const line of lines) {
      if (line === "") {
        y -= leading / 2;
        continue;
      }
      ensureSpace(leading);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color: rgb(0, 0, 0) });
      y -= leading;
    }
    y -= spaceAfter;
  }

  function drawRule() {
    ensureSpace(8);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 12;
  }

  const signedStamp = formatDateTime(signedAt);
  drawBlock("NCT RECYCLING", { size: 7, font: regular, spaceAfter: 2, leading: 10 });
  drawBlock("Textile Discard Purchase Operating Agreement", { size: 16, font: bold, spaceAfter: 6, leading: 20 });
  drawBlock(`Electronically signed: ${signedStamp.date} at ${signedStamp.time}`, { size: 8, font: italic, spaceAfter: 4, leading: 11 });
  drawBlock(`Discard Account ID: ${account.id}`, { size: 8, spaceAfter: 10, leading: 11 });
  drawRule();

  const sections = buildDiscardAgreementText(account).split("\n");
  for (const line of sections) {
    const trimmed = line.trim();
    const isHeader = /^\d+\.\s+[A-Z]/.test(trimmed);
    const isSubHeader = /^[A-Z]\.\s+/.test(trimmed) || ["Accepted Materials", "Not Accepted Under Any Condition", "Primary Contact:"].includes(trimmed);
    const isBullet = trimmed.startsWith("-");

    if (!trimmed) {
      y -= 4;
    } else if (isHeader) {
      drawBlock(trimmed, { size: 10, font: bold, spaceBefore: 10, spaceAfter: 4, leading: 14 });
    } else if (isSubHeader) {
      drawBlock(trimmed, { size: 10, font: bold, spaceBefore: 4, spaceAfter: 2, leading: 14 });
    } else if (isBullet) {
      drawBlock(trimmed, { size: 10, indent: 14, spaceAfter: 2, leading: 14 });
    } else {
      drawBlock(trimmed, { size: 10, spaceAfter: 4, leading: 14 });
    }
  }

  ensureSpace(150);
  y -= 16;
  drawRule();
  drawBlock("ELECTRONIC SIGNATURE & ACCEPTANCE", { size: 11, font: bold, spaceAfter: 12, leading: 15 });
  drawBlock(`Participating Organization: ${account.org_name}`, { size: 10, font: bold, spaceAfter: 6 });
  drawBlock(`Authorized Representative: ${signerName}`, { size: 10, font: italic, spaceAfter: 6 });
  drawBlock(`Contact Email: ${account.contact_email || "Not provided"}`, { size: 10, spaceAfter: 6 });
  drawBlock(`Contact Phone: ${account.contact_phone || "Not provided"}`, { size: 10, spaceAfter: 6 });
  drawBlock(`Accepted On: ${signedStamp.date} at ${signedStamp.time}`, { size: 10, spaceAfter: 10 });
  drawBlock(
    "This document was electronically executed via the NCT Recycling Partner Portal. The digital signature is legally binding under applicable electronic signature laws. This PDF is a timestamped record of the agreement accepted at the date and time shown above.",
    { size: 8, font: italic, leading: 12, spaceAfter: 0 }
  );

  for (let index = 0; index < pages.length; index += 1) {
    const currentPage = pages[index];
    const pageNumber = `Page ${index + 1} of ${pages.length}`;
    const pageNumberWidth = regular.widthOfTextAtSize(pageNumber, 8);
    currentPage.drawText(pageNumber, { x: (PAGE_W - pageNumberWidth) / 2, y: 36, size: 8, font: regular, color: rgb(0.55, 0.55, 0.55) });
    currentPage.drawText("NCT Recycling  |  6108 South College Ave STE C, Fort Collins CO 80525  |  donate@nctrecycling.com", {
      x: MARGIN,
      y: 24,
      size: 7,
      font: regular,
      color: rgb(0.65, 0.65, 0.65),
    });
  }

  return pdfDoc.save();
}