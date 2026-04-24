"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useResellerCart } from "@/lib/use-reseller-cart";

/* eslint-disable @next/next/no-img-element */

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

function buildPlaceholder(productType) {
  const label = String(productType || "NCT").split(" ")[0] || "NCT";
  return (
    <div className="w-full h-full bg-gradient-to-br from-nct-navy via-blue-700 to-nct-gold text-white flex items-center justify-center text-xl font-bold tracking-wide">
      {label.slice(0, 3).toUpperCase()}
    </div>
  );
}

export default function ResellerStoreClient({ initialReseller }) {
  const [catalogData, setCatalogData] = useState(null);
  const [ordersData, setOrdersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const resellerId = initialReseller?.id || "guest";
  const { cart, itemCount, addItem } = useResellerCart(resellerId);

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
        setCatalogError(error.message || "Failed to load the reseller store.");
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
  const categories = useMemo(() => {
    const base = [{ slug: "all", title: "All categories" }];
    return base.concat((catalogData?.categories || []).map((category) => ({ slug: category.slug, title: category.title })));
  }, [catalogData]);

  const productLookup = useMemo(() => {
    const lookup = new Map();
    for (const product of products) {
      lookup.set(product.id, product);
    }
    return lookup;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = selectedCategory === "all" || product.productType?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") === selectedCategory;
      const haystack = [product.title, product.vendor, product.productType, product.category, ...(product.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !needle || haystack.includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategory]);

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

  const cartSubtotal = cartDetails.reduce((sum, item) => sum + ((item.variant?.price || 0) * item.quantity), 0);
  const checkoutSupported = Boolean(catalogData?.checkout_supported);

  function openProduct(product) {
    setSelectedProduct(product);
    setSelectedVariantId(String(product.variants?.[0]?.legacyId || ""));
  }

  function addToCart(product, variant) {
    if (!variant?.legacyId || !checkoutSupported) return;
    addItem(product.id, variant.legacyId);
  }

  const selectedVariant = selectedProduct?.variants?.find((variant) => String(variant.legacyId || "") === String(selectedVariantId || "")) || selectedProduct?.variants?.[0] || null;

  if (loading) {
    return <p className="text-sm text-gray-400 py-6">Loading reseller store…</p>;
  }

  if (catalogError) {
    return <p className="text-sm text-red-500 py-6">{catalogError}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Protected Reseller Store</p>
            <h2 className="text-3xl font-bold text-nct-navy">Browse, build your cart, and checkout without leaving the portal</h2>
            <p className="text-sm text-gray-600 mt-2 max-w-3xl">
              Shopify manages the underlying catalog and inventory quantities. Your reseller account stays in the NCT portal while orders are created directly in Shopify behind the scenes.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-[320px]">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-400">Products</p>
              <p className="text-xl font-bold text-nct-navy">{catalogData?.summary?.totalProducts || 0}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-400">Cart</p>
              <p className="text-xl font-bold text-nct-navy">{itemCount}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-400">Paid Orders</p>
              <p className="text-xl font-bold text-nct-navy">{ordersData?.summary?.paid || 0}</p>
            </div>
          </div>
        </div>

        {catalogData?.warning && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{catalogData.warning}</p>
        )}
        {!checkoutSupported && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            Checkout is disabled until live Shopify inventory is available. You can still review the catalog layout here.
          </p>
        )}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_220px] gap-4 mb-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products, vendors, categories"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
              />
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white"
              >
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>{category.title}</option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-500">{filteredProducts.length} matching products</p>
          </div>

          <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const defaultVariant = product.variants?.[0] || null;
              const inventoryLabel = product.inventory > 0 ? `${product.inventory} in stock` : "Inventory pending";

              return (
                <div key={product.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
                  <div className="h-48 bg-gray-100 overflow-hidden">
                    {product.image?.url ? (
                      <img src={product.image.url} alt={product.image.altText || product.title} className="w-full h-full object-cover" />
                    ) : buildPlaceholder(product.productType)}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">{product.productType}</p>
                        <h3 className="font-semibold text-gray-900 leading-snug">{product.title}</h3>
                      </div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{product.vendor}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">{product.description || product.category}</p>
                    <div className="mt-auto space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-nct-gold">{formatCurrency(product.price, product.currencyCode)}</p>
                        <p className="text-xs font-medium text-gray-500">{inventoryLabel}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openProduct(product)} className="flex-1 border border-nct-navy text-nct-navy hover:bg-nct-navy hover:text-white font-medium px-4 py-2.5 rounded-xl transition-colors text-sm">
                          View details
                        </button>
                        <button
                          onClick={() => addToCart(product, defaultVariant)}
                          disabled={!checkoutSupported || !defaultVariant?.legacyId}
                          className="flex-1 bg-nct-navy hover:bg-nct-navy-dark text-white font-medium px-4 py-2.5 rounded-xl transition-colors text-sm disabled:opacity-40"
                        >
                          Add to cart
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5 xl:sticky xl:top-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-nct-navy">Cart</p>
                <p className="text-xs text-gray-500">Stored in this browser for {initialReseller?.business_name || initialReseller?.full_name || "your reseller account"}.</p>
              </div>
              <span className="text-sm font-semibold text-gray-500">{itemCount} items</span>
            </div>

            {cartDetails.length === 0 ? (
              <p className="text-sm text-gray-500">Your cart is empty. Add products from the catalog, then open the cart page to review and checkout.</p>
            ) : (
              <div className="space-y-3">
                {cartDetails.slice(0, 3).map((item) => (
                  <div key={`${item.productId}-${item.variantLegacyId}`} className="border border-gray-200 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.product.title}</p>
                        <p className="text-xs text-gray-500">{item.variant.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatCurrency(item.variant.price, item.product.currencyCode)}</p>
                      </div>
                      <span className="text-sm font-semibold text-nct-navy">x{item.quantity}</span>
                    </div>
                  </div>
                ))}
                {cartDetails.length > 3 && (
                  <p className="text-xs text-gray-500">+{cartDetails.length - 3} more item{cartDetails.length - 3 === 1 ? "" : "s"} in cart</p>
                )}

                <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cartSubtotal, cartDetails[0]?.product?.currencyCode || "USD")}</span>
                </div>
                <Link
                  href="/reseller/store/cart"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-nct-gold px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-nct-gold-dark"
                >
                  Review Cart & Checkout
                </Link>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-nct-navy mb-4">Order history</p>
            <div className="space-y-3">
              {(ordersData?.orders || []).slice(0, 6).map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{order.name}</p>
                      <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatCurrency(order.totalPrice, order.currencyCode)}</p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{order.financialStatus.replace(/_/g, " ")}</span>
                  </div>
                  {order.orderStatusUrl && (
                    <a href={order.orderStatusUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-xs text-nct-navy underline mt-2">
                      View status ↗
                    </a>
                  )}
                </div>
              ))}
              {(!ordersData?.orders || ordersData.orders.length === 0) && (
                <p className="text-sm text-gray-500">Orders will appear here once you create and complete Shopify checkouts.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 px-4 py-6 overflow-y-auto" onClick={() => setSelectedProduct(null)}>
          <div className="max-w-4xl mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="grid lg:grid-cols-[420px_minmax(0,1fr)]">
              <div className="bg-gray-100 min-h-[320px]">
                {selectedProduct.image?.url ? (
                  <img src={selectedProduct.image.url} alt={selectedProduct.image.altText || selectedProduct.title} className="w-full h-full object-cover" />
                ) : buildPlaceholder(selectedProduct.productType)}
              </div>
              <div className="p-6 lg:p-8 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">{selectedProduct.productType} • {selectedProduct.vendor}</p>
                    <h3 className="text-2xl font-bold text-nct-navy mt-1">{selectedProduct.title}</h3>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">{selectedProduct.description || "Product details will sync in from Shopify as descriptions are added."}</p>

                {selectedProduct.variants?.length > 1 && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Variant</label>
                    <select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white">
                      {selectedProduct.variants.map((variant) => (
                        <option key={variant.id} value={variant.legacyId || ""}>{variant.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Price</p>
                    <p className="text-lg font-bold text-nct-gold">{formatCurrency(selectedVariant?.price ?? selectedProduct.price, selectedProduct.currencyCode)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Inventory</p>
                    <p className="text-lg font-bold text-nct-navy">{selectedVariant?.inventory ?? selectedProduct.inventory}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Category</p>
                    <p className="text-sm font-bold text-nct-navy">{selectedProduct.category}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => addToCart(selectedProduct, selectedVariant)}
                    disabled={!checkoutSupported || !selectedVariant?.legacyId}
                    className="flex-1 bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-40"
                  >
                    Add to cart
                  </button>
                  <button onClick={() => setSelectedProduct(null)} className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-3 rounded-xl transition-colors">
                    Continue browsing
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
