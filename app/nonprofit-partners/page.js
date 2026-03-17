import Link from "next/link";

export const metadata = {
  title: "Nonprofit Partners — Co-op Clothing Exchange",
  description:
    "NCT Recycling's nonprofit co-op network connects organizations across Northern Colorado. Send us your excess donations — receive free inventory for the clients you serve. Benefits-focused partnership, no cost to join.",
};

const partners = [
  {
    name: "Homeward Alliance",
    focus: "Housing stability and homelessness services",
    location: "Fort Collins, CO",
  },
  {
    name: "NOCO Humane Society",
    focus: "Animal welfare and adoption services",
    location: "Northern Colorado",
  },
  {
    name: "Clothing Cottage",
    focus: "Affordable clothing for families in need",
    location: "Northern Colorado",
  },
  {
    name: "The Matthew House",
    focus: "Resettlement support for refugees and immigrants",
    location: "Fort Collins, CO",
  },
];

const benefits = [
  {
    icon: "🆓",
    title: "Free Clothing for Your Clients",
    desc: "Source inventory from our warehouse at no cost. Approved partners select what their clients actually need — by size, season, and category.",
  },
  {
    icon: "♻️",
    title: "Turn Overflow Into Value",
    desc: "Every organization ends up with donations they can't use. Instead of storage headaches or disposal costs, your excess comes to us and gets redistributed where it's needed.",
  },
  {
    icon: "🗓️",
    title: "Logistics Coordination",
    desc: "We coordinate pickups to fit your schedule. Our upcoming partner portal will let you notify us when a load is ready — no phone tag, just submit your bag count and we handle the rest.",
  },
  {
    icon: "🌐",
    title: "Part of a Regional Network",
    desc: "You join a co-op of Northern Colorado nonprofits sharing resources across Fort Collins, Greeley, and the surrounding region. What one organization can't use, another might need.",
  },
  {
    icon: "📣",
    title: "Visibility & Community Recognition",
    desc: "Approved partners are featured on our website and materials. We only publish what you authorize — your mission, your message.",
  },
  {
    icon: "📊",
    title: "Impact You Can Report",
    desc: "We track pounds collected and redistributed through the co-op. Partners receive data they can use in grant reporting, annual reports, and donor communications.",
  },
];

export default function PartnersPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-nct-navy mb-4 text-center">Nonprofit Partners</h1>
      <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
        NCT Recycling is the hub of a Northern Colorado clothing co-op. We connect nonprofits
        with the inventory they need — while putting excess donations to work across the region.
      </p>

      {/* Core exchange */}
      <section className="mb-20">
        <div className="bg-nct-navy text-white rounded-xl p-10">
          <h2 className="text-3xl font-bold text-center mb-10">The Co-op Exchange</h2>
          <div className="grid md:grid-cols-3 gap-6 items-center text-center">
            <div className="bg-white/10 rounded-xl p-6">
              <span className="text-4xl block mb-3">📦</span>
              <h3 className="font-bold text-nct-gold text-lg mb-2">You Send Your Excess</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Clothing donations your organization can't use — overflow, wrong sizes, outside
                your scope — come to us instead of sitting in storage or going to waste.
              </p>
            </div>
            <div className="text-5xl font-bold text-nct-gold">⇄</div>
            <div className="bg-white/10 rounded-xl p-6">
              <span className="text-4xl block mb-3">🏠</span>
              <h3 className="font-bold text-nct-gold text-lg mb-2">We Supply What You Need</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Source clothing from our warehouse for the clients and families you serve — at
                no cost to your organization.
              </p>
            </div>
          </div>
          <p className="text-center text-gray-300 mt-8 text-sm max-w-xl mx-auto">
            The result: excess donations flow where they're actually needed, organizations
            spend less time managing overflow, and your clients get more of what they need.
          </p>
          <div className="text-center mt-8">
            <Link
              href="/nonprofit-apply"
              className="inline-block bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-8 py-3 rounded transition-colors text-lg"
            >
              Apply to Join the Co-op →
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mb-20">
        <h2 className="text-3xl font-bold text-nct-navy text-center mb-10">
          What Your Organization Gets
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {benefits.map((b) => (
            <div key={b.title} className="bg-white border border-gray-200 rounded-xl p-6 flex gap-4 shadow-sm">
              <span className="text-3xl flex-shrink-0">{b.icon}</span>
              <div>
                <h3 className="font-bold text-nct-navy mb-1">{b.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Coming soon: nonprofit portal */}
      <section className="mb-20 bg-nct-gold/10 border border-nct-gold/30 rounded-xl p-8">
        <div className="flex gap-4">
          <span className="text-3xl">🔔</span>
          <div>
            <h3 className="font-bold text-nct-navy text-lg mb-2">Partner Portal — Coming Soon</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              We're building a nonprofit partner portal that makes coordination easier. When
              your next load is ready, simply log in, enter your bag count, and submit a
              pickup request — we estimate the weight and schedule accordingly. No phone tag,
              no guesswork. Apply now to be among the first partners onboarded when it launches.
            </p>
          </div>
        </div>
      </section>

      {/* Current Partners */}
      <section className="mb-20">
        <h2 className="text-2xl font-bold text-nct-navy text-center mb-8">Current Partners</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {partners.map((p) => (
            <div key={p.name} className="bg-white border border-gray-200 rounded-xl p-6 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-nct-navy/10 flex items-center justify-center flex-shrink-0">
                <span className="text-nct-navy font-bold text-lg">{p.name.charAt(0)}</span>
              </div>
              <div>
                <h3 className="font-bold text-nct-navy">{p.name}</h3>
                <p className="text-sm text-gray-600">{p.focus}</p>
                <p className="text-xs text-gray-400 mt-1">{p.location}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 mt-6">
          We partner with 10+ nonprofits across Northern Colorado.
        </p>
      </section>

      {/* Who fits */}
      <section className="mb-20">
        <h2 className="text-2xl font-bold text-nct-navy text-center mb-8">Who's a Good Fit?</h2>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          {[
            { icon: "🏠", label: "Shelters & Housing Services" },
            { icon: "🧥", label: "Thrift & Resale Programs" },
            { icon: "🌍", label: "Refugee & Immigrant Services" },
            { icon: "🍽️", label: "Food Banks with Clothing Needs" },
            { icon: "❤️", label: "Faith-Based Community Programs" },
            { icon: "👶", label: "Family & Youth Services" },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-xl p-5">
              <span className="text-3xl block mb-2">{item.icon}</span>
              <p className="font-medium text-nct-navy text-sm">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center bg-nct-navy text-white rounded-xl p-10">
        <h2 className="text-2xl font-bold mb-4">Ready to Join the Co-op?</h2>
        <div className="mt-2 mb-6">
          <Link
            href="/nonprofit-apply"
            className="inline-block bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-8 py-3 rounded transition-colors text-lg"
          >
            Apply Now →
          </Link>
        </div>
        <p className="text-gray-300 mb-6 max-w-xl mx-auto text-sm">
          Questions before applying? Reach out directly and we'll walk you through the process.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:donate@nctrecycling.com"
            className="border border-white/40 text-gray-300 hover:text-white font-medium px-5 py-2 rounded transition-colors text-sm"
          >
            donate@nctrecycling.com
          </a>
          <a
            href="tel:+19702329108"
            className="border border-white/40 text-gray-300 hover:text-white font-medium px-5 py-2 rounded transition-colors text-sm"
          >
            (970) 232-9108
          </a>
        </div>
      </section>
    </div>
  );
}
