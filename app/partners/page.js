import Link from "next/link";

export const metadata = {
  title: "Partners — NCT Recycling Co-op Network",
  description:
    "NCT Recycling is the hub of a Northern Colorado clothing co-op. Nonprofits donate excess and receive free inventory. Retail partners sort and claim loads. Wholesale buyers get raw bags. Nothing goes to the landfill.",
};

const nonprofitPartners = [
  {
    name: "Homeward Alliance",
    focus: "Housing stability and homelessness services",
    location: "Fort Collins, CO",
    stewardship: "Diverts excess clothing donations through the NCT co-op, ensuring nothing usable goes to waste.",
  },
  {
    name: "NOCO Humane Society",
    focus: "Animal welfare and adoption services",
    location: "Northern Colorado",
    stewardship: "Channels surplus textile donations into the co-op network rather than the landfill.",
  },
  {
    name: "Clothing Cottage",
    focus: "Affordable, dignified clothing for families in need",
    location: "Northern Colorado",
    stewardship: "Redirects overflow inventory through NCT's co-op, keeping every usable item in circulation.",
  },
  {
    name: "The Matthew House",
    focus: "Resettlement support for refugees and immigrants",
    location: "Fort Collins, CO",
    stewardship: "Partners with NCT to supply clothing for newly arrived families while responsibly managing donation overflow.",
  },
];

