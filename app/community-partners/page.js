import Link from "next/link";

export const metadata = {
  title: "Community Partners — Nonprofits & Small Businesses",
  description:
    "Meet the nonprofits and small businesses partnered with NCT Recycling across Northern Colorado. Together we keep 60,000 lbs of clothing out of landfills every month and strengthen our local community.",
};

const nonprofitPartners = [
  {
    name: "Homeward Alliance",
    mission: "Providing pathways out of homelessness through housing, outreach, and support services.",
    location: "Fort Collins, CO",
    stewardship: "Diverts excess clothing donations through the NCT co-op, ensuring nothing usable goes to waste.",
    website: null,
  },
  {
    name: "NOCO Humane Society",
    mission: "Protecting and finding homes for animals in need across Northern Colorado.",
    location: "Northern Colorado",
    stewardship: "Channels surplus textile donations into the co-op network rather than the landfill.",
    website: null,
  },
  {
    name: "Clothing Cottage",
    mission: "Providing affordable, dignified clothing to families and individuals in need.",
    location: "Northern Colorado",
    stewardship: "Redirects overflow inventory through NCT's co-op, keeping every usable item in circulation.",
    website: null,
  },
  {
    name: "The Matthew House",
    mission: "Supporting refugees and immigrants with resettlement services and community integration.",
    location: "Fort Collins, CO",
    stewardship: "Partners with NCT to supply clothing for newly arrived families while responsibly managing donation overflow.",
    website: null,
  },
];

const smallBusinessPartners = [
  // Placeholder — populated as partners are onboarded
];

export default function CommunityPartnersPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-nct-navy mb-4 text-center">Community Partners</h1>
      <p className="text-center text-gray-600 mb-6 max-w-2xl mx-auto text-lg">
        NCT Recycling doesn't operate in isolation. Our nonprofit and small business partners
        are the backbone of a Northern Colorado network that keeps 60,000 lbs of clothing
        out of landfills every single month.
      </p>
      <p className="text-center text-gray-500 mb-16 max-w-2xl mx-auto">
        Every organization listed here has made a commitment to responsible textile stewardship —
        alongside the community mission they already serve.
      </p>

      {/* Environmental stewardship statement */}
      <section className="mb-20">
        <div className="bg-nct-navy text-white rounded-xl p-10 text-center">
          <h2 className="text-2xl font-bold mb-4">Environmental Stewards of Northern Colorado</h2>
          <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Textile waste is one of the most overlooked environmental problems in the country.
            Every organization in the NCT network — whether a nonprofit serving families or a
            small business sourcing resale inventory — plays a direct role in keeping clothing
            in circulation and out of Colorado's landfills. That's not a side effect of what
            they do. It's part of who they are.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-6 max-w-lg mx-auto text-center">
            <div>
              <p className="text-3xl font-bold text-nct-gold">60K</p>
              <p className="text-xs text-gray-400 mt-1">lbs diverted monthly</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-nct-gold">100%</p>
              <p className="text-xs text-gray-400 mt-1">kept from landfills</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-nct-gold">10+</p>
              <p className="text-xs text-gray-400 mt-1">partner organizations</p>
            </div>
          </div>
        </div>
      </section>

      {/* Nonprofit Partners */}
      <section className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-gray-200"></div>
          <h2 className="text-2xl font-bold text-nct-navy whitespace-nowrap">Nonprofit Partners</h2>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>
        <p className="text-gray-600 mb-10 max-w-2xl mx-auto text-center text-sm">
          These organizations serve Northern Colorado's most vulnerable communities. Through
          the NCT co-op exchange, they turn donation overflow into a resource — and give their
          clients access to clothing they need.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {nonprofitPartners.map((p) => (
            <div key={p.name} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-nct-navy flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">{p.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="font-bold text-nct-navy text-lg">{p.name}</h3>
                  <p className="text-xs text-gray-400">{p.location}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">{p.mission}</p>
                <div className="flex gap-2 items-start bg-green-50 border border-green-100 rounded-lg p-3">
                  <span className="text-green-600 text-sm mt-0.5">🌿</span>
                  <p className="text-xs text-green-800 leading-relaxed">{p.stewardship}</p>
                </div>
              </div>
              {p.website && (
                <a
                  href={p.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-nct-gold hover:underline text-sm font-medium"
                >
                  Visit {p.name} →
                </a>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mt-6">
          Additional nonprofit partners displayed as authorization is received.
        </p>
      </section>

      {/* Small Business Partners */}
      <section className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-gray-200"></div>
          <h2 className="text-2xl font-bold text-nct-navy whitespace-nowrap">Small Business Partners</h2>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>
        <p className="text-gray-600 mb-10 max-w-2xl mx-auto text-center text-sm">
          These businesses source inventory through NCT Recycling — keeping clothing in the
          local economy and out of landfills while building sustainable, community-rooted operations.
        </p>

        {smallBusinessPartners.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
            <p className="text-3xl mb-4">🏪</p>
            <h3 className="font-bold text-nct-navy text-lg mb-2">Small Business Partners Coming Soon</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              We're onboarding our first featured small business partners. If your business
              sources inventory through NCT Recycling and wants to be listed here as a
              community environmental steward, reach out.
            </p>
            <a
              href="mailto:donate@nctrecycling.com"
              className="inline-block mt-6 bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-5 py-2 rounded text-sm transition-colors"
            >
              Apply to Be Listed
            </a>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {smallBusinessPartners.map((p) => (
              <div key={p.name} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-bold text-nct-navy text-lg">{p.name}</h3>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Donation Hub section */}
      <section className="mb-20 bg-nct-gold/10 border border-nct-gold/30 rounded-xl p-8">
        <div className="flex gap-4">
          <span className="text-3xl flex-shrink-0">📍</span>
          <div>
            <h3 className="font-bold text-nct-navy text-lg mb-2">Become a Donation Hub</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              Partner organizations can host an NCT Recycling donation receptacle at their
              location — giving donors a convenient drop-off point while expanding our
              collection network across Northern Colorado. Your storefront or facility becomes
              part of the region's textile reuse infrastructure.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              Whether you're a thrift store, a community center, a nonprofit office, or a
              small business with foot traffic, hosting a donation hub increases your
              visibility, supports your community mission, and strengthens the co-op network
              for everyone.
            </p>
            <a
              href="mailto:donate@nctrecycling.com"
              className="inline-block mt-4 text-nct-gold hover:underline text-sm font-medium"
            >
              Inquire about hosting a donation hub →
            </a>
          </div>
        </div>
      </section>

      {/* Join CTA */}
      <section className="text-center bg-nct-navy text-white rounded-xl p-10">
        <h2 className="text-2xl font-bold mb-4">Join the NCT Partner Network</h2>
        <p className="text-gray-300 mb-8 max-w-xl mx-auto">
          Whether you're a nonprofit, a reseller, or a small business, being part of the NCT
          network means being recognized as part of the solution to Colorado's textile waste
          problem — and getting the visibility that comes with it.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/nonprofit-partners"
            className="bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-6 py-3 rounded transition-colors"
          >
            Nonprofit Co-op Program
          </Link>
          <Link
            href="/retail-partners"
            className="border-2 border-white text-white hover:bg-white hover:text-nct-navy font-bold px-6 py-3 rounded transition-colors"
          >
            Retail Partner Program
          </Link>
        </div>
      </section>
    </div>
  );
}
