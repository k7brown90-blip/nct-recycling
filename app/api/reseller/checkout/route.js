import { getCurrentResellerContext } from "@/lib/reseller-auth";
import { createShopifyDraftOrder, fetchShopifyCatalog } from "@/lib/shopify";
import { NextResponse } from "next/server";

function buildVariantLookup(products) {
  const lookup = new Map();

  for (const product of products || []) {
    for (const variant of product.variants || []) {
      if (!variant?.legacyId) continue;
      lookup.set(String(variant.legacyId), { product, variant });
    }
  }

  return lookup;
}

export async function POST(request) {
  const { user, reseller } = await getCurrentResellerContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!reseller) {
    return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const cartItems = Array.isArray(body?.items) ? body.items : [];
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (cartItems.length === 0) {
    return NextResponse.json({ error: "Add at least one item before checkout." }, { status: 400 });
  }

  const catalog = await fetchShopifyCatalog({ limit: 120 });
  if (catalog.source !== "shopify" || !catalog.configured) {
    return NextResponse.json({ error: "Checkout is unavailable until Shopify sync is configured." }, { status: 503 });
  }

  const variantLookup = buildVariantLookup(catalog.products || []);
  const normalizedItems = [];

  for (const item of cartItems) {
    const variantId = String(item?.variantLegacyId || "").trim();
    const quantity = Number(item?.quantity || 0);

    if (!variantId || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "One or more cart items are invalid." }, { status: 400 });
    }

    const matched = variantLookup.get(variantId);
    if (!matched) {
      return NextResponse.json({ error: "One or more selected variants are no longer available." }, { status: 409 });
    }

    if (matched.variant.inventory !== null && matched.variant.inventory !== undefined && quantity > matched.variant.inventory && matched.variant.inventory >= 0) {
      return NextResponse.json({ error: `${matched.product.title} does not have enough inventory for that quantity.` }, { status: 409 });
    }

    normalizedItems.push({
      variantLegacyId: matched.variant.legacyId,
      quantity,
      title: matched.product.title,
      variantTitle: matched.variant.title,
      price: matched.variant.price,
      image: matched.product.image?.url || null,
    });
  }

  const draftOrder = await createShopifyDraftOrder({ reseller, items: normalizedItems, note });

  if (!draftOrder) {
    return NextResponse.json({ error: "Failed to create the Shopify checkout." }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    order: {
      id: String(draftOrder.id),
      name: draftOrder.name || `Draft #${draftOrder.id}`,
      invoice_url: draftOrder.invoice_url || null,
      total_price: draftOrder.total_price || null,
      subtotal_price: draftOrder.subtotal_price || null,
      currency: draftOrder.currency || "USD",
      created_at: draftOrder.created_at || new Date().toISOString(),
    },
  });
}
