"use client";
import { useState } from "react";

const CATEGORIES = [
  "Women's Clothing", "Men's Clothing", "Kids' Clothing",
  "Shoes", "Outerwear", "Bedding & Linens", "General Mixed", "Other",
];

const CO_OP_AGREEMENT = `NCT RECYCLING LLC — CO-OP NETWORK PARTICIPATION AGREEMENT

IMPORTANT — READ CAREFULLY BEFORE SIGNING

This is a legally binding contract. By signing below, the Participating Organization acknowledges that it has read, understood, and agrees to all terms and conditions contained in this Agreement, including the liability waiver in Section 9.

1. PARTIES
NCT Recycling LLC ("NCT Recycling"), located at 6108 South College Ave, STE C, Fort Collins, Colorado 80525.
Participating Organization ("Partner"), the nonprofit or community organization identified by signature below.

2. PURPOSE
The NCT Recycling Co-Op Network connects organizations through a coordinated system for textile redistribution. NCT Recycling serves as the central coordinator and logistical moderator.

3. ROLE OF PARTICIPATING ORGANIZATIONS
Partner agrees to: provide donated textiles to NCT Recycling at no cost; meet pickup minimums (1,000 lbs minimum per scheduled pickup); coordinate staff or volunteers for on-site selection when applicable; communicate categories of need; and participate in good faith.

4. EXCHANGE PROGRAM
Approved Partners may source inventory from NCT Recycling through the Exchange Program. Two scheduling options are available:
  (a) In-Person — Bins Visit: Partner sends up to 2 designated volunteers to NCT Recycling's Bins Area during available shopping days. Bins are restocked from incoming loads and available 12:00 PM – 4:00 PM on scheduled shopping days. Partner schedules visits through the Partner Portal; visits are subject to availability (maximum 2 nonprofit volunteer spots per shopping day).
  (b) Delivery: NCT Recycling curates a textile lot and delivers or ships it to Partner. The inventory is provided at no charge; Partner is responsible for covering NCT Recycling's actual labor (sorting and curation) and delivery costs, passed through at cost with no markup. Delivery scheduling is managed through the Partner Portal.
Partner acknowledges that shopping day availability is dependent on NCT Recycling's pickup route schedule and is not guaranteed on any specific day.

5. PICKUP MINIMUMS
Minimum 1,000 lbs of donated textiles required per scheduled pickup. Loads under 4,000 lbs must be scheduled within an existing NCT route. Loads 4,000 lbs or more may be scheduled independently.

6. VALUE EXCHANGE
Partner provides donated textiles at no cost. In exchange, Partner receives warehouse sourcing access, logistics coordination, and community visibility. NCT Recycling donates textile inventory to Partner at no charge, valued at $5.00 per piece for tax receipt purposes. Partner agrees to issue NCT Recycling a written tax donation receipt for each lot received and upload it to their partner portal within 30 days.

7. BAG COUNT REPORTING
Partner agrees to maintain an accurate bag count in their partner portal, updating it whenever their stored donation volume changes. This information is used to plan NCT Recycling pickup routes. Failure to keep bag counts current may result in missed or delayed pickups.

8. 501(c)(3) VERIFICATION
Participation is limited to organizations with verified 501(c)(3) status. Partner must provide an IRS determination letter upon application and notify NCT Recycling of any change in tax-exempt status.

9. LIABILITY WAIVER AND RELEASE OF CLAIMS
Partner, on behalf of itself and all staff and volunteers it sends to the facility, hereby releases, waives, discharges, and covenants not to sue NCT Recycling LLC, its members, managers, officers, employees, agents, successors, and assigns from any and all claims arising out of: any person's presence on NCT Recycling's premises on behalf of Partner; participation in the Program; any injury to person or property on the premises; and transportation to/from NCT Recycling's facilities. This release includes claims arising from ordinary negligence. It does NOT apply to willful and wanton misconduct by NCT Recycling.

10. INDEMNIFICATION
Partner agrees to indemnify, defend, and hold harmless NCT Recycling from any claims, damages, losses, costs, and expenses arising from: any act or negligence of Partner's staff or volunteers on the premises; Partner's violation of this Agreement; any third-party claims from Partner's use or distribution of materials received through the co-op; and any injury to Partner's staff, volunteers, or guests on the premises.

11. WAREHOUSE RULES
All visitors must check in with staff upon arrival. Closed-toe shoes required. No smoking or vaping. Children must be supervised. Access restricted to approved areas unless authorized in writing. Forklift safety: when bale movement is announced, all persons must stop and remain in place until forklift is parked and engine off.

12. TERM AND TERMINATION
Participation may be terminated by either party with 60 days written notice.

13. GOVERNING LAW
State of Colorado. Disputes in Larimer County.`;

