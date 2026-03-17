import Link from "next/link";

export const metadata = {
  title: "Wholesale Buyers — Bulk Clothing Bags, Fort Collins CO",
  description:
    "Buy bulk raw weight clothing bags at $0.30/lb from NCT Recycling in Fort Collins. Sight-unseen mixed clothing for thrift stores, volume resellers, and exporters. Colorado wholesale tax exemption accepted.",
};

const buyerTypes = [
  {
    icon: "🏪",
    title: "Small Thrift Stores",
    desc: "Low-cost bulk inventory to stock your shelves. Sort your own haul and price individually.",
  },
  {
    icon: "📦",
    title: "Volume Resellers",
    desc: "eBay, Poshmark, Depop, and Mercari sellers who buy in bulk and sort for listings.",
  },
  {
    icon: "🌍",
    title: "Exporters",
    desc: "Buyers sourcing mixed clothing for export markets in Africa, South America, or Southeast Asia.",
  },
  {
    icon: "♻️",
    title: "Upcyclers & Makers",
    desc: "Designers and makers sourcing raw fabric and clothing for repurposing or upcycling projects.",
  },
];

export default function WholesalePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-nct-navy mb-4 text-center">Wholesale Buyers</h1>
      <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
        Source bulk mixed clothing from NCT Recycling at $0.30/lb. Raw weight bags sold
        sight-unseen for volume buyers, small thrift stores, and exporters.
      </p>

      {/* Pricing hero */}
      <div className="bg-nct-navy text-white rounded-xl p-10 text-center mb-16">
        <p className="text-6xl font-bold text-nct-gold mb-3">$0.30</p>
        <p className="text-2xl mb-2">per pound</p>
        <p className="text-gray-300 text-sm">Raw weight bags · Bulk · Sight-unseen · Mixed clothing</p>
      </div>

      {/* What are raw bags */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-nct-navy mb-6">What Are Raw Weight Bags?</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="text-gray-700 space-y-4 text-sm leading-relaxed">
            <p>
              Raw weight bags are unsorted bags of clothing sold by weight, exactly as they
              come in from our donation intake. You're buying the weight — not a curated
              selection. Contents are mixed and vary from bag to bag.
            </p>
            <p>
              This is the lowest-cost way to source inventory from NCT. Volume buyers who
              want to do their own sorting — by brand, size, category, or condition — will
              get the most value from this tier.
            </p>
            <p>
              Typical contents include everyday clothing across all categories: men's, women's,
              kids', shoes, outerwear, denim, and accessories. We do not guarantee specific
              contents, brands, or quality levels.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 text-sm space-y-3">
            <h3 className="font-bold text-nct-navy mb-3">Raw Bag Details</h3>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500">Price</span>
              <span className="font-bold text-nct-navy">$0.30 per pound</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500">Contents</span>
              <span className="font-bold text-nct-navy">Mixed — sight unseen</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500">Availability</span>
              <span className="font-bold text-nct-navy">Contact to schedule</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500">Tax Exempt?</span>
              <span className="font-bold text-nct-navy">Yes — CO Form DR 0563</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment</span>
              <span className="font-bold text-nct-navy">Cash or card on site</span>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-nct-navy mb-8 text-center">Who Raw Bags Are For</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {buyerTypes.map((b) => (
            <div key={b.title} className="bg-white border border-gray-200 rounded-xl p-6 flex gap-4 shadow-sm">
              <span className="text-3xl">{b.icon}</span>
              <div>
                <h3 className="font-bold text-nct-navy">{b.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Colorado Tax Exemption */}
      <section className="mb-16 bg-nct-navy/5 border border-nct-navy/20 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-nct-navy mb-4">Colorado Wholesale Tax Exemption</h2>
        <p className="text-gray-700 text-sm leading-relaxed mb-4">
          If you are purchasing clothing for resale, you may qualify for Colorado's wholesale
          sales tax exemption. To purchase exempt from sales tax at NCT Recycling, you will need
          to provide a valid{" "}
          <strong>Colorado Sales Tax Exemption Certificate (Form DR 0563)</strong> or your{" "}
          <strong>Colorado Sales Tax License number</strong>.
        </p>
        <p className="text-gray-700 text-sm leading-relaxed mb-4">
          We keep a copy of your exemption certificate on file. Tax-exempt status must be
          verified before your first purchase and renewed as required by Colorado law.
        </p>
        <p className="text-gray-700 text-sm leading-relaxed">
          Not sure if you qualify? Visit{" "}
          <a
            href="https://tax.colorado.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="text-nct-gold hover:underline font-medium"
          >
            tax.colorado.gov
          </a>{" "}
          or call the Colorado Department of Revenue at (303) 238-7378.
        </p>
      </section>

      {/* How to get started */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-nct-navy mb-8">How to Get Started</h2>
        <div className="space-y-6">
          {[
            {
              step: "1",
              title: "Contact Us",
              desc: "Call or email to introduce yourself and describe what you're looking for — volume, frequency, and any specific categories you need.",
            },
            {
              step: "2",
              title: "Schedule Your First Pickup",
              desc: "We'll schedule a time for you to come in and review the available inventory. Raw bags are typically picked up on-site.",
            },
            {
              step: "3",
              title: "Provide Exemption Certificate (if applicable)",
              desc: "If purchasing for resale, bring your Colorado Form DR 0563 or sales tax license for our records.",
            },
            {
              step: "4",
              title: "Pick Up and Pay",
              desc: "Load your bags, we weigh them, and you pay on-site. Cash and card accepted.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-nct-gold text-white font-bold flex items-center justify-center flex-shrink-0">
                {item.step}
              </div>
              <div>
                <h3 className="font-bold text-nct-navy">{item.title}</h3>
                <p className="text-gray-600 text-sm mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="bg-nct-navy text-white rounded-xl p-10 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Buy Wholesale?</h2>
        <p className="text-gray-300 mb-8 max-w-lg mx-auto">
          Contact us to discuss your volume needs, schedule your first pickup, or ask
          questions about our wholesale program.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:donate@nctrecycling.com"
            className="bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-6 py-3 rounded transition-colors"
          >
            Email donate@nctrecycling.com
          </a>
          <a
            href="tel:+19702329108"
            className="border-2 border-white text-white hover:bg-white hover:text-nct-navy font-bold px-6 py-3 rounded transition-colors"
          >
            Call (970) 232-9108
          </a>
        </div>
      </div>
    </div>
  );
}
