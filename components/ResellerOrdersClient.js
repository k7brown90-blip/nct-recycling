"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function formatCurrency(value, currencyCode = "USD") {
  if (typeof value !== "number") return "Pricing sync pending";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value) {
  if (!value) return "Pending";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ResellerOrdersClient({ initialReseller }) {
  const [ordersData, setOrdersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      const response = await fetch("/api/reseller/orders", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to load orders.");
      }

      return json;
    }

    loadOrders()
      .then((json) => {
        if (!active) return;
        setOrdersData(json);
        setOrdersError("");
      })
      .catch((error) => {
        if (!active) return;
        setOrdersError(error.message || "Failed to load reseller orders.");
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

  const orders = useMemo(() => ordersData?.orders || [], [ordersData]);
  const activeOrders = useMemo(() => {
    return orders.filter((order) => {
      const financialStatus = String(order.financialStatus || "").toLowerCase();
      return financialStatus === "awaiting_payment" || financialStatus === "pending";
    });
  }, [orders]);
  const completedOrders = useMemo(() => {
    return orders.filter((order) => {
      const financialStatus = String(order.financialStatus || "").toLowerCase();
      return financialStatus !== "awaiting_payment" && financialStatus !== "pending";
    });
  }, [orders]);

  if (loading) {
    return <p className="text-sm text-gray-400 py-6">Loading order history…</p>;
  }

  if (ordersError) {
    return <p className="text-sm text-red-500 py-6">{ordersError}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Reseller Orders</p>
            <h2 className="text-3xl font-bold text-nct-navy">View pending and completed portal orders in one place</h2>
            <p className="text-sm text-gray-600 mt-2 max-w-3xl">
              Active checkouts stay visible here until they are paid, canceled, or time out. Your shopping and cart pages no longer keep order history pinned on screen.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/reseller/store" className="inline-flex items-center justify-center rounded-xl border border-nct-navy px-4 py-2.5 text-sm font-semibold text-nct-navy transition-colors hover:bg-nct-navy hover:text-white">
              Back to Store
            </Link>
            <Link href="/reseller/store/cart" className="inline-flex items-center justify-center rounded-xl bg-nct-gold px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-nct-gold-dark">
              Open Cart
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mt-6">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">Total Orders</p>
            <p className="text-xl font-bold text-nct-navy">{ordersData?.summary?.total_orders || 0}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">Awaiting Payment</p>
            <p className="text-xl font-bold text-amber-700">{ordersData?.summary?.awaiting_payment || 0}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-400">Paid</p>
            <p className="text-xl font-bold text-nct-navy">{ordersData?.summary?.paid || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-lg font-bold text-nct-navy">Active checkouts</p>
              <p className="text-sm text-gray-500">Pending orders still waiting on payment.</p>
            </div>
            <Link href="/reseller/store/cart" className="text-sm font-semibold text-nct-navy underline">
              Manage in cart
            </Link>
          </div>

          <div className="space-y-3">
            {activeOrders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{order.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(order.createdAt)}</p>
                    <p className="text-sm text-gray-500 mt-1">{formatCurrency(order.totalPrice, order.currencyCode)}</p>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 capitalize">
                    {order.financialStatus.replace(/_/g, " ")}
                  </span>
                </div>
                {order.orderStatusUrl && (
                  <a href={order.orderStatusUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm text-nct-navy underline mt-3">
                    Continue checkout ↗
                  </a>
                )}
              </div>
            ))}
            {activeOrders.length === 0 && <p className="text-sm text-gray-500">No pending reseller checkouts.</p>}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="mb-4">
            <p className="text-lg font-bold text-nct-navy">Completed orders</p>
            <p className="text-sm text-gray-500">Paid and finalized portal orders for {initialReseller?.business_name || initialReseller?.full_name || "your reseller account"}.</p>
          </div>

          <div className="space-y-3">
            {completedOrders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{order.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(order.createdAt)}</p>
                    <p className="text-sm text-gray-500 mt-1">{formatCurrency(order.totalPrice, order.currencyCode)}</p>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
                    {order.financialStatus.replace(/_/g, " ")}
                  </span>
                </div>
                {order.orderStatusUrl && (
                  <a href={order.orderStatusUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm text-nct-navy underline mt-3">
                    View status ↗
                  </a>
                )}
              </div>
            ))}
            {completedOrders.length === 0 && <p className="text-sm text-gray-500">Paid orders will appear here after checkout is completed.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}