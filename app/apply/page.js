"use client";
import { useState } from "react";
import Link from "next/link";

const PLATFORMS = ["eBay", "Poshmark", "Depop", "Mercari", "Facebook Marketplace", "Etsy", "Other"];
const CATEGORIES = [
  "General Women's Clothing",
  "General Men's Clothing",
  "Kids' Clothing",
  "Vintage T-Shirts",
  "Y2K",
  "Denim",
  "Shoes",
  "Outerwear",
  "Upcycling Material",
  "Other",
];

const CONTRACT_TEXT = `NCT RECYCLING LLC — PARTNER ACCESS & INDEPENDENT CONTRACTOR AGREEMENT

IMPORTANT — READ CAREFULLY BEFORE SIGNING

This is a legally binding contract. By signing below, you acknowledge that you have read, understood, and agree to all terms and conditions contained in this Agreement. You are giving up certain legal rights, including the right to sue NCT Recycling LLC for injuries, accidents, or losses that may occur on the premises or in connection with your participation as a Partner.

1. PARTIES
NCT Recycling LLC ("NCT Recycling"), a Colorado limited liability company located at 6108 South College Ave, STE C, Fort Collins, Colorado 80525.
Partner/Applicant ("Partner"), the individual or business entity identified by signature below.

2. INDEPENDENT CONTRACTOR STATUS
Partner is an independent contractor and not an employee, agent, joint venturer, or partner of NCT Recycling. Partner is responsible for all taxes arising from their own business activities. NCT Recycling does not control Partner's business hours, pricing, or methods. Partner is free to engage in similar activities with other organizations.

3. INSURANCE REQUIREMENTS
NCT Recycling's workers' compensation insurance does not cover Partner. Partner is solely responsible for obtaining any insurance coverage they deem appropriate, including general liability, occupational accident, and health insurance.

4. ASSUMPTION OF RISK
Partner acknowledges that warehouse access involves inherent risks including: slips/trips/falls, injuries from handling or lifting goods, injuries from warehouse equipment, property damage, exposure to allergens or unsanitary materials, and incidents during loading/unloading. Partner freely and voluntarily assumes all such risks.

5. RELEASE AND WAIVER OF LIABILITY
In consideration of being granted access to NCT Recycling's facility, Partner hereby releases, waives, discharges, and covenants not to sue NCT Recycling LLC, its members, managers, officers, employees, agents, successors, and assigns from any and all claims arising out of: Partner's presence on or access to the premises, participation in the Program, any injury to person or property on premises, and transportation to/from the facility. This release includes claims arising from ordinary negligence. It does NOT apply to willful and wanton misconduct or intentional misconduct by NCT Recycling.

6. INDEMNIFICATION
Partner agrees to indemnify, defend, and hold harmless NCT Recycling from any claims, damages, losses, costs, and expenses (including attorneys' fees) arising from: Partner's negligence or omissions on the premises, Partner's violation of this Agreement, Partner's business activities with sourced inventory, any third-party claims from Partner's resale or use of inventory, and any injury to Partner or Partner's employees, agents, or guests on the premises. This indemnification is not limited by Colorado's anti-indemnity statute (C.R.S. § 13-21-111.5(6)), which applies exclusively to construction agreements and has no application to this textile sourcing warehouse access agreement.

7. WAREHOUSE RULES
Partner agrees to: check in with staff upon arrival; wear closed-toe shoes at all times; no smoking/vaping anywhere on premises; supervise children at all times; follow all staff directions; not access restricted areas; weigh and pay for all inventory before leaving; not resell or trade inventory on-site; clean up work area before leaving. NCT Recycling reserves the right to revoke access at any time.

8. INVENTORY
All inventory is sold "as-is, where-is" with no warranties. All sales are final. No returns or refunds. Partner is responsible for collecting and remitting all applicable sales taxes on inventory they resell.

9. GOVERNING LAW
This Agreement is governed by the laws of the State of Colorado. Disputes shall be resolved in Larimer County, Colorado.`;

