import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase";

export const SHOPIFY_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || "2025-10";

const DEFAULT_SHOPIFY_SCOPES = [
  "read_products",
  "read_orders",
  "read_draft_orders",
  "write_draft_orders",
];
const SHOPIFY_INSTALLATIONS_TABLE = "shopify_app_installations";

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getEnvValue(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return String(value).trim();
  }
  return null;
}

function normalizeScopeList(value) {
  if (!value) return DEFAULT_SHOPIFY_SCOPES;
  const scopes = String(value)
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes.length > 0 ? Array.from(new Set(scopes)) : DEFAULT_SHOPIFY_SCOPES;
}

function buildErrorMessage(prefix, error) {
  const detail = error?.message || error?.details || String(error || "Unknown error.");
  return `${prefix}${detail ? ` ${detail}` : ""}`.trim();
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function getBaseAppUrl() {
  return trimTrailingSlash(
    getEnvValue("NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "APP_URL") || "https://www.nctrecycling.com"
  );
}

export function getShopifyStoreDomain() {
  const value = getEnvValue("SHOPIFY_STORE_DOMAIN");
  return value ? value.toLowerCase() : null;
}

export function getRequiredShopifyScopes() {
  return normalizeScopeList(getEnvValue("SHOPIFY_APP_SCOPES"));
}

export function getShopifyRedirectUrl() {
  return `${getBaseAppUrl()}/api/shopify/callback`;
}

export function getShopifyAppUrl() {
  return `${getBaseAppUrl()}/shopify/app`;
}

export function getShopifyPublicStoreUrl() {
  const explicitUrl = getEnvValue("NEXT_PUBLIC_SHOPIFY_STORE_URL", "SHOPIFY_STORE_URL");
  if (explicitUrl) {
    return explicitUrl;
  }

  const storeDomain = getShopifyStoreDomain();
  return storeDomain ? `https://${storeDomain}` : null;
}

export function getShopifyOAuthConfig() {
  return {
    apiKey: getEnvValue("SHOPIFY_API_KEY", "SHOPIFY_APP_API_KEY"),
    apiSecret: getEnvValue("SHOPIFY_API_SECRET", "SHOPIFY_APP_API_SECRET"),
    storeDomain: getShopifyStoreDomain(),
    scopes: getRequiredShopifyScopes(),
    redirectUrl: getShopifyRedirectUrl(),
    appUrl: getShopifyAppUrl(),
  };
}

export function validateShopDomain(value) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(String(value || "").trim());
}

export function createShopifyOauthState() {
  return crypto.randomBytes(24).toString("hex");
}

export function buildShopifyInstallUrl(shop) {
  const installUrl = new URL(`${getBaseAppUrl()}/api/shopify/install`);
  const resolvedShop = shop || getShopifyStoreDomain();

  if (resolvedShop) {
    installUrl.searchParams.set("shop", resolvedShop);
  }

  return installUrl.toString();
}

export function verifyShopifyCallbackHmac(searchParams) {
  const { apiSecret } = getShopifyOAuthConfig();
  const providedHmac = searchParams.get("hmac");

  if (!apiSecret || !providedHmac) {
    return false;
  }

  const message = Array.from(searchParams.entries())
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = crypto.createHmac("sha256", apiSecret).update(message).digest("hex");
  return timingSafeEqual(digest, providedHmac);
}

export async function exchangeShopifyOfflineToken({ shop, code }) {
  const { apiKey, apiSecret } = getShopifyOAuthConfig();

  if (!apiKey || !apiSecret) {
    throw new Error("SHOPIFY_API_KEY and SHOPIFY_API_SECRET must be configured before Shopify can install the app.");
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Shopify token exchange failed (${response.status}): ${payload}`);
  }

  return response.json();
}

export async function fetchShopifyShopProfile({ shop, accessToken }) {
  const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Shopify shop profile request failed (${response.status}): ${payload}`);
  }

  const payload = await response.json();
  return payload?.shop || null;
}

