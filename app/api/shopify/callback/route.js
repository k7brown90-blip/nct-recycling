import { NextResponse } from "next/server";
import {
  exchangeShopifyOfflineToken,
  fetchShopifyShopProfile,
  getShopifyAppUrl,
  saveShopifyInstallation,
  validateShopDomain,
  verifyShopifyCallbackHmac,
} from "@/lib/shopify-app";

const STATE_COOKIE = "nct_shopify_oauth_state";

function buildRedirect(status, shop, message) {
  const redirectUrl = new URL(getShopifyAppUrl());
  redirectUrl.searchParams.set("status", status);
  if (shop) {
    redirectUrl.searchParams.set("shop", shop);
  }
  if (message) {
    redirectUrl.searchParams.set("message", message);
  }
  return redirectUrl;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const shop = String(requestUrl.searchParams.get("shop") || "").trim().toLowerCase();
  const state = String(requestUrl.searchParams.get("state") || "").trim();
  const code = String(requestUrl.searchParams.get("code") || "").trim();
  const expectedState = request.cookies.get(STATE_COOKIE)?.value || "";

  if (!validateShopDomain(shop) || !code) {
    return NextResponse.redirect(buildRedirect("error", shop, "Shopify returned an incomplete installation callback."));
  }

  if (!expectedState || !state || expectedState !== state) {
    const response = NextResponse.redirect(buildRedirect("error", shop, "The Shopify installation state did not match. Start the install again from the admin panel."));
    response.cookies.delete(STATE_COOKIE);
    return response;
  }

  if (!verifyShopifyCallbackHmac(requestUrl.searchParams)) {
    const response = NextResponse.redirect(buildRedirect("error", shop, "Shopify callback validation failed. Confirm the app secret matches the released Shopify app."));
    response.cookies.delete(STATE_COOKIE);
    return response;
  }

  try {
    const tokenPayload = await exchangeShopifyOfflineToken({ shop, code });
    const accessToken = tokenPayload?.access_token;

    if (!accessToken) {
      throw new Error("Shopify did not return an offline Admin API access token.");
    }

    const storeInfo = await fetchShopifyShopProfile({ shop, accessToken }).catch(() => null);
    await saveShopifyInstallation({
      shop,
      accessToken,
      scope: tokenPayload?.scope || null,
      storeInfo,
    });

    const response = NextResponse.redirect(buildRedirect("connected", shop, "Shopify connected successfully. The reseller catalog can now sync live inventory."));
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Shopify install callback error:", error);
    const response = NextResponse.redirect(buildRedirect("error", shop, error?.message || "Shopify installation failed."));
    response.cookies.delete(STATE_COOKIE);
    return response;
  }
}