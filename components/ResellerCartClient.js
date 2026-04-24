"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useResellerCart } from "@/lib/use-reseller-cart";

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

export default function ResellerCartClient({ initialReseller }) {
  const [catalogData, setCatalogData] = useState(null);
  const [ordersData, setOrdersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [checkoutNote, setCheckoutNote] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const resellerId = initialReseller?.id || "guest";
  const { cart, itemCount, updateQuantity, removeItem, clearCart } = useResellerCart(resellerId);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/reseller/catalog").then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Failed to load catalog.");
        return json;
      }),
      fetch("/api/reseller/orders").then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Failed to load orders.");
        return json;
      }),
    ])
      .then(([catalogJson, ordersJson]) => {
        if (!active) return;
        setCatalogData(catalogJson);
        setOrdersData(ordersJson);
        setCatalogError("");
      })
      .catch((error) => {
        if (!active) return;
        setCatalogError(error.message || "Failed to load the reseller cart.");
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

  const products = useMemo(() => catalogData?.products || [], [catalogData]);

  const productLookup = useMemo(() => {
    const lookup = new Map();
    for (const product of products) {
      lookup.set(product.id, product);
    }
    return lookup;
  }, [products]);

  const cartDetails = useMemo(() => {
    return cart.map((item) => {
      const product = productLookup.get(item.productId);
      const variant = product?.variants?.find((entry) => String(entry.legacyId || "") === String(item.variantLegacyId || "")) || null;
      return {
        ...item,
        product,
        variant,
      };
    }).filter((item) => item.product && item.variant);
  }, [cart, productLookup]);

  const pendingCheckout = useMemo(() => {
    return (ordersData?.orders || []).find((order) => {
      const financialStatus = String(order.financialStatus || "").toLowerCase();
      return order.orderStatusUrl && (financialStatus === "awaiting_payment" || financialStatus === "pending");
    }) || null;
  }, [ordersData]);

  const cartSubtotal = cartDetails.reduce((sum, item) => sum + ((item.variant?.price || 0) * item.quantity), 0);
  const checkoutSupported = Boolean(catalogData?.checkout_supported);

  async function handleCheckout() {
    if (cartDetails.length === 0 || !checkoutSupported) return;

    setCheckoutBusy(true);
    setCheckoutError("");
    setCheckoutResult(null);

    const response = await fetch("/api/reseller/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cartDetails.map((item) => ({
          productId: item.productId,
          variantLegacyId: item.variantLegacyId,
          quantity: item.quantity,
        })),
        note: checkoutNote,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      setCheckoutError(json.error || "Checkout failed.");
      setCheckoutBusy(false);
      return;
    }

    const createdOrder = json.order || null;
    clearCart();
    setCheckoutNote("");

    if (createdOrder?.invoice_url) {
      window.location.assign(createdOrder.invoice_url);
      return;
    }

    setCheckoutResult(createdOrder);
    setCheckoutBusy(false);

    try {
      const refreshedOrders = await fetch("/api/reseller/orders").then((result) => result.json());
      setOrdersData(refreshedOrders);
    } catch {}
  }

  if (loading) {
    return <p className="text-sm text-gray-400 py-6">Loading cart…</p>;
  }

  if (catalogError) {
    return <p className="text-sm text-red-500 py-6">{catalogError}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Protected Reseller Cart</p>
            <h2 className="text-3xl font-bold text-nct-navy">Review your cart before sending the order to Shopify</h2>
            <p className="text-sm text-gray-600 mt-2 max-w-3xl">
              You can adjust quantities, remove items, and add an order note here. NCT creates the Shopify draft order from this page, and only the final payment step leaves the portal.
            </p>
          </div>
          <Link
            href="/reseller/store"
            className="inline-flex items-center justify-center rounded-xl border border-nct-navy px-4 py-2.5 text-sm font-semibold text-nct-navy transition-colors hover:bg-nct-navy hover:text-white"
          >
            Continue Shopping
          </Link>
        </div>

        {!checkoutSupported && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            Checkout is disabled until live Shopify inventory is available. You can still review your saved cart here.
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-lg font-bold text-nct-navy">Cart Items</p>
              <p className="text-sm text-gray-500">Stored in this browser for {initialReseller?.business_name || initialReseller?.full_name || "your reseller account"}.</p>
            </div>
            <span className="text-sm font-semibold text-gray-500">{itemCount} items</span>
          </div>

          {cartDetails.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
              <p className="text-lg font-semibold text-nct-navy">Your cart is empty.</p>
              <p className="text-sm text-gray-500 mt-2">
                {pendingCheckout
                  ? "Your browser cart has been cleared, but you still have an unpaid Shopify checkout below that you can reopen and finish."
                  : "Browse the protected reseller catalog to add curated lots and bring them back here for checkout."}
              </p>
              <Link
                href="/reseller/store"
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-nct-navy px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-nct-navy-dark"
              >
                Browse Catalog
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {cartDetails.map((item) => (
                <div key={`${item.productId}-${item.variantLegacyId}`} className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{item.product.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.variant.title} • {item.product.vendor}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatCurrency(item.variant.price, item.product.currencyCode)} each</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 rounded-full border border-gray-300 px-2 py-1">
                        <button onClick={() => updateQuantity(item.productId, item.variantLegacyId, item.quantity - 1)} className="h-7 w-7 rounded-full text-gray-600 hover:bg-gray-100">-</button>
                        <span className="w-6 text-center text-sm font-semibold text-nct-navy">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, item.variantLegacyId, item.quantity + 1)} className="h-7 w-7 rounded-full text-gray-600 hover:bg-gray-100">+</button>
                      </div>
                      <p className="min-w-[96px] text-right text-sm font-semibold text-nct-gold">
                        {formatCurrency((item.variant.price || 0) * item.quantity, item.product.currencyCode)}
                      </p>
                      <button onClick={() => removeItem(item.productId, item.variantLegacyId)} className="text-xs font-semibold text-red-600 underline hover:text-red-700">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5 xl:sticky xl:top-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-nct-navy mb-4">Checkout Review</p>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>Items</span>
                <span className="font-semibold text-gray-900">{itemCount}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{formatCurrency(cartSubtotal, cartDetails[0]?.product?.currencyCode || "USD")}</span>
              </div>
            </div>

            <textarea
              value={checkoutNote}
              onChange={(event) => setCheckoutNote(event.target.value)}
              rows={4}
              placeholder="Optional order note for NCT"
              className="mt-4 w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
            />

            {checkoutError && <p className="mt-4 text-sm text-red-500">{checkoutError}</p>}
            {checkoutResult && (
              <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-2">
                <p className="font-semibold">{checkoutResult.name} created successfully.</p>
                <p>Your order was created from the NCT portal. The only remaining step is secure payment.</p>
                {checkoutResult.invoice_url && (
                  <a href={checkoutResult.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex text-nct-navy underline font-semibold">
                    Continue to secure payment ↗
                  </a>
                )}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={checkoutBusy || cartDetails.length === 0 || !checkoutSupported}
              className="mt-4 w-full bg-nct-gold hover:bg-nct-gold-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-40"
            >
              {checkoutBusy ? "Creating your order…" : "Create Order In Portal"}
            </button>
          </div>

          {pendingCheckout && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-nct-navy">Pending Checkout</p>
                  <p className="text-xs text-gray-500 mt-1">{pendingCheckout.name} created {formatDate(pendingCheckout.createdAt)}</p>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-white text-amber-700 border border-amber-200 capitalize">
                  {pendingCheckout.financialStatus.replace(/_/g, " ")}
                </span>
              </div>

              {pendingCheckout.items?.length > 0 && (
                <div className="mt-4 space-y-2">
                  {pendingCheckout.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 border border-amber-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.variantTitle ? `${item.variantTitle} • ` : ""}Qty {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-nct-gold">{formatCurrency((item.price || 0) * item.quantity, pendingCheckout.currencyCode)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-600">
                  Total <span className="font-semibold text-gray-900">{formatCurrency(pendingCheckout.totalPrice, pendingCheckout.currencyCode)}</span>
                </p>
                <a
                  href={pendingCheckout.orderStatusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-nct-gold px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-nct-gold-dark"
                >
                  Continue Checkout
                </a>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-nct-navy mb-4">Recent Orders</p>
            <div className="space-y-3">
              {(ordersData?.orders || []).slice(0, 5).map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{order.name}</p>
                      <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{order.financialStatus.replace(/_/g, " ")}</span>
                  </div>
                  {order.orderStatusUrl && (
                    <a href={order.orderStatusUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-xs text-nct-navy underline mt-2">
                      {order.invoiceUrl || order.financialStatus === "awaiting_payment" ? "Continue checkout ↗" : "View status ↗"}
                    </a>
                  )}
                </div>
              ))}
              {(!ordersData?.orders || ordersData.orders.length === 0) && (
                <p className="text-sm text-gray-500">Orders will appear here once you create and complete portal orders.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}