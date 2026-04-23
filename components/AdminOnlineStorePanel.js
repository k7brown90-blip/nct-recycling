"use client";
import { useEffect, useState } from "react";

export default function AdminOnlineStorePanel({ authHeader }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/online-store", { headers: authHeader })
      .then(async (response) => {
        const json = await response.json();
        if (active) {
          setData(json);
        }
      })
      .catch(() => {
        if (active) {
          setData(null);
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
  }, [authHeader]);

  if (loading) {
    return <p className="text-sm text-gray-400 py-4">Loading online store overview…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-500 py-4">Failed to load the online store overview.</p>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Online Store</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${data.source === "shopify" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {data.source === "shopify" ? "Live Shopify Sync" : "Seed Preview"}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-nct-navy">Storefront Operations Overview</h2>
          <p className="text-sm text-gray-600 mt-1 max-w-3xl">
            Shopping-day scheduling is being retired in favor of curated Shopify drops. Route inventory is now sorted on site and published as wholesale-ready lots.
          </p>
        </div>
        {data.store_url ? (
          <a href={data.store_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-4 py-2.5 rounded-xl transition-colors">
            Open Shopify Store ↗
          </a>
        ) : (
          <div className="text-sm text-gray-500 bg-gray-100 rounded-xl px-4 py-3">Set `NEXT_PUBLIC_SHOPIFY_STORE_URL` to publish the storefront link.</div>
        )}
      </div>

      {data.warning && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{data.warning}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Products</p>
          <p className="text-xl font-bold text-nct-navy">{data.summary?.totalProducts || 0}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wide">In Stock</p>
          <p className="text-xl font-bold text-nct-navy">{data.summary?.inStockProducts || 0}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Legacy Days</p>
          <p className="text-xl font-bold text-nct-navy">{data.legacy_archive?.future_shopping_days || 0}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Legacy Bookings</p>
          <p className="text-xl font-bold text-nct-navy">{data.legacy_archive?.confirmed_bookings || 0}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-nct-navy mb-2">Operational Changes</p>
          <ul className="text-sm text-gray-700 space-y-1.5">
            {(data.operations_notes || []).map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-nct-navy mb-2">Deployment Configuration</p>
          <ul className="text-sm text-gray-700 space-y-1.5">
            {(data.required_env || []).map((key) => (
              <li key={key}>• {key}</li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-3">The Shopify API secret should live only in deployment env vars and should be rotated if it has been shared outside the host settings.</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-nct-navy mb-3">Primary Sorting Categories</p>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(data.categories || []).slice(0, 9).map((category) => (
            <div key={category.slug} className="border border-gray-200 rounded-xl p-4 bg-white">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-semibold text-gray-900">{category.title}</p>
                <span className="text-xs text-gray-500">{category.productCount}</span>
              </div>
              <p className="text-xs text-gray-500">{category.categories.slice(0, 3).join(" • ") || "Mixed assortments"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}