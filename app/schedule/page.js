import Link from "next/link";
import PublicCalendar from "@/components/PublicCalendar";

export const metadata = {
  title: "Hours & Schedule — NCT Emporium",
  description:
    "NCT Emporium open hours: boutique Mon–Thu 12–8PM, pound bins Tue–Thu, Sunday Bin Sale every Sunday 12–4PM. No login required.",
};

export default function SchedulePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      <h1 className="text-4xl font-bold text-nct-navy mb-3 text-center">Hours & Schedule</h1>
      <p className="text-center text-gray-600 mb-10 max-w-xl mx-auto">
        Our boutique is open Monday–Thursday. Bin days are route-dependent — check the calendar below
        or just come Sunday when bins are always open.
      </p>

      {/* Quick reference */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-nct-navy text-white rounded-2xl p-5">
          <p className="text-nct-gold font-bold text-xs uppercase tracking-wide mb-2">Boutique</p>
          <p className="font-bold text-lg">Mon – Thu</p>
          <p className="text-gray-300 text-sm mt-1">12PM – 8PM · No booking</p>
          <p className="text-gray-400 text-xs mt-1">Retail thrift prices</p>
        </div>
        <div className="bg-blue-700 text-white rounded-2xl p-5">
          <p className="text-blue-200 font-bold text-xs uppercase tracking-wide mb-2">Pound Bins</p>
          <p className="font-bold text-lg">Tue – Thu</p>
          <p className="text-gray-200 text-sm mt-1">Resellers 12–4PM · Public 4–8PM</p>
          <p className="text-gray-300 text-xs mt-1">Route-dependent · $2/lb</p>
        </div>
        <div className="bg-nct-gold text-white rounded-2xl p-5">
          <p className="text-white/80 font-bold text-xs uppercase tracking-wide mb-2">Sunday Bin Sale</p>
          <p className="font-bold text-lg">Every Sunday</p>
          <p className="text-white/90 text-sm mt-1">12PM – 4PM · Open to all</p>
          <p className="text-white/70 text-xs mt-1">$2/lb · No account needed</p>
        </div>
      </div>

      {/* Closed note */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 text-center mb-10">
        Closed Fridays, Saturdays, and major holidays (New Year's Day, Memorial Day, July 4, Labor Day, Thanksgiving, Christmas).
      </div>

      {/* Live calendar */}
      <PublicCalendar />

      {/* CTAs */}
      <div className="mt-12 grid sm:grid-cols-2 gap-4 text-center">
        <div className="bg-gray-50 rounded-xl p-6">
          <p className="font-bold text-nct-navy mb-2">Want reseller access?</p>
          <p className="text-sm text-gray-500 mb-4">Get early bin access Tue–Thu 12–4PM and book your slot in advance.</p>
          <Link href="/apply" className="inline-block bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
            Apply for Reseller Access →
          </Link>
        </div>
        <div className="bg-gray-50 rounded-xl p-6">
          <p className="font-bold text-nct-navy mb-2">6108 South College Ave STE C</p>
          <p className="text-sm text-gray-500 mb-4">Fort Collins, CO 80525 · (970) 232-9108</p>
          <Link href="/contact" className="inline-block bg-nct-navy hover:bg-nct-navy-dark text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
            Get Directions →
          </Link>
        </div>
      </div>
    </div>
  );
}