export default function PartnersPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-nct-navy mb-4 text-center">The NCT Co-op Network</h1>
      <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
        NCT Recycling is the hub of a circular clothing economy serving Northern Colorado.
        Every organization in our network — nonprofit or retail — plays a role in keeping
        clothing in circulation and out of the landfill.
      </p>

      {/* ── The Cycle ── */}
      <section className="mb-20" id="cycle">
        <div className="bg-nct-navy text-white rounded-2xl p-10">
          <h2 className="text-2xl font-bold text-center mb-2">How the Co-op Works</h2>
          <p className="text-center text-gray-300 text-sm mb-10 max-w-xl mx-auto">
            Every pound that enters the system finds a home. Nothing leaves to the landfill.
          </p>

          {/* Flow: mobile stacked, desktop row */}
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-0 justify-between max-w-3xl mx-auto">

            {/* Step 1: Nonprofits */}
            <div className="flex flex-col items-center text-center w-full md:w-48">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
                <span className="text-3xl">🏠</span>
              </div>
              <p className="font-bold text-nct-gold text-sm mb-1">Nonprofits</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                Collect donations from the community. Send excess bags to NCT when storage fills up.
              </p>
            </div>

            <div className="text-nct-gold text-2xl font-bold rotate-90 md:rotate-0 flex-shrink-0 px-2">→</div>

            {/* Step 2: NCT Hub */}
            <div className="flex flex-col items-center text-center w-full md:w-48">
              <div className="w-16 h-16 rounded-full bg-nct-gold/20 border-2 border-nct-gold flex items-center justify-center mb-3">
                <span className="text-3xl">♻️</span>
              </div>
              <p className="font-bold text-nct-gold text-sm mb-1">NCT Processes</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                We pick up, weigh, and sort every load. Inventory flows to three outlets based on grade and volume.
              </p>
            </div>

            <div className="text-nct-gold text-2xl font-bold rotate-90 md:rotate-0 flex-shrink-0 px-2">→</div>

            {/* Step 3: Three outlets */}
            <div className="flex flex-col gap-3 w-full md:w-48">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="font-bold text-sm text-white">🛍 Reseller Sort</p>
                <p className="text-gray-300 text-xs mt-1">Retail partners sort on-site and keep what they pull.</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="font-bold text-sm text-white">📦 Wholesale Bags</p>
                <p className="text-gray-300 text-xs mt-1">Raw bags sold by weight to volume buyers at $0.30/lb.</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="font-bold text-sm text-white">🏪 Bins & Boutique</p>
                <p className="text-gray-300 text-xs mt-1">Sorted discards and curated pieces sold to the public.</p>
              </div>
            </div>

            <div className="text-nct-gold text-2xl font-bold rotate-90 md:rotate-0 flex-shrink-0 px-2">→</div>

            {/* Step 4: Back to nonprofits */}
            <div className="flex flex-col items-center text-center w-full md:w-48">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
                <span className="text-3xl">🔄</span>
              </div>
              <p className="font-bold text-nct-gold text-sm mb-1">Closes the Loop</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                Revenue funds NCT operations. Nonprofits source free inventory for the clients they serve.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg mx-auto text-center border-t border-white/10 pt-8">
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

      {/* ── Nonprofit Co-op Partners ── */}
      <section className="mb-20" id="nonprofit">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <h2 className="text-2xl font-bold text-nct-navy whitespace-nowrap">Nonprofit Co-op Partners</h2>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>
        <p className="text-gray-600 mb-10 max-w-2xl mx-auto text-center text-sm">
          Nonprofits in the NCT co-op send us their excess donations — and in return, they source
          free clothing for the clients and families they serve. No storage headaches. No disposal costs.
          What your organization can't use, another one might need.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="bg-nct-navy/5 border border-nct-navy/15 rounded-xl p-6">
            <h3 className="font-bold text-nct-navy mb-4">What You Give</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-3"><span className="text-nct-gold font-bold">→</span> Excess clothing donations your org can't use</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">→</span> Pickup coordination through the partner portal</li>
              <li className="flex gap-3"><span className="text-nct-gold font-bold">→</span> Log your bag count when a load is ready</li>
            </ul>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="font-bold text-nct-navy mb-4">What You Get</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-3"><span className="text-green-600 font-bold">✓</span> Free clothing inventory for the clients you serve</li>
              <li className="flex gap-3"><span className="text-green-600 font-bold">✓</span> Impact data for grant reporting and annual reports</li>
              <li className="flex gap-3"><span className="text-green-600 font-bold">✓</span> Visibility as a co-op environmental steward</li>
              <li className="flex gap-3"><span className="text-green-600 font-bold">✓</span> Part of a 10+ org regional network</li>
            </ul>
          </div>
        </div>

        {/* Portal CTA (live, not coming soon) */}
        <div className="bg-nct-gold/10 border border-nct-gold/30 rounded-xl p-6 mb-10 flex items-start gap-4">
          <span className="text-2xl flex-shrink-0">🖥️</span>
          <div>
            <h3 className="font-bold text-nct-navy mb-1">Partner Portal — Now Live</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              Approved nonprofit partners can log bag counts, submit pickup requests, track load
              history, and source free inventory appointments — all without a phone call.
            </p>
            <Link
              href="/login"
              className="inline-block bg-nct-navy hover:bg-nct-navy-dark text-white text-sm font-bold px-5 py-2 rounded transition-colors"
            >
              Log Into Partner Portal →
            </Link>
          </div>
        </div>

        {/* Current Partners */}
        <h3 className="font-bold text-nct-navy text-lg mb-6">Current Co-op Partners</h3>
        <div className="grid md:grid-cols-2 gap-5 mb-4">
          {nonprofitPartners.map((p) => (
            <div key={p.name} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-nct-navy flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">{p.name.charAt(0)}</span>
                </div>
                <div>
                  <h4 className="font-bold text-nct-navy">{p.name}</h4>
                  <p className="text-xs text-gray-400">{p.location}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{p.focus}</p>
              <div className="flex gap-2 items-start bg-green-50 border border-green-100 rounded-lg p-2">
                <span className="text-green-600 text-xs mt-0.5">🌿</span>
                <p className="text-xs text-green-800 leading-relaxed">{p.stewardship}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-400 mb-10">
          Additional partners displayed as authorization is received. We partner with 10+ nonprofits across Northern Colorado.
        </p>

        <div className="text-center">
          <Link
            href="/co-op-apply"
            className="inline-block bg-nct-navy hover:bg-nct-navy-dark text-white font-bold px-8 py-3 rounded transition-colors"
          >
            Apply to Join the Co-op →
          </Link>
        </div>
      </section>

      {/* ── Retail Partners ── */}
      <section className="mb-20" id="retail">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <h2 className="text-2xl font-bold text-nct-navy whitespace-nowrap">Retail Partners</h2>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>
        <p className="text-gray-600 mb-10 max-w-2xl mx-auto text-center text-sm">
          Approved retail partners get first access to sorted inventory — book a wholesale sort
          slot to work on-site, or shop the pound bins during reseller hours. Their discards feed
          the bins. Nothing goes to waste.
        </p>

        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {[
            {
              icon: "🔑",
              title: "Approved Access",
              desc: "Retail partnerships are application-only. Once approved, you book via the reseller portal.",
            },
            {
              icon: "🛍",
              title: "Wholesale Sort",
              desc: "Sort on-site from incoming loads. Take everything you pull — $0.30/lb (unopened bags).",
            },
            {
              icon: "📦",
              title: "Pound Bins",
              desc: "Shop pre-sorted bins during reseller hours. Priced at $2.00/lb weighed at checkout.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-center">
              <span className="text-3xl block mb-3">{item.icon}</span>
              <h3 className="font-bold text-nct-navy mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-10 text-sm text-gray-600">
          <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
            <span className="text-lg">🏪</span>
            <div><strong className="text-nct-navy block text-sm">Small Thrift Stores</strong>Restock your floor with a sorted haul.</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
            <span className="text-lg">📱</span>
            <div><strong className="text-nct-navy block text-sm">High-Volume Resellers</strong>eBay, Poshmark, Depop — control your sourcing.</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 flex gap-3">
            <span className="text-lg">👗</span>
            <div><strong className="text-nct-navy block text-sm">Vintage & Specialty</strong>Curate your own pulls. You know what sells.</div>
          </div>
        </div>

        {/* Portal CTA */}
        <div className="bg-nct-gold/10 border border-nct-gold/30 rounded-xl p-6 mb-10 flex items-start gap-4">
          <span className="text-2xl flex-shrink-0">🖥️</span>
          <div>
            <h3 className="font-bold text-nct-navy mb-1">Reseller Portal — Now Live</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              Approved resellers can view upcoming shopping days, book a wholesale sort or bins slot,
              and manage their bookings — all without making a phone call.
            </p>
            <Link
              href="/login"
              className="inline-block bg-nct-navy hover:bg-nct-navy-dark text-white text-sm font-bold px-5 py-2 rounded transition-colors"
            >
              Log Into Reseller Portal →
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/apply"
            className="inline-block bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-8 py-3 rounded transition-colors"
          >
            Apply to Become a Retail Partner →
          </Link>
          <p className="text-xs text-gray-400 mt-3">Partnerships are approved on a case-by-case basis.</p>
        </div>
      </section>

      {/* ── Wholesale Buyers ── */}
      <section className="mb-20" id="wholesale">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <h2 className="text-2xl font-bold text-nct-navy whitespace-nowrap">Wholesale Buyers</h2>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>
        <p className="text-gray-600 mb-10 max-w-2xl mx-auto text-center text-sm">
          No application required. Buy raw weight mixed clothing bags directly from our facility.
          Sight-unseen, bulk, sold by the pound.
        </p>

        <div className="bg-nct-navy text-white rounded-xl p-8 text-center mb-10">
          <p className="text-5xl font-bold text-nct-gold mb-2">$0.30</p>
          <p className="text-xl mb-1">per pound</p>
          <p className="text-gray-300 text-sm">Raw weight bags · Bulk · Sight-unseen · Mixed clothing</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="text-gray-700 space-y-3 text-sm leading-relaxed">
            <p>
              Raw weight bags are unsorted bags sold exactly as they come in from donation intake.
              You're buying the weight — not a curated selection. Contents are mixed and vary bag to bag.
            </p>
            <p>
              Typical contents include everyday clothing across all categories: men's, women's, kids',
              shoes, outerwear, denim, and accessories. No guarantees on specific contents, brands, or quality.
            </p>
            <p>
              Colorado sales tax exemption accepted. Bring your <strong>Form DR 0563</strong> or sales tax
              license number for your first purchase.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 text-sm space-y-3">
            <h3 className="font-bold text-nct-navy mb-3">At a Glance</h3>
            {[
              ["Price", "$0.30 per pound"],
              ["Contents", "Mixed — sight unseen"],
              ["Availability", "Contact to schedule"],
              ["Tax Exempt?", "Yes — CO Form DR 0563"],
              ["Payment", "Cash or card on site"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-500">{label}</span>
                <span className="font-bold text-nct-navy">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:donate@nctrecycling.com"
            className="bg-nct-navy hover:bg-nct-navy-dark text-white font-bold px-7 py-3 rounded transition-colors text-center"
          >
            Email donate@nctrecycling.com
          </a>
          <a
            href="tel:+19702329108"
            className="border-2 border-nct-navy text-nct-navy hover:bg-nct-navy hover:text-white font-bold px-7 py-3 rounded transition-colors text-center"
          >
            Call (970) 232-9108
          </a>
        </div>
      </section>

      {/* ── Donation Hub ── */}
      <section className="mb-20">
        <div className="bg-nct-gold/10 border border-nct-gold/30 rounded-xl p-8 flex gap-4">
          <span className="text-3xl flex-shrink-0">📍</span>
          <div>
            <h3 className="font-bold text-nct-navy text-lg mb-2">Become a Donation Hub</h3>
            <p className="text-gray-700 text-sm leading-relaxed mb-2">
              Any organization — nonprofit, thrift store, community center, or small business — can
              host an NCT donation receptacle at their location. Your site becomes part of Northern
              Colorado's textile reuse infrastructure, increasing your visibility while keeping more
              clothing out of landfills.
            </p>
            <a
              href="mailto:donate@nctrecycling.com"
              className="text-nct-gold hover:underline text-sm font-medium"
            >
              Inquire about hosting a donation hub →
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="bg-nct-navy text-white rounded-xl p-10 text-center">
        <h2 className="text-2xl font-bold mb-4">Join the NCT Network</h2>
        <p className="text-gray-300 mb-8 max-w-xl mx-auto text-sm leading-relaxed">
          Whether you're a nonprofit serving the community, a reseller sourcing inventory, or a
          volume buyer — there's a place for you in the co-op. Apply for the program that fits your
          organization, or reach out with questions.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <Link
            href="/co-op-apply"
            className="bg-white text-nct-navy hover:bg-gray-100 font-bold px-6 py-3 rounded transition-colors"
          >
            Nonprofit Co-op Application →
          </Link>
          <Link
            href="/apply"
            className="bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-6 py-3 rounded transition-colors"
          >
            Retail Partner Application →
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="mailto:donate@nctrecycling.com" className="border border-white/40 text-gray-300 hover:text-white px-5 py-2 rounded text-sm transition-colors">
            donate@nctrecycling.com
          </a>
          <a href="tel:+19702329108" className="border border-white/40 text-gray-300 hover:text-white px-5 py-2 rounded text-sm transition-colors">
            (970) 232-9108
          </a>
        </div>
      </section>
    </div>
  );
}
