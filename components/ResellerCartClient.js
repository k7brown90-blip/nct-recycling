"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function formatTimeRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  const [cancelBusy, setCancelBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const resellerId = initialReseller?.id || "guest";
  const { cart, itemCount, pendingDraft, updateQuantity, removeItem, clearCart, setPendingDraft, clearPendingDraft } = useResellerCart(resellerId);

  const loadResellerData = useCallback(async () => {
    const [catalogResponse, ordersResponse] = await Promise.all([
      fetch("/api/reseller/catalog", { cache: "no-store" }),
      fetch("/api/reseller/orders", { cache: "no-store" }),
    ]);

    const catalogJson = await catalogResponse.json();
    if (!catalogResponse.ok) {
      throw new Error(catalogJson.error || "Failed to load catalog.");
    }

    const ordersJson = await ordersResponse.json();
    if (!ordersResponse.ok) {
      throw new Error(ordersJson.error || "Failed to load orders.");
    }

    return { catalogJson, ordersJson };
  }, []);

  useEffect(() => {
    let active = true;

    loadResellerData()
      .then(({ catalogJson, ordersJson }) => {
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
  }, [loadResellerData]);

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
  const pendingCheckoutRemainingMs = useMemo(() => {
    if (!pendingCheckout?.expiresAt) return 0;
    return Math.max(0, new Date(pendingCheckout.expiresAt).getTime() - nowMs);
  }, [nowMs, pendingCheckout]);

  useEffect(() => {
    if (!pendingCheckout?.expiresAt) return undefined;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pendingCheckout?.expiresAt]);

  useEffect(() => {
    if (!pendingDraft?.draftId) return undefined;

    let active = true;

    async function refreshPendingDraftStatus() {
      const response = await fetch(`/api/reseller/orders/${pendingDraft.draftId}`, { cache: "no-store" });

      if (!active) return;

      if (response.status === 404) {
        clearPendingDraft();
        const refreshed = await loadResellerData().catch(() => null);
        if (refreshed) {
          setCatalogData(refreshed.catalogJson);
          setOrdersData(refreshed.ordersJson);
        }
        return;
      }

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        return;
      }

      if (json.order?.financialStatus === "paid") {
        clearCart();
        clearPendingDraft();
        setCheckoutResult({ name: json.order.name, purchased: true });
        const refreshed = await loadResellerData().catch(() => null);
        if (refreshed) {
          setCatalogData(refreshed.catalogJson);
          setOrdersData(refreshed.ordersJson);
        }
      }
    }

    refreshPendingDraftStatus().catch(() => {});
    const intervalId = window.setInterval(() => {
      refreshPendingDraftStatus().catch(() => {});
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [clearCart, clearPendingDraft, loadResellerData, pendingDraft?.draftId]);

  async function handleCancelPendingCheckout() {
    if (!pendingCheckout?.legacyId) return;

    setCancelBusy(true);
    setCheckoutError("");

    const response = await fetch(`/api/reseller/orders/${pendingCheckout.legacyId}`, {
      method: "DELETE",
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setCheckoutError(json.error || "Unable to cancel the pending checkout.");
      setCancelBusy(false);
      return;
    }

    clearPendingDraft();
    const refreshed = await loadResellerData().catch(() => null);
    if (refreshed) {
      setCatalogData(refreshed.catalogJson);
      setOrdersData(refreshed.ordersJson);
    }
    setCancelBusy(false);
  }

  async function handleCheckout() {
    if (cartDetails.length === 0 || !checkoutSupported || pendingCheckout) return;

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
    setPendingDraft({ draftId: createdOrder?.id, createdAt: createdOrder?.created_at });
    setCheckoutNote("");
    setCheckoutBusy(false);

    const refreshed = await loadResellerData().catch(() => null);
    if (refreshed) {
      setCatalogData(refreshed.catalogJson);
      setOrdersData(refreshed.ordersJson);
    }

    if (createdOrder?.invoice_url) {
      window.location.assign(createdOrder.invoice_url);
      return;
    }

    setCheckoutResult(createdOrder);
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
                        <button disabled={Boolean(pendingCheckout)} onClick={() => updateQuantity(item.productId, item.variantLegacyId, item.quantity - 1)} className="h-7 w-7 rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-40">-</button>
                        <span className="w-6 text-center text-sm font-semibold text-nct-navy">{item.quantity}</span>
                        <button disabled={Boolean(pendingCheckout)} onClick={() => updateQuantity(item.productId, item.variantLegacyId, item.quantity + 1)} className="h-7 w-7 rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-40">+</button>
                      </div>
                      <p className="min-w-[96px] text-right text-sm font-semibold text-nct-gold">
                        {formatCurrency((item.variant.price || 0) * item.quantity, item.product.currencyCode)}
                      </p>
                      <button disabled={Boolean(pendingCheckout)} onClick={() => removeItem(item.productId, item.variantLegacyId)} className="text-xs font-semibold text-red-600 underline hover:text-red-700 disabled:opacity-40">
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
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-sm font-semibold text-nct-navy">Checkout Review</p>
              <Link href="/reseller/store/orders" className="text-sm font-semibold text-nct-navy underline">
                Order History
              </Link>
            </div>

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
                <p className="font-semibold">{checkoutResult.name} {checkoutResult.purchased ? "was paid successfully." : "created successfully."}</p>
                <p>{checkoutResult.purchased ? "Your reseller cart has been cleared because Shopify confirmed payment for this checkout." : "Your order was created from the NCT portal. The only remaining step is secure payment."}</p>
                {!checkoutResult.purchased && checkoutResult.invoice_url && (
                  <a href={checkoutResult.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex text-nct-navy underline font-semibold">
                    Continue to secure payment ↗
                  </a>
                )}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={checkoutBusy || cartDetails.length === 0 || !checkoutSupported || Boolean(pendingCheckout)}
              className="mt-4 w-full bg-nct-gold hover:bg-nct-gold-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-40"
            >
              {checkoutBusy ? "Creating your order…" : pendingCheckout ? "Finish or Cancel Existing Checkout" : "Create Order In Portal"}
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

              <p className="mt-3 text-xs text-amber-800">
                Inventory is reserved for this checkout for <strong>{formatTimeRemaining(pendingCheckoutRemainingMs)}</strong>. If payment is not completed in time, the order will be canceled automatically.
              </p>

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
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelPendingCheckout}
                    disabled={cancelBusy}
                    className="inline-flex items-center justify-center rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40"
                  >
                    {cancelBusy ? "Canceling…" : "Cancel Order"}
                  </button>
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
            </div>
          )}

        </div>
      </div>
    </div>
  );
}