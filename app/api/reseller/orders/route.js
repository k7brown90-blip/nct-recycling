import { canAccessResellerStore, getCurrentResellerContext } from "@/lib/reseller-auth";
import { fetchShopifyOrderHistoryByEmail } from "@/lib/shopify";
import { NextResponse } from "next/server";

export async function GET() {
  const { user, reseller } = await getCurrentResellerContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!canAccessResellerStore(reseller)) {
    return NextResponse.json({ error: "Approved reseller access is required." }, { status: 403 });
  }

  try {
    const orders = await fetchShopifyOrderHistoryByEmail({ email: reseller.email, limit: 25 });

    return NextResponse.json({
      orders,
      summary: {
        total_orders: orders.length,
        awaiting_payment: orders.filter((order) => order.financialStatus === "awaiting_payment").length,
        paid: orders.filter((order) => order.financialStatus === "paid").length,
      },
    });
  } catch (error) {
    console.error("Reseller order history error:", error);
    return NextResponse.json({ error: "Failed to load reseller order history." }, { status: 500 });
  }
}
