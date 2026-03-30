import Link from "next/link";

export const metadata = {
  title: "Shop — Boutique, Bins & Wholesale",
  description:
    "Three ways to shop at NCT Emporium in Fort Collins: curated thrift boutique (Mon–Thu 12–8PM), $2/lb pound bins (Tue–Thu + Sunday), and bulk raw weight bags for wholesale buyers.",
};

export default function ShopPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-nct-navy mb-4 text-center">How to Shop at NCT Emporium</h1>
      <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
        We have three ways to buy — from curated boutique pieces to bulk bags for high-volume
        resellers. All inventory comes from our nonprofit co-op donation network.
      </p>

      {/* Hours callout */}
      <div className="bg-nct-navy text-white rounded-xl p-6 mb-16">
        <h2 className="text-xl font-bold mb-4 text-center">Store Hours</h2>
        <div className="grid sm:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-nct-gold font-bold mb-2 uppercase tracking-wide text-xs">Boutique (Open to Everyone)</p>
            <p className="text-gray-200">Monday–Thursday &nbsp;|&nbsp; 12PM–8PM</p>
            <p className="text-gray-400 text-xs mt-1">Monday = boutique only (no bins)</p>
          </div>
          <div>
            <p className="text-nct-gold font-bold mb-2 uppercase tracking-wide text-xs">Pound Bins — $2.00/lb</p>
            <p className="text-gray-200">Tuesday–Thursday &nbsp;|&nbsp; 12PM–4PM</p>
            <p className="text-gray-400 text-xs mt-0.5">Reseller access (portal scheduling required)</p>
            <p className="text-gray-200 mt-1">Tuesday–Thursday &nbsp;|&nbsp; 4PM–8PM</p>
            <p className="text-gray-400 text-xs mt-0.5">Open to the public</p>
          </div>
          <div>
            <p className="text-nct-gold font-bold mb-2 uppercase tracking-wide text-xs">Sunday Bin Sale (Open to Everyone)</p>
            <p className="text-gray-200">Sunday &nbsp;|&nbsp; 12PM–4PM</p>
            <p className="text-gray-400 text-xs mt-1">No reseller account required · $2.00/lb</p>
          </div>
          <div>
            <p className="text-nct-gold font-bold mb-2 uppercase tracking-wide text-xs">Closed</p>
            <p className="text-gray-200">Friday &amp; Saturday</p>
          </div>
        </div>
        <p className="text-sm mt-5 text-center text-gray-300">
          6108 South College Ave STE C, Fort Collins CO 80525 &nbsp;·&nbsp;{" "}
          <a href="tel:+19702329108" className="text-nct-gold hover:underline">(970) 232-9108</a>
        </p>
      </div>

      {/* Tier 1: Boutique */}
      <section id="boutique" className="mb-20 scroll-mt-24">
        <div className="border-l-4 border-nct-gold pl-6">
          <h2 className="text-3xl font-bold text-nct-navy mb-2">Curated Boutique</h2>
          <p className="text-2xl font-bold text-nct-gold mb-4">Retail Pricing</p>
        </div>
        <div className="mt-6 grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-gray-700 leading-relaxed mb-4">
              Our boutique is a hand-curated selection of quality pieces pulled from incoming
              donations. Items are organized by category — women's, men's, kids', denim,
              outerwear, and accessories — and priced individually at retail thrift prices.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you're looking for specific pieces, unique finds, or want a traditional
              thrift shopping experience, the boutique is your starting point. Open every day
              we're open — no appointment needed.
            </p>
            <h3 className="font-bold text-nct-navy mb-2">What you'll find:</h3>
            <ul className="text-gray-600 text-sm space-y-1 list-disc list-inside">
              <li>Women's, men's, and kids' clothing</li>
              <li>Denim — jeans, jackets, and more</li>
              <li>Outerwear and winter gear</li>
              <li>Shoes, belts, hats, and scarves</li>
              <li>Freshly rotated inventory</li>
            </ul>
          </div>
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-bold text-nct-navy mb-3">Boutique Details</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Hours</span> Monday–Thursday, 12PM–8PM</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Note</span> Monday is boutique only — no bins available</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Pricing</span> Individual retail thrift prices per item</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Payment</span> Cash and card accepted</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Who</span> Casual shoppers, fashion resellers, anyone</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Tier 2: Bins */}
      <section id="bins" className="mb-20 scroll-mt-24">
        <div className="border-l-4 border-blue-400 pl-6">
          <h2 className="text-3xl font-bold text-nct-navy mb-2">Pound Bins</h2>
          <p className="text-2xl font-bold text-nct-gold mb-4">$2.00 / lb</p>
        </div>
        <div className="mt-6 grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-gray-700 leading-relaxed mb-4">
              Our pound bins are filled with rotating inventory including vintage, Y2K, and
              branded clothing and shoes. Fill your bag, weigh it at checkout, and pay $2 per pound.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Reseller partners get the first window (12–4PM, Tue–Thu) with freshly organized bins
              before they open to the public at 4PM. Sunday is open to everyone — no account needed.
            </p>
            <h3 className="font-bold text-nct-navy mb-2">Pro reseller tips:</h3>
            <ul className="text-gray-600 text-sm space-y-1 list-disc list-inside">
              <li>Book your slot through the portal for best access (Tue–Thu 12–4PM)</li>
              <li>Bins are freshly set and organized for the reseller window</li>
              <li>Bring reusable bags or boxes</li>
              <li>Categories rotate — denim, outerwear, and branded items are common</li>
              <li>No limit on quantity</li>
            </ul>
          </div>
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-bold text-nct-navy mb-3">Bin Details</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Price</span> $2.00 per pound</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Reseller Hours</span> Tue–Thu, 12PM–4PM (portal required)</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Public Hours</span> Tue–Thu, 4PM–8PM &amp; Sunday 12PM–4PM</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Payment</span> Cash and card accepted</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Who</span> Thrifters, resellers, eBay/Poshmark sellers</li>
            </ul>
            <Link
              href="/apply"
              className="mt-5 inline-block bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-4 py-2 rounded text-sm transition-colors"
            >
              Apply for Reseller Access →
            </Link>
          </div>
        </div>
      </section>

      {/* Tier 3: Raw Weight Bags */}
      <section id="rawbags" className="mb-20 scroll-mt-24">
        <div className="border-l-4 border-green-400 pl-6">
          <h2 className="text-3xl font-bold text-nct-navy mb-2">Raw Weight Bags</h2>
          <p className="text-2xl font-bold text-nct-gold mb-4">$0.30 / lb — Wholesale / Bulk</p>
        </div>
        <div className="mt-6 grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-gray-700 leading-relaxed mb-4">
              Raw weight bags are sold in bulk, sight-unseen, by weight. These are unsorted
              bags straight from intake — you're buying the weight, not a curated selection.
              Perfect for high-volume buyers who want to do their own sorting.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              This tier is ideal for small thrift stores restocking shelves, volume resellers
              who prefer sorting their own hauls, and exporters. Colorado wholesale tax
              exemption (Form DR 0563) is accepted — see our{" "}
              <Link href="/wholesale" className="text-nct-gold hover:underline font-medium">
                Wholesale Buyers page
              </Link>{" "}
              for details.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-bold text-nct-navy mb-3">Raw Bag Details</h3>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Price</span> $0.30 per pound</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Contents</span> Unsorted, sight-unseen — mixed clothing</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Volume</span> Contact us to schedule a bulk pickup</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Tax Exempt</span> CO wholesale exemption accepted</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">Who</span> Thrift stores, volume resellers, exporters</li>
            </ul>
            <Link
              href="/wholesale"
              className="mt-5 inline-block bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-4 py-2 rounded text-sm transition-colors"
            >
              Apply as a Wholesale Buyer →
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <div className="text-center bg-gray-50 rounded-xl p-10">
        <h2 className="text-2xl font-bold text-nct-navy mb-4">Ready to Visit?</h2>
        <p className="text-gray-600 mb-6">
          Boutique open Monday–Thursday 12–8PM. Bins open Tuesday–Thursday (resellers 12–4PM, public 4–8PM) and Sunday 12–4PM.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/contact"
            className="bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-6 py-3 rounded transition-colors"
          >
            Get Directions
          </Link>
          <Link
            href="/wholesale"
            className="border-2 border-nct-navy text-nct-navy hover:bg-nct-navy hover:text-white font-semibold px-6 py-3 rounded transition-colors"
          >
            Wholesale Inquiries
          </Link>
        </div>
      </div>
    </div>
  );
}
