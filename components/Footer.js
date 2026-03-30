import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-nct-navy text-white mt-20">
      <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* About */}
        <div>
          <h3 className="text-nct-gold font-bold text-lg mb-3">NCT Recycling</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Fort Collins' textile reuse hub. Every pound donated stays in Colorado — none goes to the landfill.
          </p>
          <div className="flex gap-4 mt-4">
            <a
              href="https://www.instagram.com/nct_emporium"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-nct-gold text-sm transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/nct_emporium"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-nct-gold text-sm transition-colors"
            >
              Facebook
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-nct-gold font-bold text-lg mb-3">Quick Links</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li><Link href="/shop" className="hover:text-nct-gold transition-colors">Shop / How to Buy</Link></li>
            <li><Link href="/donate" className="hover:text-nct-gold transition-colors">Donate Clothing</Link></li>
            <li><Link href="/partners" className="hover:text-nct-gold transition-colors">Partner Network</Link></li>
            <li><Link href="/partners#nonprofit" className="hover:text-nct-gold transition-colors">Nonprofit Co-op</Link></li>
            <li><Link href="/partners#retail" className="hover:text-nct-gold transition-colors">Retail Partners</Link></li>
            <li><Link href="/partners#wholesale" className="hover:text-nct-gold transition-colors">Wholesale Buyers</Link></li>
            <li><Link href="/contact" className="hover:text-nct-gold transition-colors">Contact Us</Link></li>
            <li><Link href="/nonprofit-apply" className="hover:text-nct-gold transition-colors">Co-op Application</Link></li>
            <li><Link href="/apply" className="hover:text-nct-gold transition-colors">Retail Application</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-nct-gold font-bold text-lg mb-3">Visit Us</h3>
          <address className="not-italic text-sm text-gray-300 space-y-2">
            <p>6108 South College Ave, STE C<br />Fort Collins, CO 80525</p>
            <p>
              <span className="text-white font-medium">Hours:</span><br />
              Mon–Thu 12–8PM (Boutique)<br />
              Tue–Thu 12–4PM (Resellers) · 4–8PM (Public)<br />
              Sunday 12–4PM (Bins, open to all)<br />
              Closed Fri &amp; Sat
            </p>
            <p>
              <a href="tel:+19702329108" className="hover:text-nct-gold transition-colors">(970) 232-9108</a>
            </p>
            <p>
              <a href="mailto:donate@nctrecycling.com" className="hover:text-nct-gold transition-colors">donate@nctrecycling.com</a>
            </p>
            <p className="text-xs text-gray-400 pt-1">24/7 donation drop-off available (east side of building)</p>
          </address>
        </div>
      </div>

      <div className="border-t border-white/10 text-center py-4 text-xs text-gray-400">
        © {new Date().getFullYear()} NCT Recycling — Fort Collins, CO. All rights reserved.
      </div>
    </footer>
  );
}
