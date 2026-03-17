import Link from "next/link";

export const metadata = {
  title: "Retail Partners — Ad Hoc Load Claims",
  description:
    "NCT Recycling's retail partner program gives approved resellers and thrift stores first access to claim ad hoc pickup loads. Sort at our facility, keep what you sort. Contact us to apply.",
};

const benefits = [
  {
    icon: "🚚",
    title: "First Access to Ad Hoc Loads",
    desc: "Approved retail partners are notified when ad hoc pickup loads become available. Claim a load before it hits the general sort floor.",
  },
  {
    icon: "📦",
    title: "You Sort, You Keep",
    desc: "Sort the load yourself at our Fort Collins facility. You take everything you pull — the inventory you keep is yours to price and sell.",
  },
  {
    icon: "⏱️",
    title: "8 Hours On-Site",
    desc: "You have a full 8-hour window at our facility to sort and load out. Work at your own pace with your own team.",
  },
  {
    icon: "♻️",
    title: "Your Discards Feed Our Bins",
    desc: "Anything you don't take goes directly into our bins and boutique — nothing gets wasted, and you don't have to deal with leftovers.",
  },
  {
    icon: "📅",
    title: "Load Calendar Visibility",
    desc: "Coming soon: approved retail partners will get access to our load calendar — see scheduled incoming loads and plan your sourcing runs in advance.",
  },
  {
    icon: "🤝",
    title: "Negotiated Per Load",
    desc: "Pricing is negotiated individually for each ad hoc load based on size, contents, and logistics. No flat rate, no surprises — fair to the load.",
  },
];

export default function RetailPartnersPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-nct-navy mb-4 text-center">Retail Partners</h1>
      <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
        An exclusive program for approved resellers and thrift stores who want first-pick
        access to incoming loads — on their own terms.
      </p>

      {/* Hero callout */}
      <div className="bg-nct-navy text-white rounded-xl p-10 text-center mb-16">
        <h2 className="text-3xl font-bold mb-4">Claim a Load. Sort It Yourself. Keep What You Want.</h2>
        <p className="text-gray-300 max-w-2xl mx-auto text-lg leading-relaxed">
          When an ad hoc pickup load becomes available, approved retail partners have the
          opportunity to claim it — sort on-site at our Fort Collins facility and take
          everything they pull. Their discards feed our bins. Nothing goes to waste.
        </p>
        <div className="mt-8">
          <Link
            href="/apply"
            className="inline-block bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-8 py-3 rounded transition-colors text-lg"
          >
            Apply to Become a Retail Partner →
          </Link>
        </div>
      </div>

      {/* What is an ad hoc load */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-nct-navy mb-6">What Is an Ad Hoc Pickup?</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="text-gray-700 text-sm leading-relaxed space-y-4">
            <p>
              NCT Recycling operates a scheduled nonprofit co-op network for regular donation
              pickups. Occasionally, outside of that schedule, one-off loads become available —
              these are called <strong>ad hoc pickups</strong>.
            </p>
            <p>
              Ad hoc loads are separate from our regular routes. When one comes in, approved
              retail partners are notified and can claim it. Each load is unique — different
              in size, contents, and location — which is why pricing is negotiated individually
              for each one.
            </p>
            <p>
              This is a first-come opportunity. Loads are posted as they become available
              and claimed by the first approved partner who wants it.
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 text-sm space-y-3">
            <h3 className="font-bold text-nct-navy mb-3">At a Glance</h3>
            <div className="flex gap-3 border-b border-gray-200 pb-2">
              <span className="text-nct-gold font-bold min-w-[100px]">Load Type</span>
              <span className="text-gray-700">Ad hoc pickups only (not scheduled routes)</span>
            </div>
            <div className="flex gap-3 border-b border-gray-200 pb-2">
              <span className="text-nct-gold font-bold min-w-[100px]">Access</span>
              <span className="text-gray-700">Approved retail partners only</span>
            </div>
            <div className="flex gap-3 border-b border-gray-200 pb-2">
              <span className="text-nct-gold font-bold min-w-[100px]">Sorting</span>
              <span className="text-gray-700">On-site at NCT facility, up to 8 hours</span>
            </div>
            <div className="flex gap-3 border-b border-gray-200 pb-2">
              <span className="text-nct-gold font-bold min-w-[100px]">You Keep</span>
              <span className="text-gray-700">Everything you sort and load out</span>
            </div>
            <div className="flex gap-3 border-b border-gray-200 pb-2">
              <span className="text-nct-gold font-bold min-w-[100px]">Discards</span>
              <span className="text-gray-700">Stay with NCT — fed into bins and boutique</span>
            </div>
            <div className="flex gap-3">
              <span className="text-nct-gold font-bold min-w-[100px]">Pricing</span>
              <span className="text-gray-700">Negotiated per load</span>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-nct-navy mb-8 text-center">Why Retail Partners Choose NCT</h2>
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

      {/* Coming soon: portal */}
      <section className="mb-16 bg-nct-gold/10 border border-nct-gold/30 rounded-xl p-8">
        <div className="flex gap-4">
          <span className="text-3xl">🔔</span>
          <div>
            <h3 className="font-bold text-nct-navy text-lg mb-2">Partner Portal — Coming Soon</h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              We're building a retail partner portal where approved partners can view the
              load calendar, see scheduled incoming loads before they arrive, and claim ad
              hoc loads the moment they're posted — all without making a phone call. Apply
              now to be first in line when it launches.
            </p>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-nct-navy mb-8 text-center">Who This Program Is For</h2>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          {[
            {
              icon: "🏪",
              title: "Small Thrift Stores",
              desc: "Restock your floor with a full load sorted by your own team. No middleman, no mystery.",
            },
            {
              icon: "📱",
              title: "High-Volume Resellers",
              desc: "eBay, Poshmark, and Depop sellers who move serious volume and want to control their sourcing.",
            },
            {
              icon: "👗",
              title: "Vintage & Specialty Shops",
              desc: "Curate your own pulls from a full load. You know what sells in your store — sort for it.",
            },
          ].map((item) => (
            <div key={item.title} className="bg-gray-50 rounded-xl p-6">
              <span className="text-4xl block mb-3">{item.icon}</span>
              <h3 className="font-bold text-nct-navy mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="bg-nct-navy text-white rounded-xl p-10 text-center">
        <h2 className="text-2xl font-bold mb-4">Apply to Become a Retail Partner</h2>
        <div className="mt-2 mb-6">
          <Link
            href="/apply"
            className="inline-block bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-8 py-3 rounded transition-colors text-lg"
          >
            Apply Now →
          </Link>
        </div>
        <p className="text-gray-300 mb-6 max-w-lg mx-auto text-sm">
          Retail partnerships are approved on a case-by-case basis. Questions before applying?
          Reach out directly.
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
        <p className="text-gray-400 text-xs mt-6">
          Already a wholesale bin or raw bag buyer?{" "}
          <Link href="/wholesale" className="text-nct-gold hover:underline">
            See our wholesale program →
          </Link>
        </p>
      </div>
    </div>
  );
}
