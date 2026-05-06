import Link from "next/link";

export const metadata = {
  title: "NCT Recycling | Thrift Boutique, Bins & Wholesale — Fort Collins, CO",
  description:
    "Fort Collins' textile reuse hub. Shop our curated boutique, $2/lb bins, or bulk raw weight bags. 60,000 lbs diverted from Colorado landfills every month — 100% of what we collect.",
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "NCT Recycling",
  alternateName: "NCT Emporium",
  description:
    "Textile reuse hub in Fort Collins, CO. Curated thrift boutique, $2/lb bins, and bulk wholesale raw bags. Nonprofit co-op exchange partner.",
  url: "https://www.nctrecycling.com",
  telephone: "+1-970-232-9108",
  email: "donate@nctrecycling.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "6108 South College Ave, STE C",
    addressLocality: "Fort Collins",
    addressRegion: "CO",
    postalCode: "80525",
    addressCountry: "US",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      opens: "12:00",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Sunday"],
      opens: "12:00",
      closes: "16:00",
    },
  ],
  sameAs: [
    "https://www.instagram.com/nctemporium",
    "https://www.facebook.com/nctrecycling",
  ],
};

const partners = [
  { name: "Homeward Alliance", description: "Housing stability and homeless services, Fort Collins" },
  { name: "NOCO Humane Society", description: "Animal welfare, Northern Colorado" },
  { name: "Clothing Cottage", description: "Affordable clothing for families in need" },
  { name: "The Matthew House", description: "Resettlement support for refugees and immigrants" },
];

const tiers = [
  {
    label: "Curated Boutique",
    price: "Retail Pricing",
    icon: "✦",
    description:
      "Hand-selected pieces organized by category. A true thrift boutique experience with fresh inventory restocked regularly.",
    cta: "Shop the Boutique",
    href: "/shop#boutique",
    accent: "border-nct-gold",
  },
  {
    label: "Pound Bins",
    price: "$2.00 / lb",
    icon: "⬛",
    description:
      "Dig through rotating vintage, Y2K, and branded inventory. Reseller access Tue–Thu 12–4PM (portal required). Public access Tue–Thu 4–6PM and Sunday 12–4PM.",
    cta: "How Bins Work",
    href: "/shop#bins",
    accent: "border-blue-400",
  },
  {
    label: "Reseller Buyer Account",
    price: "Apply Online",
    icon: "◈",
    description:
      "Apply once for a reseller account, then shop curated drops in the online reseller store. Optional warehouse access for on-site sorting (admin review required).",
    cta: "Apply to Buy",
    href: "/apply",
    accent: "border-green-400",
  },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      {/* Hero */}
      <section className="bg-nct-navy text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            Fort Collins' Textile Reuse Hub
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Curated boutique. Fresh bins. Bulk wholesale bags. Every pound donated stays in
            Colorado — none goes to the landfill.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/donate"
              className="bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-8 py-3 rounded text-lg transition-colors"
            >
              Donate Clothing
            </Link>
            <Link
              href="/shop"
              className="border-2 border-white text-white hover:bg-white hover:text-nct-navy font-bold px-8 py-3 rounded text-lg transition-colors"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </section>

      {/* 3 Buying Tiers */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-nct-navy text-center mb-4">
            Three Ways to Shop
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-xl mx-auto">
            Whether you're a casual shopper, a reseller sourcing inventory, or a wholesale
            buyer — we have a tier for you.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tiers.map((tier) => (
              <div
                key={tier.label}
                className={`bg-white rounded-xl shadow p-8 border-t-4 ${tier.accent} flex flex-col`}
              >
                <div className="text-3xl mb-3">{tier.icon}</div>
                <h3 className="text-xl font-bold text-nct-navy mb-1">{tier.label}</h3>
                <p className="text-2xl font-bold text-nct-gold mb-4">{tier.price}</p>
                <p className="text-gray-600 text-sm leading-relaxed flex-1">{tier.description}</p>
                <Link
                  href={tier.href}
                  className="mt-6 inline-block text-center bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-4 py-2 rounded transition-colors text-sm"
                >
                  {tier.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-nct-navy mb-6">
            How We Keep Clothing Out of Landfills
          </h2>
          <p className="text-gray-600 leading-relaxed text-lg mb-12">
            NCT Recycling partners with nonprofits across Northern Colorado to collect donated
            clothing. Inventory flows through our boutique, bins, and wholesale program —
            and whatever doesn't sell gets baled for industrial textile reuse. Nothing goes
            to the landfill.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { step: "1", label: "Collect", desc: "Nonprofit partners send us donations" },
              { step: "2", label: "Sort", desc: "Curated for boutique, bins, or wholesale" },
              { step: "3", label: "Reuse", desc: "Resellers, shoppers, and nonprofits source inventory" },
              { step: "4", label: "Recycle", desc: "Remainder baled for industrial reuse" },
            ].map((item) => (
              <div key={item.step}>
                <div className="w-12 h-12 rounded-full bg-nct-navy text-white font-bold text-lg flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h4 className="font-bold text-nct-navy mb-1">{item.label}</h4>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="bg-nct-navy text-white py-14 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-5xl font-bold text-nct-gold">60,000</p>
            <p className="text-lg mt-2">lbs diverted from landfills every month</p>
          </div>
          <div>
            <p className="text-5xl font-bold text-nct-gold">100%</p>
            <p className="text-lg mt-2">of collected textiles kept out of landfills</p>
          </div>
          <div>
            <p className="text-5xl font-bold text-nct-gold">10+</p>
            <p className="text-lg mt-2">nonprofit partners across Northern Colorado</p>
          </div>
        </div>
      </section>

      {/* Nonprofit Partner Preview */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-nct-navy mb-4">Our Nonprofit Partners</h2>
          <p className="text-gray-600 mb-10 max-w-xl mx-auto">
            We work with organizations across Northern Colorado in a co-op exchange — they
            send us excess donations, and we supply them with free inventory in return.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {partners.map((p) => (
              <div key={p.name} className="bg-white rounded-lg shadow p-5 text-center">
                <div className="w-12 h-12 rounded-full bg-nct-navy/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-nct-navy font-bold text-lg">{p.name.charAt(0)}</span>
                </div>
                <h4 className="font-bold text-nct-navy text-sm">{p.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{p.description}</p>
              </div>
            ))}
          </div>
          <Link
            href="/nonprofit-partners"
            className="inline-block bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-6 py-3 rounded transition-colors"
          >
            Learn About the Co-op Exchange →
          </Link>
        </div>
      </section>

      {/* Donate CTA */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-nct-navy mb-4">Have Clothing to Donate?</h2>
          <p className="text-gray-600 mb-8">
            Drop off clean, dry clothing 24/7 at our east-side receptacles. No appointment
            needed. We accept everyday clothing, denim, jackets, shoes, belts, hats, scarves,
            and winter gear for all ages.
          </p>
          <Link
            href="/donate"
            className="bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-8 py-3 rounded text-lg transition-colors"
          >
            See Donation Guidelines →
          </Link>
        </div>
      </section>
    </>
  );
}
