import { buildCatalogSummary, buildCategoryCards } from "@/lib/store-catalog";
import { canAccessResellerStore, getCurrentResellerContext } from "@/lib/reseller-auth";
import { fetchShopifyCatalog } from "@/lib/shopify";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, reseller } = await getCurrentResellerContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canAccessResellerStore(reseller)) {
    return NextResponse.json({ error: "Approved reseller access is required." }, { status: 403 });
  }

  const catalog = await fetchShopifyCatalog({ limit: 120 });
  const products = catalog.products || [];

  return NextResponse.json({
    configured: catalog.configured,
    source: catalog.source,
    warning: catalog.warning || null,
    checkout_supported: catalog.source === "shopify" && catalog.configured,
    summary: buildCatalogSummary(products),
    categories: buildCategoryCards(products),
    featured_products: products.slice(0, 8),
    products,
    reseller: {
      id: reseller.id,
      full_name: reseller.full_name,
      business_name: reseller.business_name,
      email: reseller.email,
      status: reseller.status,
      program_type: reseller.program_type,
    },
  });
}