export async function getStoredShopifyInstallation(preferredShopDomain) {
  const db = createServiceClient();
  const shopDomain = preferredShopDomain ? String(preferredShopDomain).toLowerCase() : null;

  let query = db
    .from(SHOPIFY_INSTALLATIONS_TABLE)
    .select("shop_domain, access_token, scope, token_type, store_name, storefront_url, connected_at, updated_at, install_source, last_error");

  if (shopDomain) {
    const { data, error } = await query.eq("shop_domain", shopDomain).maybeSingle();
    if (error) {
      throw new Error(buildErrorMessage("Failed to load the Shopify installation record.", error));
    }
    return data || null;
  }

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(1);
  if (error) {
    throw new Error(buildErrorMessage("Failed to load the Shopify installation record.", error));
  }

  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function saveShopifyInstallation({ shop, accessToken, scope, storeInfo }) {
  const db = createServiceClient();
  const timestamp = new Date().toISOString();
  const payload = {
    shop_domain: String(shop || "").toLowerCase(),
    access_token: accessToken,
    scope: scope || null,
    token_type: "offline",
    store_name: storeInfo?.name || null,
    storefront_url: storeInfo?.primary_domain?.host ? `https://${storeInfo.primary_domain.host}` : null,
    connected_at: timestamp,
    updated_at: timestamp,
    install_source: "oauth",
    last_error: null,
  };

  const { data, error } = await db
    .from(SHOPIFY_INSTALLATIONS_TABLE)
    .upsert(payload, { onConflict: "shop_domain" })
    .select("shop_domain, scope, token_type, store_name, storefront_url, connected_at, updated_at, install_source, last_error")
    .single();

  if (error) {
    throw new Error(buildErrorMessage("Failed to save the Shopify installation record.", error));
  }

  return data;
}

export async function resolveShopifyAdminConfig() {
  const envStoreDomain = getShopifyStoreDomain();
  const envAdminToken = getEnvValue("SHOPIFY_ADMIN_ACCESS_TOKEN");

  if (envStoreDomain && envAdminToken) {
    return {
      storeDomain: envStoreDomain,
      adminToken: envAdminToken,
      source: "environment",
      installation: null,
      storageError: null,
    };
  }

  try {
    const installation = await getStoredShopifyInstallation(envStoreDomain);

    if (envAdminToken && installation?.shop_domain) {
      return {
        storeDomain: installation.shop_domain,
        adminToken: envAdminToken,
        source: "environment",
        installation,
        storageError: null,
      };
    }

    if (installation?.shop_domain && installation?.access_token) {
      return {
        storeDomain: installation.shop_domain,
        adminToken: installation.access_token,
        source: installation.install_source || "oauth",
        installation,
        storageError: null,
      };
    }

    return {
      storeDomain: envStoreDomain,
      adminToken: envAdminToken,
      source: envAdminToken ? "environment" : null,
      installation,
      storageError: null,
    };
  } catch (error) {
    return {
      storeDomain: envStoreDomain,
      adminToken: envAdminToken,
      source: envAdminToken ? "environment" : null,
      installation: null,
      storageError: error?.message || String(error),
    };
  }
}

export async function getShopifyConnectionStatus() {
  const oauth = getShopifyOAuthConfig();
  const resolved = await resolveShopifyAdminConfig();
  const installation = resolved.installation;
  const scopeList = normalizeScopeList(installation?.scope || oauth.scopes.join(","));

  return {
    connected: Boolean(resolved.storeDomain && resolved.adminToken),
    token_source: resolved.source,
    store_domain: resolved.storeDomain || oauth.storeDomain,
    store_name: installation?.store_name || null,
    installed_at: installation?.connected_at || null,
    updated_at: installation?.updated_at || null,
    install_source: installation?.install_source || null,
    scopes: scopeList,
    oauth_ready: Boolean(oauth.apiKey && oauth.apiSecret && oauth.storeDomain),
    storage_error: resolved.storageError || null,
    app_url: oauth.appUrl,
    redirect_url: oauth.redirectUrl,
    install_url: oauth.apiKey && oauth.apiSecret && oauth.storeDomain ? buildShopifyInstallUrl(oauth.storeDomain) : null,
    store_url: getShopifyPublicStoreUrl() || installation?.storefront_url || null,
  };
}