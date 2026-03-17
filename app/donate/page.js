import Link from "next/link";

export const metadata = {
  title: "Donate Clothing — Fort Collins Drop-Off",
  description:
    "Donate clean, dry clothing 24/7 at NCT Recycling in Fort Collins. Free drop-off, east side of building. 60,000 lbs diverted from landfills monthly. We accept everyday clothing, denim, shoes, outerwear, and more.",
};

const accepted = [
  "Everyday clothing (men's, women's, kids')",
  "Denim — jeans, jackets, shorts",
  "Outerwear — coats, jackets, vests",
  "Shoes, boots, and sandals",
  "Belts, hats, and scarves",
  "Winter gear — gloves, beanies, thermals",
  "Accessories and bags",
];

const notAccepted = [
  "Pillows and pillow cases",
  "Comforters and duvets",
  "Stuffed animals and plush items",
  "Wet, moldy, or heavily soiled items",
  "Items with strong odors",
];

export default function DonatePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-nct-navy mb-4 text-center">Donate Clothing</h1>
      <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto text-lg">
        Your donations stay in Colorado. Through our nonprofit co-op network, donated clothing
        goes directly to families and resellers — and whatever doesn't get reused gets recycled,
        never landfilled.
      </p>

      {/* Impact stat */}
      <div className="bg-nct-navy text-white rounded-xl p-8 mb-16 text-center">
        <p className="text-5xl font-bold text-nct-gold mb-3">60,000 lbs</p>
        <p className="text-xl">diverted from Colorado landfills every single month</p>
        <p className="text-gray-300 mt-2 text-sm">That's 100% of everything we collect — nothing goes to the landfill.</p>
      </div>

      {/* How to donate */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-nct-navy mb-8">How to Donate</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "Bag Your Items",
              desc: "Clean and dry your donations. Place them in bags or boxes — garbage bags work great.",
            },
            {
              step: "2",
              title: "Drop Off Anytime",
              desc: "Drive to 6108 South College Ave STE C, Fort Collins. Our donation receptacles are on the east side of the building, open 24/7.",
            },
            {
              step: "3",
              title: "That's It",
              desc: "No appointment, no forms. We sort everything and direct usable items to nonprofits, boutique, bins, and wholesale buyers.",
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-nct-navy text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-bold text-nct-navy mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Drop-off info */}
      <section className="mb-16 bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-nct-navy mb-4">Drop-Off Location</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <address className="not-italic text-gray-700 space-y-2">
              <p className="font-semibold text-lg">NCT Recycling</p>
              <p>6108 South College Ave, STE C<br />Fort Collins, CO 80525</p>
              <p className="text-nct-gold font-bold mt-3">Donation Drop-Off: 24/7</p>
              <p className="text-sm text-gray-500">Receptacles located on the east side of the building</p>
              <p className="mt-3">
                <a href="tel:+19702329108" className="text-nct-navy hover:text-nct-gold font-medium transition-colors">
                  (970) 232-9108
                </a>
              </p>
              <p>
                <a href="mailto:donate@nctrecycling.com" className="text-nct-navy hover:text-nct-gold font-medium transition-colors">
                  donate@nctrecycling.com
                </a>
              </p>
            </address>
          </div>
          <div>
            <p className="text-gray-600 text-sm leading-relaxed">
              You can drop off donations any time of day or night — no need to visit during
              store hours. Our east-side receptacles are clearly marked.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-3">
              For large-volume donations (business or organizational donations), please call
              or email us in advance so we can make sure we have space.
            </p>
          </div>
        </div>
      </section>

      {/* What we accept */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-nct-navy mb-8">What We Accept</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold text-green-700 mb-4 flex items-center gap-2">
              <span className="text-green-600">✓</span> Accepted Items
            </h3>
            <ul className="space-y-2">
              {accepted.map((item) => (
                <li key={item} className="flex items-start gap-3 text-gray-700 text-sm">
                  <span className="text-green-500 font-bold mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-500 mt-4 italic">
              All items must be clean, dry, and free of strong odors.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-red-700 mb-4 flex items-center gap-2">
              <span className="text-red-500">✗</span> Not Accepted
            </h3>
            <ul className="space-y-2">
              {notAccepted.map((item) => (
                <li key={item} className="flex items-start gap-3 text-gray-700 text-sm">
                  <span className="text-red-400 font-bold mt-0.5">✗</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm text-gray-500 mt-4 italic">
              We cannot export or recycle stuffed and filled items, so we're unable to
              accept them at this time.
            </p>
          </div>
        </div>
      </section>

      {/* Where donations go */}
      <section className="mb-16 bg-nct-navy text-white rounded-xl p-8">
        <h2 className="text-2xl font-bold mb-8">Where Your Donation Goes</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              step: "1",
              label: "Small Businesses",
              desc: "Retail partners, bin shoppers, boutique shoppers, and wholesale buyers get first access. Bins are filled unsorted — no pre-picking, equal shot for everyone.",
            },
            {
              step: "2",
              label: "Nonprofit Partners",
              desc: "Co-op partners — including Homeward Alliance, NOCO Humane, Clothing Cottage, and The Matthew House — send staff to select what their clients need at no cost.",
            },
            {
              step: "3",
              label: "NCT Boutique",
              desc: "Any remaining inventory is curated into our on-site boutique — keeping resellers and shoppers first. It's the last stop before export, not the first.",
            },
            {
              step: "4",
              label: "Export & Industrial Recycling",
              desc: "Whatever remains is baled and sent to industrial textile recyclers — wiping rags, insulation, fiber feedstock. Nothing goes to the landfill.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 bg-white/10 rounded-xl p-5">
              <div className="w-8 h-8 rounded-full bg-nct-gold text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                {item.step}
              </div>
              <div>
                <p className="font-bold text-white mb-1">{item.label}</p>
                <p className="text-gray-300 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-nct-gold font-bold mt-6">
          100% of what we collect stays out of the landfill.
        </p>
      </section>

      {/* Partners */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-nct-navy mb-4">Our Nonprofit Partners</h2>
        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
          Your donation supports a network of Northern Colorado nonprofits through our co-op exchange.
        </p>
        <Link
          href="/nonprofit-partners"
          className="inline-block bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-6 py-3 rounded transition-colors"
        >
          Learn About the Co-op Exchange →
        </Link>
      </section>
    </div>
  );
}
