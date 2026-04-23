import { createServiceClient } from "@/lib/supabase";
import { buildCatalogSummary, buildCategoryCards, STORE_OPERATIONS_NOTES } from "@/lib/store-catalog";
import { fetchShopifyCatalog } from "@/lib/shopify";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const catalog = await fetchShopifyCatalog({ limit: 60 });
  const products = catalog.products || [];

  const [{ count: futureDaysCount }, { count: futureBookingsCount }] = await Promise.all([
    db.from("shopping_days").select("id", { count: "exact", head: true }).gte("shopping_date", today),
    db.from("shopping_bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
  ]);

  return NextResponse.json({
    configured: catalog.configured,
    source: catalog.source,
    store_url: catalog.storeUrl,
    warning: catalog.warning || null,
    summary: buildCatalogSummary(products),
    categories: buildCategoryCards(products),
    featured_products: products.slice(0, 8),
    operations_notes: STORE_OPERATIONS_NOTES,
    required_env: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_ACCESS_TOKEN", "NEXT_PUBLIC_SHOPIFY_STORE_URL"],
    legacy_archive: {
      future_shopping_days: futureDaysCount || 0,
      confirmed_bookings: futureBookingsCount || 0,
    },
  });
}