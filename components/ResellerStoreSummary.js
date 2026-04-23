"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatCurrency(value, currencyCode = "USD") {
  if (typeof value !== "number") return "Pricing sync pending";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ResellerStoreSummary() {
  const [catalog, setCatalog] = useState(null);
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/reseller/catalog").then((response) => response.json()),
      fetch("/api/reseller/orders").then((response) => response.json()),
    ])
      .then(([catalogJson, ordersJson]) => {
        if (!active) return;
        setCatalog(catalogJson);
        setOrders(ordersJson);
      })
      .catch(() => {
        if (!active) return;
        setCatalog(null);
        setOrders(null);
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
    return <p className="text-sm text-gray-400 py-4">Loading store summary…</p>;
  }

  if (!catalog || catalog.error) {
    return <p className="text-sm text-red-500 py-4">Unable to load the reseller store summary right now.</p>;
  }

  const featured = catalog.featured_products || [];
  const latestOrder = orders?.orders?.[0] || null;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Reseller Store</p>
            <h2 className="text-2xl font-bold text-nct-navy">Account overview with live inventory</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Your dashboard stays focused on account status and recent activity. Use the full store for browsing, cart management, and checkout.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/reseller/store" className="inline-flex items-center justify-center bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-5 py-3 rounded-xl transition-colors">
              Open Full Store
            </Link>
            <a href="#order-history" className="inline-flex items-center justify-center border border-nct-navy text-nct-navy hover:bg-nct-navy hover:text-white font-semibold px-5 py-3 rounded-xl transition-colors">
              Recent Orders
            </a>
          </div>
        </div>

        {catalog.warning && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{catalog.warning}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 uppercase tracking-wide">Products</p>
            <p className="text-xl font-bold text-nct-navy">{catalog.summary?.totalProducts || 0}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 uppercase tracking-wide">In Stock</p>
            <p className="text-xl font-bold text-nct-navy">{catalog.summary?.inStockProducts || 0}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 uppercase tracking-wide">Awaiting Payment</p>
            <p className="text-xl font-bold text-nct-navy">{orders?.summary?.awaiting_payment || 0}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 uppercase tracking-wide">Paid Orders</p>
            <p className="text-xl font-bold text-nct-navy">{orders?.summary?.paid || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-semibold text-nct-navy">Featured inventory</p>
              <p className="text-sm text-gray-500">A quick look at current lots before you open the full store.</p>
            </div>
            <Link href="/reseller/store" className="text-sm text-nct-navy underline">Browse all</Link>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {featured.slice(0, 3).map((product) => (
              <div key={product.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-sm font-semibold text-gray-900 mb-1">{product.title}</p>
                <p className="text-xs text-gray-500">{product.productType} • {product.vendor}</p>
                <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                <p className="text-sm font-semibold text-nct-gold mt-3">{formatCurrency(product.price, product.currencyCode)}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="order-history" className="bg-white border border-gray-200 rounded-2xl p-6">
          <p className="text-sm font-semibold text-nct-navy mb-3">Latest order</p>
          {latestOrder ? (
            <div className="space-y-2 text-sm text-gray-600">
              <p className="font-semibold text-gray-900">{latestOrder.name}</p>
              <p>Status: {latestOrder.financialStatus.replace(/_/g, " ")}</p>
              <p>Total: {formatCurrency(latestOrder.totalPrice, latestOrder.currencyCode)}</p>
              {latestOrder.orderStatusUrl && (
                <a href={latestOrder.orderStatusUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-nct-navy underline">
                  View status ↗
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No reseller orders yet. Start in the full store when you are ready to purchase.</p>
          )}
        </div>
      </div>
    </div>
  );
}
