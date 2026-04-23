import { getSeededStoreProducts } from "@/lib/store-catalog";

const SHOPIFY_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || "2025-10";
const SHOPIFY_CURRENCY = process.env.SHOPIFY_STORE_CURRENCY || "USD";

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapShopifyImage(image) {
  if (!image?.src) return null;
  return {
    id: image.id ? `gid://shopify/ProductImage/${image.id}` : image.src,
    url: image.src,
    altText: image.alt || null,
  };
}

function mapShopifyVariant(variant) {
  return {
    id: `gid://shopify/ProductVariant/${variant.id}`,
    legacyId: String(variant.id),
    title: variant.title || "Default",
    sku: variant.sku || null,
    price: toNumber(variant.price),
    compareAtPrice: toNumber(variant.compare_at_price),
    inventory: Number(variant.inventory_quantity || 0),
    availableForSale: variant.inventory_quantity == null ? true : Number(variant.inventory_quantity) > 0,
    selectedOptions: [variant.option1, variant.option2, variant.option3]
      .filter(Boolean)
      .map((value, index) => ({ name: `Option ${index + 1}`, value })),
  };
}

function mapShopifyProduct(product, storeDomain) {
  const variants = (product.variants || []).map((variant) => mapShopifyVariant(variant));
  const image = mapShopifyImage(product.image);
  const images = (product.images || []).map((item) => mapShopifyImage(item)).filter(Boolean);
  const pricedVariants = variants.filter((variant) => typeof variant.price === "number");
  const minPrice = pricedVariants.length > 0 ? Math.min(...pricedVariants.map((variant) => variant.price)) : null;
  const compareAtPrice = pricedVariants.length > 0
    ? Math.max(...pricedVariants.map((variant) => variant.compareAtPrice || variant.price || 0))
    : null;
  const inventory = variants.reduce((sum, variant) => sum + Number(variant.inventory || 0), 0);

  return {
    id: `gid://shopify/Product/${product.id}`,
    legacyId: String(product.id),
    title: product.title,
    handle: product.handle,
    status: String(product.status || "active").toLowerCase(),
    inventory,
    category: product.product_type || "Uncategorized",
    productType: product.product_type || "Uncategorized",
    vendor: product.vendor || "Mixed",
    previewUrl: product.handle ? `https://${storeDomain}/products/${product.handle}` : null,
    description: stripHtml(product.body_html),
    descriptionHtml: product.body_html || "",
    image,
    images,
    options: [product.options?.[0], product.options?.[1], product.options?.[2]]
      .filter(Boolean)
      .map((option) => ({ name: option.name, values: option.values || [] })),
    variants,
    price: minPrice,
    compareAtPrice,
    currencyCode: SHOPIFY_CURRENCY,
    availableForSale: variants.some((variant) => variant.availableForSale),
    inventoryTracked: true,
    tags: Array.isArray(product.tags) ? product.tags : String(product.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
  };
}

export function getShopifyStoreUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  if (process.env.SHOPIFY_STORE_DOMAIN) {
    return `https://${process.env.SHOPIFY_STORE_DOMAIN}`;
  }

  return null;
}

function getShopifyAdminConfig() {
  return {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
    adminToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  };
}

async function shopifyAdminRequest(path, options = {}) {
  const { storeDomain, adminToken } = getShopifyAdminConfig();

  if (!storeDomain || !adminToken) {
    throw new Error("Shopify credentials are not configured in the deployment environment.");
  }

  const response = await fetch(`https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: options.cache || "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Shopify request failed (${response.status}): ${payload}`);
  }

  return response.json();
}

export async function fetchShopifyCatalog(options = {}) {
  const limit = options.limit || 50;
  const { storeDomain, adminToken } = getShopifyAdminConfig();
  const storeUrl = getShopifyStoreUrl();

  if (!storeDomain || !adminToken) {
    return {
      configured: false,
      source: "seed",
      storeUrl,
      products: getSeededStoreProducts(),
      warning: "Shopify credentials are not configured in the deployment environment.",
    };
  }

  try {
    const payload = await shopifyAdminRequest(`/products.json?status=active&limit=${limit}&fields=id,title,body_html,vendor,product_type,handle,status,tags,options,variants,image,images`);
    const products = (payload?.products || []).map((product) => mapShopifyProduct(product, storeDomain));

    return {
      configured: true,
      source: "shopify",
      storeUrl,
      products: products.length > 0 ? products : getSeededStoreProducts(),
      warning: products.length > 0 ? null : "Shopify returned no active products; showing seeded catalog.",
    };
  } catch (error) {
    console.error("Shopify catalog load error:", error);

    return {
      configured: true,
      source: "seed",
      storeUrl,
      products: getSeededStoreProducts(),
      warning: "Shopify sync failed; showing seeded catalog instead.",
    };
  }
}