export default function NonprofitApplyPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    org_name: "", org_type: "", ein: "",
    contact_name: "", contact_title: "", email: "", phone: "", website: "",
    address_street: "", address_city: "", address_state: "", address_zip: "",
    pickup_address: "", dock_instructions: "", available_pickup_hours: "", pickup_notes: "",
    estimated_donation_lbs: "", categories_needed: [],
    feature_consent: false, irs_letter: null,
    contract_agreed: false, contract_signed_name: "", authorized_title: "",
  });

  function handleChange(e) {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox" && name === "categories_needed") {
      setForm((prev) => ({
        ...prev,
        categories_needed: checked
          ? [...prev.categories_needed, value]
          : prev.categories_needed.filter((v) => v !== value),
      }));
    } else if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else if (type === "file") {
      setForm((prev) => ({ ...prev, [name]: files[0] || null }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  function validateStep1() {
    if (!form.org_name.trim()) return "Organization name is required.";
    if (!form.contact_name.trim()) return "Contact name is required.";
    if (!form.email.trim() || !form.email.includes("@")) return "Valid email is required.";
    if (!form.address_street.trim() || !form.address_city.trim()) return "Organization address is required.";
    if (!form.available_pickup_hours.trim()) return "Available pickup hours are required.";
    return null;
  }

  function handleNext() {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError("");
    setStep(2);
    window.scrollTo(0, 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.contract_agreed) { setError("You must agree to the co-op participation agreement."); return; }
    if (!form.contract_signed_name.trim()) { setError("Please type your full legal name as your signature."); return; }

    setSubmitting(true);
    setError("");

    const data = new FormData();
    Object.entries(form).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        val.forEach((v) => data.append(key, v));
      } else if (val instanceof File) {
        data.append(key, val);
      } else if (val !== null && val !== undefined) {
        data.append(key, String(val));
      }
    });

    try {
      const res = await fetch("/api/nonprofit-apply", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Submission failed. Please try again.");
        setSubmitting(false);
        return;
      }
      setStep(3);
      window.scrollTo(0, 0);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (step === 3) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-nct-navy mb-4">Application Submitted!</h1>
        <p className="text-gray-700 mb-6">
          Thank you, <strong>{form.org_name}</strong>. We've received your co-op application and
          will review it within 3–5 business days. You'll hear from us at{" "}
          <strong>{form.email}</strong>.
        </p>
        <p className="text-gray-500 text-sm">
          Once approved, you'll receive an email invitation to set up your partner portal account,
          where you can schedule exchange appointments and manage your bag count.
        </p>
      </main>
    );
  }

  if (step === 2) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-nct-navy mb-2">Co-Op Participation Agreement</h1>
        <p className="text-gray-600 mb-6">
          Read the full agreement below, then sign on behalf of your organization.
        </p>

        <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 h-96 overflow-y-auto text-sm text-gray-800 font-mono leading-relaxed mb-6 whitespace-pre-wrap">
          {CO_OP_AGREEMENT}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="contract_agreed"
              checked={form.contract_agreed}
              onChange={handleChange}
              className="mt-1 w-5 h-5 accent-nct-gold"
            />
            <span className="text-gray-800 text-sm">
              I have read, understood, and agree to the NCT Recycling Co-Op Network Participation
              Agreement on behalf of the organization named in this application. I understand this
              includes a liability waiver for staff and volunteers visiting NCT Recycling's facility.
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Authorized Representative — Full Legal Name *
              </label>
              <input
                type="text"
                name="contract_signed_name"
                value={form.contract_signed_name}
                onChange={handleChange}
                placeholder="Your full legal name"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 font-serif italic text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Title / Authority</label>
              <input
                type="text"
                name="authorized_title"
                value={form.authorized_title}
                onChange={handleChange}
                placeholder="e.g. Executive Director"
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            By typing your name above, you are signing this agreement electronically on behalf of
            your organization. This is legally equivalent to a handwritten signature.
          </p>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => { setStep(1); window.scrollTo(0, 0); }}
              className="px-6 py-3 border border-gray-400 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-nct-navy mb-2">Nonprofit Co-Op Application</h1>
      <p className="text-gray-600 mb-8">
        Apply to join the NCT Recycling Exchange Program. Once approved, you'll schedule
        sourcing appointments and manage your donation bag count through your partner portal.
        Participation requires verified 501(c)(3) status.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-8">

        {/* Organization Info */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">Organization Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
              <input type="text" name="org_name" value={form.org_name} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Type</label>
              <select name="org_type" value={form.org_type} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Select…</option>
                <option>Nonprofit (501c3)</option>
                <option>Charity</option>
                <option>Thrift Store</option>
                <option>Community Organization</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Federal EIN (Tax ID)</label>
              <input type="text" name="ein" value={form.ein} onChange={handleChange} placeholder="XX-XXXXXXX" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website (optional)</label>
              <input type="text" name="website" value={form.website} onChange={handleChange} placeholder="www.yourorg.org" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IRS 501(c)(3) Determination Letter *
              </label>
              <input type="file" name="irs_letter" onChange={handleChange} accept=".pdf,.jpg,.jpeg,.png" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <p className="text-xs text-gray-500 mt-1">Required. PDF, JPG, or PNG.</p>
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">Primary Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input type="text" name="contact_name" value={form.contact_name} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" name="contact_title" value={form.contact_title} onChange={handleChange} placeholder="e.g. Executive Director" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
        </section>

        {/* Organization Address */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">Organization Address</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
              <input type="text" name="address_street" value={form.address_street} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input type="text" name="address_city" value={form.address_city} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" name="address_state" value={form.address_state} onChange={handleChange} placeholder="CO" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input type="text" name="address_zip" value={form.address_zip} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
            </div>
          </div>
        </section>

        {/* Pickup / Dock Info */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
            Donation Pickup Details
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Tell us where and when NCT Recycling can pick up donated textiles from your location.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Address (if different from organization address)
              </label>
              <input type="text" name="pickup_address" value={form.pickup_address} onChange={handleChange} placeholder="Leave blank if same as above" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Available Pickup Hours *
              </label>
              <input type="text" name="available_pickup_hours" value={form.available_pickup_hours} onChange={handleChange} placeholder="e.g. Mon–Fri 9am–5pm, call ahead required" className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dock / Access Instructions
              </label>
              <textarea name="dock_instructions" value={form.dock_instructions} onChange={handleChange} rows={3} placeholder="Door codes, gate codes, loading dock location, buzzer instructions, etc." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Pickup Notes</label>
              <textarea name="pickup_notes" value={form.pickup_notes} onChange={handleChange} rows={2} placeholder="Any other access restrictions, parking info, or instructions for our driver" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Monthly Donation Volume
              </label>
              <input type="text" name="estimated_donation_lbs" value={form.estimated_donation_lbs} onChange={handleChange} placeholder="e.g. 500 lbs, 10 bags, varies" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
        </section>

        {/* Categories */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
            Clothing Categories Needed
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            What types of clothing does your organization typically need for the clients you serve?
          </p>
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="categories_needed" value={c} checked={form.categories_needed.includes(c)} onChange={handleChange} className="accent-nct-gold" />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Feature consent */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
            Community Recognition (Optional)
          </h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" name="feature_consent" checked={form.feature_consent} onChange={handleChange} className="mt-1 accent-nct-gold" />
            <span className="text-sm text-gray-700">
              I consent to NCT Recycling featuring our organization's name and/or website on the NCT Recycling
              website, social media, and marketing materials as a co-op partner. This consent may be revoked
              at any time by emailing donate@nctrecycling.com.
            </span>
          </label>
        </section>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold px-6 py-4 rounded-lg text-lg transition-colors">
          Continue to Agreement →
        </button>
      </form>
    </main>
  );
}
