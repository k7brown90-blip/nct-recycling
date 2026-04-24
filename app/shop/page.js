import Link from "next/link";
import OnlineStorePreview from "@/components/OnlineStorePreview";

export const metadata = {
  title: "Shop — Online Store, Boutique & Bins",
  description:
    "Shop NCT through curated Shopify drops, the Fort Collins boutique, and public pound-bin hours.",
};

export default function ShopPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16 space-y-16">
      <section className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-nct-gold mb-3">NCT Emporium</p>
        <h1 className="text-4xl md:text-5xl font-bold text-nct-navy mb-4">Shop Curated Inventory Online First</h1>
        <p className="max-w-3xl mx-auto text-lg text-gray-600 leading-relaxed">
          NCT now sorts route inventory on site and releases curated wholesale and reseller drops through the online store.
          In-person shopping is still available through the boutique and public pound bins, but reseller booking windows are retired.
        </p>
        <p className="max-w-2xl mx-auto text-sm text-gray-500 leading-relaxed mt-4">
          Approved resellers should sign in to shop from the portal. If you are new to NCT, apply first and we will review your account before enabling store access.
        </p>
      </section>

      <OnlineStorePreview variant="public" />

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">How It Works Now</p>
          <h2 className="text-2xl font-bold text-nct-navy mb-3">Online Drops Replace Shopping-Day Scheduling</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Inventory that used to move through route-day reseller openings is now sorted, grouped, and published as curated store drops.
            Shopify becomes the source of truth for availability instead of the old booking calendar.
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">For Resellers</p>
          <h2 className="text-2xl font-bold text-nct-navy mb-3">Browse Faster, Buy Cleaner Lots</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Instead of waiting for an opening notification, resellers can review organized categories, featured lots, and current stock directly online.
            This reduces no-shows and makes inventory access predictable.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">For The Team</p>
          <h2 className="text-2xl font-bold text-nct-navy mb-3">On-Site Sorting, Cleaner Ops</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            The route team no longer needs to coordinate shopping-day openings or reseller alerts. Inventory can be processed on site,
            assigned to a category, and pushed into the storefront workflow.
          </p>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-nct-navy text-white p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-nct-gold mb-2">Visit In Person</p>
          <h2 className="text-3xl font-bold mb-5">Boutique & Public Bins</h2>
          <div className="space-y-4 text-sm text-gray-200">
            <div>
              <p className="font-semibold text-white">Curated Boutique</p>
              <p>Monday-Thursday, 12PM-6PM</p>
              <p className="text-gray-300">Traditional thrift shopping with hand-priced pieces.</p>
            </div>
            <div>
              <p className="font-semibold text-white">Public Pound Bins</p>
              <p>Tuesday-Thursday, 4PM-6PM</p>
              <p className="text-gray-300">Open shopping at $2.00/lb after daytime sorting and processing.</p>
            </div>
            <div>
              <p className="font-semibold text-white">Sunday Bin Sale</p>
              <p>Sunday, 12PM-4PM</p>
              <p className="text-gray-300">Open to everyone. No reseller account or booking required.</p>
            </div>
          </div>
          <p className="text-sm mt-6 text-gray-300">
            6108 South College Ave STE C, Fort Collins CO 80525 · <a href="tel:+19702329108" className="text-nct-gold hover:underline">(970) 232-9108</a>
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Wholesale Access</p>
          <h2 className="text-3xl font-bold text-nct-navy mb-4">Need Bulk Buying Support?</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Wholesale buyers can use the online store for curated drops and still reach out for larger recurring needs.
            The operational model has shifted away from unscheduled route-day shopping windows and toward consistent online inventory release.
          </p>
          <ul className="space-y-3 text-sm text-gray-700 mb-6">
            <li>Curated category drops for common reseller and thrift-store demand.</li>
            <li>Cleaner lot visibility before purchase.</li>
            <li>Direct contact path for recurring or higher-volume accounts.</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/wholesale"
              className="inline-flex items-center justify-center bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              Wholesale Information
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center border-2 border-nct-navy text-nct-navy hover:bg-nct-navy hover:text-white font-semibold px-5 py-3 rounded-xl transition-colors"
            >
              Contact The Store
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
