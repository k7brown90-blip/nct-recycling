import { getSeededStoreProducts } from "@/lib/store-catalog";
import { SHOPIFY_API_VERSION, getShopifyPublicStoreUrl, resolveShopifyAdminConfig } from "@/lib/shopify-app";

const SHOPIFY_CURRENCY = process.env.SHOPIFY_STORE_CURRENCY || "USD";

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildShopifyFailure(storeUrl, warning, detail, code = "shopify_sync_failed") {
  return {
    configured: true,
    source: "seed",
    storeUrl,
    products: getSeededStoreProducts(),
    warning,
    syncErrorCode: code,
    syncErrorDetail: detail || null,
  };
}

function classifyShopifySyncError(error) {
  const detail = String(error?.message || "Unknown Shopify sync error.");

  if (detail.includes("401")) {
    return {
      warning: "Shopify rejected the admin access token. Confirm SHOPIFY_ADMIN_ACCESS_TOKEN is the Admin API token for the custom app.",
      code: "unauthorized",
      detail,
    };
  }

  if (detail.includes("403")) {
    return {
      warning: "Shopify denied the catalog request. Confirm the custom app has read_products scope and reinstall it after scope changes.",
      code: "forbidden",
      detail,
    };
  }

  if (detail.includes("404")) {
    return {
      warning: "Shopify could not find the requested admin endpoint. Confirm SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_VERSION are correct.",
      code: "not_found",
      detail,
    };
  }

  return {
    warning: "Shopify sync failed; showing seeded catalog instead.",
    code: "shopify_sync_failed",
    detail,
  };
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

async function shopifyAdminRequest(path, options = {}) {
  const { storeDomain, adminToken, storageError } = await resolveShopifyAdminConfig();

  if (!storeDomain || !adminToken) {
    throw new Error(storageError || "Shopify credentials are not configured in the deployment environment.");
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
  const { storeDomain, adminToken, storageError, installation } = await resolveShopifyAdminConfig();
  const storeUrl = getShopifyPublicStoreUrl() || installation?.storefront_url || (storeDomain ? `https://${storeDomain}` : null);

  if (!storeDomain || !adminToken) {
    return {
      configured: false,
      source: "seed",
      storeUrl,
      products: getSeededStoreProducts(),
      warning: storageError
        ? "Shopify is not ready because the installation record could not be loaded. Run the SQL migration and reconnect Shopify."
        : "Shopify credentials are not configured in the deployment environment.",
      syncErrorCode: "missing_credentials",
      syncErrorDetail: storageError || "Set SHOPIFY_STORE_DOMAIN, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and complete the Shopify install flow (or provide the legacy SHOPIFY_ADMIN_ACCESS_TOKEN).",
    };
  }

  if (String(adminToken).startsWith("shpss_")) {
    return buildShopifyFailure(
      storeUrl,
      "SHOPIFY_ADMIN_ACCESS_TOKEN appears to be the app secret, not the Admin API access token. Use the Admin API token from the Shopify custom app instead.",
      "The configured token starts with shpss_, which is not the expected Admin API access token format for Shopify admin requests.",
      "invalid_token_type"
    );
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
      syncErrorCode: products.length > 0 ? null : "empty_catalog",
      syncErrorDetail: products.length > 0 ? null : "Shopify returned a successful response but no active products.",
    };
  } catch (error) {
    console.error("Shopify catalog load error:", error);

    const failure = classifyShopifySyncError(error);
    return buildShopifyFailure(storeUrl, failure.warning, failure.detail, failure.code);
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