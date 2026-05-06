export const metadata = {
  title: "Contact & Hours — Fort Collins, CO",
  description:
    "Visit NCT Emporium at 6108 South College Ave STE C, Fort Collins CO. Boutique Mon–Thu 12–6PM. Bins Tue–Thu + Sunday. 24/7 donation drop-off. Call (970) 232-9108.",
};

export default function ContactPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-nct-navy mb-4 text-center">Contact & Hours</h1>
      <p className="text-center text-gray-600 mb-16 max-w-xl mx-auto">
        Come visit us in Fort Collins. Drop off donations 24/7, or shop the boutique and
        bins Tuesday–Thursday and Sunday.
      </p>

      <div className="grid md:grid-cols-2 gap-12 mb-16">
        {/* Info */}
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold text-nct-navy mb-3">Location</h2>
            <address className="not-italic text-gray-700 space-y-1">
              <p className="font-medium">NCT Recycling</p>
              <p>6108 South College Ave, STE C</p>
              <p>Fort Collins, CO 80525</p>
            </address>
            <a
              href="https://maps.google.com/?q=6108+South+College+Ave+STE+C+Fort+Collins+CO+80525"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-nct-gold hover:underline text-sm font-medium"
            >
              Open in Google Maps →
            </a>
          </div>

          <div>
            <h2 className="text-xl font-bold text-nct-navy mb-3">Hours</h2>
            <table className="text-sm text-gray-700 w-full">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 font-medium text-nct-navy w-1/2">Boutique</td>
                  <td className="py-2">Monday–Thursday, 12PM–6PM<br /><span className="text-xs text-gray-500">Monday = boutique only (no bins)</span></td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 font-medium text-nct-navy">Bins — Resellers</td>
                  <td className="py-2">Tuesday–Thursday, 12PM–4PM<br /><span className="text-xs text-gray-500">Portal scheduling required</span></td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 font-medium text-nct-navy">Bins — Public</td>
                  <td className="py-2">Tuesday–Thursday, 4PM–6PM</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 font-medium text-nct-navy">Sunday Bin Sale</td>
                  <td className="py-2">Sunday, 12PM–4PM<br /><span className="text-xs text-gray-500">Open to everyone · $2.00/lb</span></td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 font-medium text-nct-navy">Closed</td>
                  <td className="py-2">Friday &amp; Saturday</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-nct-navy">Donation Drop-Off</td>
                  <td className="py-2">24/7 (east side of building)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="text-xl font-bold text-nct-navy mb-3">Get in Touch</h2>
            <ul className="space-y-3 text-sm text-gray-700">
              <li>
                <span className="font-medium text-nct-navy">Phone: </span>
                <a href="tel:+19702329108" className="hover:text-nct-gold transition-colors">
                  (970) 232-9108
                </a>
              </li>
              <li>
                <span className="font-medium text-nct-navy">Email: </span>
                <a href="mailto:donate@nctrecycling.com" className="hover:text-nct-gold transition-colors">
                  donate@nctrecycling.com
                </a>
              </li>
              <li>
                <span className="font-medium text-nct-navy">Instagram: </span>
                <a
                  href="https://www.instagram.com/nctemporium"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-nct-gold transition-colors"
                >
                  @nctemporium
                </a>
              </li>
              <li>
                <span className="font-medium text-nct-navy">Facebook: </span>
                <a
                  href="https://www.facebook.com/nctrecycling"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-nct-gold transition-colors"
                >
                  @nctrecycling
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Map embed */}
        <div className="rounded-xl overflow-hidden shadow-lg h-96 md:h-auto">
          <iframe
            title="NCT Recycling location map"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3031.2!2d-105.0777!3d40.5271!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2s6108+South+College+Ave+STE+C+Fort+Collins+CO+80525!5e0!3m2!1sen!2sus!4v1234567890"
            width="100%"
            height="100%"
            style={{ border: 0, minHeight: "350px" }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-3 gap-6 text-center">
        {[
          {
            title: "Donating?",
            desc: "See what we accept and drop-off instructions.",
            href: "/donate",
            cta: "Donation Guidelines",
          },
          {
            title: "Shopping?",
            desc: "Learn about the boutique, bins, and raw bags.",
            href: "/shop",
            cta: "How to Shop",
          },
          {
            title: "Reseller buying?",
            desc: "Apply for a reseller buyer account — online curated lots, optional warehouse access.",
            href: "/apply",
            cta: "Apply to Buy",
          },
        ].map((item) => (
          <div key={item.title} className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-bold text-nct-navy mb-2">{item.title}</h3>
            <p className="text-sm text-gray-600 mb-4">{item.desc}</p>
            <a
              href={item.href}
              className="text-nct-gold hover:underline text-sm font-medium"
            >
              {item.cta} →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
