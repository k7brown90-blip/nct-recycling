"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function formatTimeRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildPlaceholder(productType) {
  const label = String(productType || "NCT").split(" ")[0] || "NCT";
  return (
    <div className="w-full h-full bg-gradient-to-br from-nct-navy via-blue-700 to-nct-gold text-white flex items-center justify-center text-xl font-bold tracking-wide">
      {label.slice(0, 3).toUpperCase()}
    </div>
  );
}

function getProductImages(product) {
  const imageCandidates = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : product?.image
      ? [product.image]
      : [];

  const seenUrls = new Set();

  return imageCandidates.filter((image) => {
    if (!image?.url || seenUrls.has(image.url)) return false;
    seenUrls.add(image.url);
    return true;
  });
}

function normalizeImageIndex(index, imageCount) {
  if (imageCount <= 0) return 0;
  return (index + imageCount) % imageCount;
}

function GalleryArrowButton({ direction, onClick, className = "" }) {
  const isPrevious = direction === "previous";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrevious ? "Previous photo" : "Next photo"}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/90 text-2xl font-light text-nct-navy shadow-sm transition-colors hover:bg-white ${className}`}
    >
      {isPrevious ? "‹" : "›"}
    </button>
  );
}

export default function ResellerStoreClient({ initialReseller }) {
  const [catalogData, setCatalogData] = useState(null);
  const [ordersData, setOrdersData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cardImageIndexes, setCardImageIndexes] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const resellerId = initialReseller?.id || "guest";
  const { cart, itemCount, pendingDraft, addItem, clearCart, clearPendingDraft } = useResellerCart(resellerId);

  const loadStoreData = useCallback(async () => {
    const [catalogResponse, ordersResponse] = await Promise.all([
      fetch("/api/reseller/catalog", { cache: "no-store" }),
      fetch("/api/reseller/orders", { cache: "no-store" }),
    ]);

    const catalogJson = await catalogResponse.json();
    if (!catalogResponse.ok) throw new Error(catalogJson.error || "Failed to load catalog.");

    const ordersJson = await ordersResponse.json();
    if (!ordersResponse.ok) throw new Error(ordersJson.error || "Failed to load orders.");

    return { catalogJson, ordersJson };
  }, []);

  useEffect(() => {
    let active = true;

    loadStoreData()
      .then(({ catalogJson, ordersJson }) => {
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
  }, [loadStoreData]);

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
  const pendingCheckout = useMemo(() => {
    return (ordersData?.orders || []).find((order) => {
      const financialStatus = String(order.financialStatus || "").toLowerCase();
      return order.orderStatusUrl && (financialStatus === "awaiting_payment" || financialStatus === "pending");
    }) || null;
  }, [ordersData]);
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
        const refreshed = await loadStoreData().catch(() => null);
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
        const refreshed = await loadStoreData().catch(() => null);
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
  }, [clearCart, clearPendingDraft, loadStoreData, pendingDraft?.draftId]);

  function openProduct(product) {
    setSelectedProduct(product);
    setSelectedVariantId(String(product.variants?.[0]?.legacyId || ""));
    setSelectedImageUrl(getProductImages(product)[0]?.url || "");
  }

  function shiftCardImage(productId, imageCount, direction) {
    if (imageCount <= 1) return;

    setCardImageIndexes((current) => ({
      ...current,
      [productId]: normalizeImageIndex((current[productId] ?? 0) + direction, imageCount),
    }));
  }

  function shiftSelectedModalImage(direction) {
    if (selectedProductImages.length <= 1) return;

    const currentIndex = selectedProductImages.findIndex((image) => image.url === selectedImageUrl);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = normalizeImageIndex(safeIndex + direction, selectedProductImages.length);
    setSelectedImageUrl(selectedProductImages[nextIndex]?.url || "");
  }

  function addToCart(product, variant) {
    if (!variant?.legacyId || !checkoutSupported || pendingCheckout) return;
    addItem(product.id, variant.legacyId);
  }

  const selectedVariant = selectedProduct?.variants?.find((variant) => String(variant.legacyId || "") === String(selectedVariantId || "")) || selectedProduct?.variants?.[0] || null;
  const selectedProductImages = getProductImages(selectedProduct);
  const selectedModalImageIndex = (() => {
    const currentIndex = selectedProductImages.findIndex((image) => image.url === selectedImageUrl);
    return currentIndex >= 0 ? currentIndex : 0;
  })();
  const selectedModalImage = !selectedProduct
    ? null
    : selectedProductImages.find((image) => image.url === selectedImageUrl) || selectedProductImages[0] || selectedProduct.image || null;

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
              const inventoryLabel = product.inventory > 0 ? `${product.inventory} in stock` : "Reserved / out of stock";
              const productImages = getProductImages(product);
              const activeImageIndex = normalizeImageIndex(cardImageIndexes[product.id] ?? 0, productImages.length || 1);
              const activeImage = productImages[activeImageIndex] || product.image || null;
              const hasMultipleImages = productImages.length > 1;

              return (
                <div key={product.id} className="grid h-[520px] grid-rows-[7fr_3fr] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-gray-100 to-white p-4">
                    <div className="flex h-full items-center justify-center overflow-hidden rounded-2xl bg-gray-100 px-4 py-3">
                      {activeImage?.url ? (
                        <img src={activeImage.url} alt={activeImage.altText || product.title} className="max-h-full max-w-full object-contain" />
                      ) : buildPlaceholder(product.productType)}
                    </div>

                    {hasMultipleImages && (
                      <>
                        <GalleryArrowButton
                          direction="previous"
                          onClick={(event) => {
                            event.stopPropagation();
                            shiftCardImage(product.id, productImages.length, -1);
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2"
                        />
                        <GalleryArrowButton
                          direction="next"
                          onClick={(event) => {
                            event.stopPropagation();
                            shiftCardImage(product.id, productImages.length, 1);
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                        />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-nct-navy shadow-sm">
                          {activeImageIndex + 1} / {productImages.length}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="grid h-full grid-rows-[auto_1fr_auto] gap-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{product.productType}</p>
                        <h3 className="mt-1 text-xl font-bold leading-tight text-nct-navy">{product.title}</h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{product.vendor}</span>
                    </div>

                    <div className="min-h-0 space-y-3 overflow-hidden">
                      <p className="max-h-[4.75rem] overflow-hidden text-sm leading-6 text-gray-500">{product.description || product.category}</p>
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-400">
                        <span>{hasMultipleImages ? `${productImages.length} photos` : "Single photo"}</span>
                        <span>{product.category}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-end justify-between gap-3">
                        <p className="text-lg font-bold text-nct-gold">{formatCurrency(product.price, product.currencyCode)}</p>
                        <p className="text-right text-xs font-medium text-gray-500">{inventoryLabel}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openProduct(product)} className="flex-1 rounded-xl border border-nct-navy px-4 py-2.5 text-sm font-medium text-nct-navy transition-colors hover:bg-nct-navy hover:text-white">
                          View details
                        </button>
                        <button
                          onClick={() => addToCart(product, defaultVariant)}
                          disabled={!checkoutSupported || !defaultVariant?.legacyId || Number(product.inventory || 0) <= 0 || Boolean(pendingCheckout)}
                          className="flex-1 rounded-xl bg-nct-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-nct-navy-dark disabled:opacity-40"
                        >
                          {pendingCheckout ? "Pending Checkout Active" : "Add to cart"}
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
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  {pendingCheckout
                    ? "Your cart items are reserved in a pending checkout. Open the cart page to finish or cancel it before creating a new order."
                    : "Your cart is empty. Add products from the catalog, then open the cart page to review and checkout."}
                </p>
                {pendingCheckout && (
                  <p className="text-xs text-amber-700">Reservation expires in {formatTimeRemaining(pendingCheckoutRemainingMs)}.</p>
                )}
              </div>
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
                {pendingCheckout && (
                  <p className="text-xs text-amber-700">This cart is reserved in Shopify for {formatTimeRemaining(pendingCheckoutRemainingMs)}.</p>
                )}
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
            <p className="text-sm font-semibold text-nct-navy mb-2">Order History</p>
            <p className="text-sm text-gray-500">
              Pending and completed orders now live on a separate page so the store stays focused on shopping.
            </p>
            <Link
              href="/reseller/store/orders"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-nct-navy px-5 py-3 text-sm font-semibold text-nct-navy transition-colors hover:bg-nct-navy hover:text-white"
            >
              Open Order History
            </Link>
          </div>
        </div>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 px-4 py-6 overflow-y-auto" onClick={() => setSelectedProduct(null)}>
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-col lg:h-[88vh] lg:max-h-[920px]">
              <div className="relative flex min-h-[420px] flex-[7] items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-gray-100 to-white p-5 lg:p-8">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.75rem] bg-gray-100 px-4 py-4 lg:px-8">
                    {selectedModalImage?.url ? (
                      <img src={selectedModalImage.url} alt={selectedModalImage.altText || selectedProduct.title} className="max-w-full max-h-[70vh] w-auto h-auto object-contain" />
                    ) : buildPlaceholder(selectedProduct.productType)}
                </div>

                {selectedProductImages.length > 1 && (
                  <>
                    <GalleryArrowButton
                      direction="previous"
                      onClick={() => shiftSelectedModalImage(-1)}
                      className="absolute left-5 top-1/2 -translate-y-1/2 lg:left-8"
                    />
                    <GalleryArrowButton
                      direction="next"
                      onClick={() => shiftSelectedModalImage(1)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 lg:right-8"
                    />
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/92 px-4 py-1.5 text-sm font-semibold text-nct-navy shadow-sm">
                      {selectedModalImageIndex + 1} / {selectedProductImages.length}
                    </div>
                  </>
                )}

                <button onClick={() => setSelectedProduct(null)} className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl text-gray-500 shadow-sm transition-colors hover:bg-white hover:text-gray-700 lg:right-8 lg:top-8">×</button>
              </div>
              <div className="flex flex-[3] flex-col gap-5 border-t border-gray-200 p-6 lg:overflow-y-auto lg:px-8 lg:py-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{selectedProduct.productType} • {selectedProduct.vendor}</p>
                    <h3 className="mt-2 text-3xl font-bold leading-tight text-nct-navy">{selectedProduct.title}</h3>
                    {selectedProductImages.length > 1 && (
                      <p className="mt-2 text-sm text-gray-500">{selectedProductImages.length} Shopify photos synced to this item.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 lg:min-w-[360px]">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Price</p>
                      <p className="mt-1 text-xl font-bold text-nct-gold">{formatCurrency(selectedVariant?.price ?? selectedProduct.price, selectedProduct.currencyCode)}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Inventory</p>
                      <p className="mt-1 text-xl font-bold text-nct-navy">{selectedVariant?.inventory ?? selectedProduct.inventory}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Category</p>
                      <p className="mt-1 text-sm font-bold text-nct-navy">{selectedProduct.category}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                  <div className="space-y-5">
                    <p className="text-sm leading-7 text-gray-600">{selectedProduct.description || "Product details will sync in from Shopify as descriptions are added."}</p>

                    {selectedProduct.variants?.length > 1 && (
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Variant</label>
                        <select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm">
                          {selectedProduct.variants.map((variant) => (
                            <option key={variant.id} value={variant.legacyId || ""}>{variant.title}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Current image</span>
                        <span className="font-semibold text-nct-navy">
                          {selectedProductImages.length > 0 ? `${selectedModalImageIndex + 1} of ${selectedProductImages.length}` : "No photos"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Availability</span>
                        <span className="font-semibold text-nct-navy">{Number(selectedVariant?.inventory ?? selectedProduct.inventory ?? 0) > 0 ? "Ready to add" : "Unavailable"}</span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <button
                        onClick={() => addToCart(selectedProduct, selectedVariant)}
                        disabled={!checkoutSupported || !selectedVariant?.legacyId || Number(selectedVariant?.inventory ?? selectedProduct.inventory ?? 0) <= 0 || Boolean(pendingCheckout)}
                        className="w-full rounded-xl bg-nct-navy py-3 text-base font-bold text-white transition-colors hover:bg-nct-navy-dark disabled:opacity-40"
                      >
                        {pendingCheckout ? "Pending Checkout Active" : "Add to cart"}
                      </button>
                      <button onClick={() => setSelectedProduct(null)} className="w-full rounded-xl border border-gray-300 py-3 text-base font-bold text-gray-700 transition-colors hover:bg-gray-50">
                        Continue browsing
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
