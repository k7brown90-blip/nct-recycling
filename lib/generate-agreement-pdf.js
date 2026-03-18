import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { CO_OP_AGREEMENT } from "./agreement-text.js";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const CONTENT_W = PAGE_W - 2 * MARGIN;

export async function generateAgreementPDF({
  org_name,
  contact_name,
  authorized_title,
  contract_signed_name,
  contract_agreed_at,
  ein,
  email,
  application_id,
}) {
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
    if (y - needed < MARGIN + 48) newPage(); // 48pt reserved for footer
  }

  function wrapText(text, maxW, size, font) {
    const lines = [];
    for (const para of text.split("\n")) {
      if (!para.trim()) { lines.push(""); continue; }
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

  function drawBlock(text, { size = 10, font: f = regular, indent = 0, spaceBefore = 0, spaceAfter = 8, leading = 14 } = {}) {
    y -= spaceBefore;
    const lines = wrapText(text, CONTENT_W - indent, size, f);
    for (const line of lines) {
      if (line === "") { y -= leading / 2; continue; }
      ensureSpace(leading);
      page.drawText(line, { x: MARGIN + indent, y, size, font: f, color: rgb(0, 0, 0) });
      y -= leading;
    }
    y -= spaceAfter;
  }

  function drawHRule(color = rgb(0.75, 0.75, 0.75)) {
    ensureSpace(8);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color });
    y -= 12;
  }

  // ── Header ──
  drawBlock("NCT RECYCLING LLC", { size: 7, font: regular, spaceAfter: 2, leading: 10 });
  drawBlock("Co-Op Network Participation Agreement", { size: 16, font: bold, spaceAfter: 6, leading: 20 });

  const signedDate = new Date(contract_agreed_at);
  const dateStr = signedDate.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "America/Denver",
  });
  const timeStr = signedDate.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: "America/Denver",
  });
  drawBlock(`Electronically signed: ${dateStr} at ${timeStr}`, { size: 8, font: italic, spaceAfter: 4, leading: 11 });
  drawBlock(`Document ID: ${application_id}`, { size: 8, font: regular, spaceAfter: 10, leading: 11 });
  drawHRule(rgb(0.11, 0.16, 0.27)); // nct-navy

  // ── Agreement body ──
  const sections = CO_OP_AGREEMENT.split("\n");
  for (const line of sections) {
    const trimmed = line.trim();
    // Section headers: "1. TITLE" style
    const isHeader = /^\d+\.\s+[A-Z]/.test(trimmed);
    const isIndented = line.startsWith("  ");

    if (isHeader) {
      drawBlock(trimmed, { size: 10, font: bold, spaceBefore: 10, spaceAfter: 4, leading: 14 });
    } else if (trimmed === "") {
      y -= 4;
    } else if (isIndented) {
      drawBlock(trimmed, { size: 10, font: regular, indent: 16, spaceAfter: 2, leading: 14 });
    } else {
      drawBlock(trimmed, { size: 10, font: regular, spaceAfter: 4, leading: 14 });
    }
  }

  // ── Signature block ──
  ensureSpace(180);
  y -= 16;
  drawHRule();
  drawBlock("ELECTRONIC SIGNATURE & ACCEPTANCE", { size: 11, font: bold, spaceAfter: 12, leading: 15 });

  // Two-column layout for parties
  const col1x = MARGIN;
  const col2x = MARGIN + CONTENT_W / 2 + 12;
  const colW = CONTENT_W / 2 - 12;

  function drawSigField(label, value, x, colWidth, fontUsed = regular) {
    ensureSpace(40);
    page.drawText(label, { x, y, size: 8, font: regular, color: rgb(0.4, 0.4, 0.4) });
    y -= 13;
    page.drawText(value || "—", { x, y, size: 10, font: fontUsed, color: rgb(0, 0, 0) });
    y -= 2;
    page.drawLine({ start: { x, y }, end: { x: x + colWidth, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 14;
  }

  // Save y position for two-column
  const sigStartY = y;

  // Left column: Participating Organization
  page.drawText("PARTICIPATING ORGANIZATION", { x: col1x, y, size: 9, font: bold, color: rgb(0.11, 0.16, 0.27) });
  y -= 18;
  drawSigField("Organization Name", org_name, col1x, colW);
  const afterOrg = y;
  drawSigField("Authorized Representative", contract_signed_name, col1x, colW, italic);
  drawSigField("Title / Authority", authorized_title, col1x, colW);
  drawSigField("Email", email, col1x, colW);
  drawSigField("EIN", ein || "—", col1x, colW);
  drawSigField("Date & Time", `${dateStr} at ${timeStr}`, col1x, colW);
  const leftBottom = y;

  // Right column: NCT Recycling
  y = sigStartY;
  page.drawText("NCT RECYCLING LLC", { x: col2x, y, size: 9, font: bold, color: rgb(0.11, 0.16, 0.27) });
  y -= 18;
  drawSigField("Organization", "NCT Recycling LLC", col2x, colW);
  y = afterOrg;
  drawSigField("Authorized Representative", "NCT Recycling Administration", col2x, colW);
  drawSigField("Address", "6108 South College Ave STE C", col2x, colW);
  drawSigField("City / State / Zip", "Fort Collins, CO 80525", col2x, colW);
  drawSigField("Phone", "(970) 232-9108", col2x, colW);
  drawSigField("Email", "donate@nctrecycling.com", col2x, colW);

  y = leftBottom - 20;
  drawHRule(rgb(0.75, 0.75, 0.75));
  drawBlock(
    "This document was electronically executed via the NCT Recycling Partner Portal. The digital signature is legally binding under applicable electronic signature laws. This PDF is a timestamped record of the agreement accepted at the date and time shown above.",
    { size: 8, font: italic, leading: 12, spaceAfter: 0 }
  );

  // ── Page footers ──
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const num = `Page ${i + 1} of ${pages.length}`;
    const numW = regular.widthOfTextAtSize(num, 8);
    p.drawText(num, { x: (PAGE_W - numW) / 2, y: 36, size: 8, font: regular, color: rgb(0.55, 0.55, 0.55) });
    p.drawText("NCT Recycling LLC  |  6108 South College Ave STE C, Fort Collins CO 80525  |  donate@nctrecycling.com", {
      x: MARGIN, y: 24, size: 7, font: regular, color: rgb(0.65, 0.65, 0.65),
    });
  }

  return pdfDoc.save();
}