export async function createShopifyDraftOrder({ reseller, items, note }) {
  const payload = await shopifyAdminRequest("/draft_orders.json", {
    method: "POST",
    body: {
      draft_order: {
        email: reseller.email,
        note: note || null,
        tags: ["nct-reseller-portal", reseller.program_type || "reseller"].filter(Boolean).join(", "),
        line_items: items.map((item) => ({
          variant_id: Number(item.variantLegacyId),
          quantity: Number(item.quantity),
        })),
        billing_address: {
          first_name: reseller.full_name?.split(" ")?.[0] || reseller.business_name || "Reseller",
          last_name: reseller.full_name?.split(" ")?.slice(1).join(" ") || reseller.business_name || "Account",
          company: reseller.business_name || null,
          phone: reseller.phone || null,
        },
      },
    },
  });

  return payload?.draft_order || null;
}

function mapShopifyOrder(order) {
  return {
    id: `gid://shopify/Order/${order.id}`,
    legacyId: String(order.id),
    name: order.name,
    createdAt: order.created_at,
    financialStatus: order.financial_status || "pending",
    fulfillmentStatus: order.fulfillment_status || "unfulfilled",
    totalPrice: toNumber(order.current_total_price),
    currencyCode: order.currency || SHOPIFY_CURRENCY,
    orderStatusUrl: order.order_status_url || null,
    invoiceUrl: null,
    source: "order",
    items: (order.line_items || []).map((line) => ({
      id: line.id ? String(line.id) : `${order.id}-${line.title}`,
      title: line.title,
      quantity: Number(line.quantity || 0),
      price: toNumber(line.price),
      sku: line.sku || null,
      variantTitle: line.variant_title || null,
    })),
  };
}

function mapShopifyDraftOrder(order) {
  return {
    id: `gid://shopify/DraftOrder/${order.id}`,
    legacyId: String(order.id),
    name: order.name || `Draft #${order.id}`,
    createdAt: order.created_at,
    financialStatus: order.status === "completed" ? "paid" : "awaiting_payment",
    fulfillmentStatus: "draft",
    totalPrice: toNumber(order.total_price),
    currencyCode: order.currency || SHOPIFY_CURRENCY,
    orderStatusUrl: order.invoice_url || null,
    invoiceUrl: order.invoice_url || null,
    source: "draft",
    items: (order.line_items || []).map((line) => ({
      id: line.id ? String(line.id) : `${order.id}-${line.title}`,
      title: line.title,
      quantity: Number(line.quantity || 0),
      price: toNumber(line.price),
      sku: line.sku || null,
      variantTitle: line.variant_title || null,
    })),
  };
}

export async function fetchShopifyOrderHistoryByEmail({ email, limit = 20 }) {
  const [ordersPayload, draftsPayload] = await Promise.all([
    shopifyAdminRequest(`/orders.json?status=any&limit=${limit}&fields=id,name,email,created_at,financial_status,fulfillment_status,current_total_price,currency,order_status_url,line_items`),
    shopifyAdminRequest(`/draft_orders.json?status=open&limit=${limit}&fields=id,name,email,invoice_url,created_at,status,total_price,currency,line_items`),
  ]);

  const normalizedEmail = String(email || "").toLowerCase();

  const orders = (ordersPayload?.orders || [])
    .filter((order) => String(order.email || "").toLowerCase() === normalizedEmail)
    .map((order) => mapShopifyOrder(order));

  const drafts = (draftsPayload?.draft_orders || [])
    .filter((order) => String(order.email || "").toLowerCase() === normalizedEmail)
    .map((order) => mapShopifyDraftOrder(order));

  return [...drafts, ...orders]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}