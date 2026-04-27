import { canAccessResellerStore, getCurrentResellerContext } from "@/lib/reseller-auth";
import { deleteShopifyDraftOrder, fetchShopifyDraftOrderById } from "@/lib/shopify";
import { NextResponse } from "next/server";

function normalizeDraftId(value) {
  return String(value || "").trim();
}

export async function GET(_request, context) {
  const { user, reseller } = await getCurrentResellerContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canAccessResellerStore(reseller)) {
    return NextResponse.json({ error: "Approved reseller access is required." }, { status: 403 });
  }

  const params = await context.params;
  const draftId = normalizeDraftId(params?.draftId);

  if (!draftId) {
    return NextResponse.json({ error: "Draft order id is required." }, { status: 400 });
  }

  const draftOrder = await fetchShopifyDraftOrderById(draftId);

  if (!draftOrder || String(draftOrder.legacyId || "") !== draftId) {
    return NextResponse.json({ error: "Draft order not found." }, { status: 404 });
  }

  if (String(draftOrder.email || reseller.email || "").toLowerCase() !== String(reseller.email || "").toLowerCase()) {
    return NextResponse.json({ error: "Draft order not found." }, { status: 404 });
  }

  return NextResponse.json({ order: draftOrder });
}

export async function DELETE(_request, context) {
  const { user, reseller } = await getCurrentResellerContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canAccessResellerStore(reseller)) {
    return NextResponse.json({ error: "Approved reseller access is required." }, { status: 403 });
  }

  const params = await context.params;
  const draftId = normalizeDraftId(params?.draftId);

  if (!draftId) {
    return NextResponse.json({ error: "Draft order id is required." }, { status: 400 });
  }

  const draftOrder = await fetchShopifyDraftOrderById(draftId);

  if (!draftOrder || String(draftOrder.legacyId || "") !== draftId) {
    return NextResponse.json({ error: "Draft order not found." }, { status: 404 });
  }

  if (String(draftOrder.email || reseller.email || "").toLowerCase() !== String(reseller.email || "").toLowerCase()) {
    return NextResponse.json({ error: "Draft order not found." }, { status: 404 });
  }

  await deleteShopifyDraftOrder(draftId);

  return NextResponse.json({ success: true, canceled_draft_id: draftId });
}