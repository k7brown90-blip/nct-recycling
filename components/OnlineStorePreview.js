"use client";
import { useEffect, useState } from "react";

export default function OnlineStorePreview({ variant = "partner" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/public/storefront")
      .then(async (response) => {
        const json = await response.json();
        if (active) {
          setData(json);
        }
      })
      .catch(() => {
        if (active) {
          setData({
            configured: false,
            source: "seed",
            warning: "Unable to load the storefront preview right now.",
            summary: { totalProducts: 0, activeProducts: 0, inStockProducts: 0, productTypes: 0, vendors: 0 },
            categories: [],
            featured_products: [],
            store_url: null,
          });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-400 py-4">Loading online store preview…</p>;
  }

  const categories = data?.categories || [];
  const featured = data?.featured_products || [];
  const summary = data?.summary || {};
  const compact = variant === "partner";

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border ${compact ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"} p-5`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Online Store</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${data?.source === "shopify" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {data?.source === "shopify" ? "Live Shopify" : "Seed Preview"}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-nct-navy">
              {compact ? "Curated Wholesale Drops" : "Shop The Curated Online Store"}
            </h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Booking-based reseller openings are retired. NCT now sorts route inventory on site and publishes curated wholesale lots online through Shopify.
            </p>
          </div>
          {data?.store_url ? (
            <a
              href={data.store_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              Open Shopify Store ↗
            </a>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-100 rounded-xl px-4 py-3">
              Store URL will appear here after Shopify is configured.
            </div>
          )}
        </div>

        {data?.warning && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{data.warning}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Products</p>
            <p className="text-xl font-bold text-nct-navy">{summary.totalProducts || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">In Stock</p>
            <p className="text-xl font-bold text-nct-navy">{summary.inStockProducts || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Sorting Groups</p>
            <p className="text-xl font-bold text-nct-navy">{summary.productTypes || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Vendors</p>
            <p className="text-xl font-bold text-nct-navy">{summary.vendors || 0}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-nct-navy mb-3">Sorting Categories</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {categories.slice(0, compact ? 6 : 9).map((category) => (
            <div key={category.slug} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-semibold text-nct-navy">{category.title}</p>
                <span className="text-xs text-gray-500">{category.productCount} SKUs</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{category.categories.slice(0, 3).join(" • ") || "Mixed assortments"}</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {category.sampleTitles.slice(0, 2).map((title) => (
                  <li key={title}>• {title}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {!compact && featured.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-nct-navy mb-3">Featured Lots</h3>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {featured.slice(0, 6).map((product) => (
              <div key={product.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="font-semibold text-gray-900 mb-1">{product.title}</p>
                <p className="text-xs text-gray-500">{product.productType} • {product.vendor}</p>
                <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                <p className="text-xs font-semibold mt-3 text-nct-gold">
                  {Number(product.inventory || 0) > 0 ? `${product.inventory} in stock` : "Inventory pending sync"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}