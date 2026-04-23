import Link from "next/link";
import { getShopifyConnectionStatus } from "@/lib/shopify-app";

function getStatusCopy(status, message) {
  if (status === "connected") {
    return {
      title: "Shopify Connected",
      tone: "text-green-700 bg-green-50 border-green-200",
      message: message || "The Shopify app is installed and the NCT portal can now use the offline Admin API token.",
    };
  }

  if (status === "error") {
    return {
      title: "Connection Failed",
      tone: "text-red-700 bg-red-50 border-red-200",
      message: message || "The Shopify app could not finish installation.",
    };
  }

  return {
    title: "Shopify App",
    tone: "text-blue-700 bg-blue-50 border-blue-200",
    message: message || "Use the NCT admin portal to verify the current Shopify connection status.",
  };
}

export default async function ShopifyAppPage({ searchParams }) {
  const params = await searchParams;
  const status = String(params?.status || "ready");
  const message = String(params?.message || "");
  const shop = String(params?.shop || "");
  const connection = await getShopifyConnectionStatus();
  const copy = getStatusCopy(status, message);

  return (
    <section className="bg-slate-950 text-white min-h-[70vh] py-16 px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">NCT Recycling</p>
          <h1 className="text-4xl font-bold mt-3">Wholesale Shopify Connection</h1>
          <p className="text-slate-300 mt-3 max-w-2xl">
            This app only exists to authorize the NCT portal against Shopify. Resellers still shop through the NCT portal with the existing single-login experience.
          </p>
        </div>

        <div className={`border rounded-2xl p-5 ${copy.tone}`}>
          <p className="text-sm font-semibold uppercase tracking-wide">{copy.title}</p>
          <p className="mt-2 text-sm leading-6">{copy.message}</p>
          {shop ? <p className="mt-2 text-xs">Store: {shop}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm font-semibold text-slate-100">Connection Status</p>
            <dl className="mt-4 space-y-3 text-sm text-slate-300">
              <div>
                <dt className="text-slate-500">Connected</dt>
                <dd>{connection.connected ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Store</dt>
                <dd>{connection.store_domain || "Not configured"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Token Source</dt>
                <dd>{connection.token_source || "Pending"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Updated</dt>
                <dd>{connection.updated_at ? new Date(connection.updated_at).toLocaleString() : "Not installed"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm font-semibold text-slate-100">Required Scopes</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {connection.scopes.map((scope) => (
                <li key={scope}>{scope}</li>
              ))}
            </ul>
            {connection.storage_error ? (
              <p className="mt-4 text-xs text-amber-300">Storage error: {connection.storage_error}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {connection.install_url ? (
            <a href={connection.install_url} className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200 transition-colors">
              Re-run Shopify Install
            </a>
          ) : null}
          <Link href="/admin" className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 transition-colors">
            Return to Admin Portal
          </Link>
        </div>
      </div>
    </section>
  );
}