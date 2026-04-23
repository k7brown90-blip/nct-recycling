import { NextResponse } from "next/server";
import { buildShopifyInstallUrl, createShopifyOauthState, getShopifyOAuthConfig, validateShopDomain } from "@/lib/shopify-app";

const STATE_COOKIE = "nct_shopify_oauth_state";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const config = getShopifyOAuthConfig();
  const requestedShop = String(requestUrl.searchParams.get("shop") || config.storeDomain || "").trim().toLowerCase();

  if (!config.apiKey || !config.apiSecret) {
    return NextResponse.json({ error: "Shopify app credentials are not configured." }, { status: 503 });
  }

  if (!validateShopDomain(requestedShop)) {
    return NextResponse.json({ error: "A valid SHOPIFY_STORE_DOMAIN is required before Shopify can install the app." }, { status: 400 });
  }

  const state = createShopifyOauthState();
  const authorizeUrl = new URL(`https://${requestedShop}/admin/oauth/authorize`);
  authorizeUrl.searchParams.set("client_id", config.apiKey);
  authorizeUrl.searchParams.set("scope", config.scopes.join(","));
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUrl);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: buildShopifyInstallUrl(requestedShop).startsWith("https://"),
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}