export default function ApplyPage() {
  const [step, setStep] = useState(1); // 1: info, 2: contract, 3: success
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    business_name: "",
    email: "",
    phone: "",
    program_type: "reseller",
    platforms: [],
    website: "",
    visit_frequency: "",
    expected_spend: "",
    categories: [],
    tax_license_number: "",
    estimated_monthly_volume: "",
    business_type: "",
    shop_name_to_feature: "",
    feature_consent: false,
    dr0563_file: null,
    contract_agreed: false,
    contract_signed_name: "",
  });

  function handleChange(e) {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox" && (name === "platforms" || name === "categories")) {
      setForm((prev) => ({
        ...prev,
        [name]: checked
          ? [...prev[name], value]
          : prev[name].filter((v) => v !== value),
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
    if (!form.full_name.trim()) return "Full name is required.";
    if (!form.email.trim() || !form.email.includes("@")) return "Valid email is required.";
    if ((form.program_type === "wholesale" || form.program_type === "both") && !form.tax_license_number.trim()) {
      return "Colorado Sales Tax License Number is required for wholesale buyers.";
    }
    if (form.categories.length > 3) return "Select up to 3 categories.";
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
    if (!form.contract_agreed) { setError("You must agree to the contract to proceed."); return; }
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
      const res = await fetch("/api/apply", { method: "POST", body: data });
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

  const needsWholesale = form.program_type === "wholesale" || form.program_type === "both";

  if (step === 3) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-nct-navy mb-4">Application Submitted!</h1>
        <p className="text-gray-700 mb-6">
          Thank you, <strong>{form.full_name}</strong>. We've received your application and will review it
          within 2–3 business days. You'll hear from us at <strong>{form.email}</strong>.
        </p>
        <p className="text-gray-600 text-sm mb-8">
          You can check your application status at any time using the link below.
        </p>
        <Link
          href="/apply/status"
          className="bg-nct-navy text-white font-bold px-6 py-3 rounded hover:bg-nct-navy-dark transition-colors"
        >
          Check Application Status
        </Link>
      </main>
    );
  }

  if (step === 2) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-nct-navy mb-2">Partner Agreement</h1>
        <p className="text-gray-600 mb-6">
          Read the full agreement below, then type your full legal name to sign.
        </p>

        {/* Contract scroll box */}
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 h-96 overflow-y-auto text-sm text-gray-800 font-mono leading-relaxed mb-6 whitespace-pre-wrap">
          {CONTRACT_TEXT}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Checkbox agreement */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="contract_agreed"
              checked={form.contract_agreed}
              onChange={handleChange}
              className="mt-1 w-5 h-5 accent-nct-gold"
            />
            <span className="text-gray-800 text-sm">
              I have read, understood, and agree to the NCT Recycling Partner Access &amp; Independent
              Contractor Agreement in its entirety. I understand I am giving up certain legal rights.
            </span>
          </label>

          {/* Typed signature */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Electronic Signature — Type Your Full Legal Name *
            </label>
            <input
              type="text"
              name="contract_signed_name"
              value={form.contract_signed_name}
              onChange={handleChange}
              placeholder="Your full legal name"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 font-serif italic text-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              By typing your name above, you are signing this agreement electronically. This is legally
              equivalent to a handwritten signature.
            </p>
          </div>

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

  // Step 1 — Info form
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-nct-navy mb-2">Partner Application</h1>
      <p className="text-gray-600 mb-8">
        Apply to access NCT Recycling's warehouse sourcing program. All applications are reviewed
        before access is granted.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-8">

        {/* Program Type */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
            Program Type *
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { val: "reseller", label: "Bin Shopper / Reseller", desc: "$2/lb — sort at facility" },
              { val: "wholesale", label: "Wholesale Buyer", desc: "$0.30/lb raw weight bags" },
              { val: "both", label: "Both Programs", desc: "Reseller + wholesale access" },
            ].map(({ val, label, desc }) => (
              <label
                key={val}
                className={`flex flex-col gap-1 border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  form.program_type === val
                    ? "border-nct-gold bg-yellow-50"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <input
                  type="radio"
                  name="program_type"
                  value={val}
                  checked={form.program_type === val}
                  onChange={handleChange}
                  className="sr-only"
                />
                <span className="font-semibold text-nct-navy">{label}</span>
                <span className="text-xs text-gray-600">{desc}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Contact Info */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
            Contact Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Legal Name *</label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business / Shop Name</label>
              <input
                type="text"
                name="business_name"
                value={form.business_name}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </section>

        {/* Reseller Info */}
        {(form.program_type === "reseller" || form.program_type === "both") && (
          <section>
            <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
              Reseller Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selling Platforms (check all that apply)
                </label>
                <div className="flex flex-wrap gap-3">
                  {PLATFORMS.map((p) => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="platforms"
                        value={p}
                        checked={form.platforms.includes(p)}
                        onChange={handleChange}
                        className="accent-nct-gold"
                      />
                      <span className="text-sm">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website / Shop URL (optional)
                </label>
                <input
                  type="url"
                  name="website"
                  value={form.website}
                  onChange={handleChange}
                  placeholder="https://"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Visit Frequency
                  </label>
                  <select
                    name="visit_frequency"
                    value={form.visit_frequency}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select…</option>
                    <option>Weekly</option>
                    <option>Bi-weekly</option>
                    <option>Monthly</option>
                    <option>As available</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Spend per Session
                  </label>
                  <select
                    name="expected_spend"
                    value={form.expected_spend}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select…</option>
                    <option>Under $100</option>
                    <option>$100–$250</option>
                    <option>$250–$500</option>
                    <option>$500+</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Categories of Interest (up to 3)
                </label>
                <div className="flex flex-wrap gap-3">
                  {CATEGORIES.map((c) => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="categories"
                        value={c}
                        checked={form.categories.includes(c)}
                        onChange={handleChange}
                        disabled={!form.categories.includes(c) && form.categories.length >= 3}
                        className="accent-nct-gold"
                      />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Wholesale Info */}
        {needsWholesale && (
          <section>
            <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
              Wholesale Details
            </h2>
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4 text-sm text-amber-800">
              <strong>Colorado Tax Exemption Required:</strong> Wholesale purchases require a valid
              Colorado Sales Tax License. Please upload your Form DR 0563 (Resale Certificate).
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colorado Sales Tax License Number *
                  </label>
                  <input
                    type="text"
                    name="tax_license_number"
                    value={form.tax_license_number}
                    onChange={handleChange}
                    placeholder="00-0000000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Monthly Volume
                  </label>
                  <input
                    type="text"
                    name="estimated_monthly_volume"
                    value={form.estimated_monthly_volume}
                    onChange={handleChange}
                    placeholder="e.g. 500 lbs, 10 bags"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                <select
                  name="business_type"
                  value={form.business_type}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select…</option>
                  <option>Online reseller</option>
                  <option>Retail thrift store</option>
                  <option>Exporter</option>
                  <option>Upcycler</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Form DR 0563 (Resale Certificate)
                </label>
                <input
                  type="file"
                  name="dr0563_file"
                  onChange={handleChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  PDF, JPG, or PNG. You can still submit without it and email it later to{" "}
                  <a href="mailto:donate@nctrecycling.com" className="text-nct-navy underline">
                    donate@nctrecycling.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Feature Consent */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
            Feature Your Business (Optional)
          </h2>
          <label className="flex items-start gap-3 cursor-pointer mb-3">
            <input
              type="checkbox"
              name="feature_consent"
              checked={form.feature_consent}
              onChange={handleChange}
              className="mt-1 accent-nct-gold"
            />
            <span className="text-sm text-gray-700">
              I consent to NCT Recycling featuring my business name, shop name, and/or website on the
              NCT Recycling website, social media, and marketing materials. I can revoke this at any time
              by emailing donate@nctrecycling.com.
            </span>
          </label>
          {form.feature_consent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shop Name to Feature
              </label>
              <input
                type="text"
                name="shop_name_to_feature"
                value={form.shop_name_to_feature}
                onChange={handleChange}
                placeholder="The name you'd like us to display"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          )}
        </section>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold px-6 py-4 rounded-lg text-lg transition-colors"
        >
          Continue to Agreement →
        </button>
      </form>
    </main>
  );
}
