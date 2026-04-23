import { buildCatalogSummary, buildCategoryCards } from "@/lib/store-catalog";
import { fetchShopifyCatalog } from "@/lib/shopify";
import { NextResponse } from "next/server";

export async function GET() {
  const catalog = await fetchShopifyCatalog({ limit: 60 });
  const products = catalog.products || [];

  return NextResponse.json({
    configured: catalog.configured,
    source: catalog.source,
    store_url: catalog.storeUrl,
    warning: catalog.warning || null,
    summary: buildCatalogSummary(products),
    categories: buildCategoryCards(products),
    featured_products: products.slice(0, 12),
  });
}