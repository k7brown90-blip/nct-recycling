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

export default function ApplyForm({ agreement }) {
  // step 1: info, 2: contract (only if warehouse), 3: success
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    business_name: "",
    email: "",
    phone: "",
    platforms: [],
    website: "",
    visit_frequency: "",
    expected_spend: "",
    categories: [],
    shop_name_to_feature: "",
    feature_consent: false,
    wants_warehouse_access: "no", // 'yes' | 'no'
    contract_agreed: false,
    contract_signed_name: "",
  });

  const wantsWarehouse = form.wants_warehouse_access === "yes";

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox" && (name === "platforms" || name === "categories")) {
      setForm((prev) => ({
        ...prev,
        [name]: checked ? [...prev[name], value] : prev[name].filter((v) => v !== value),
      }));
    } else if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  function validateStep1() {
    if (!form.full_name.trim()) return "Full name is required.";
    if (!form.email.trim() || !form.email.includes("@")) return "Valid email is required.";
    if (form.categories.length > 3) return "Select up to 3 categories.";
    return null;
  }

  async function submitApplication(e) {
    if (e) e.preventDefault();
    if (wantsWarehouse) {
      if (!form.contract_agreed) { setError("You must agree to the Reseller Buyer Agreement to proceed."); return; }
      if (!form.contract_signed_name.trim()) { setError("Please type your full legal name as your signature."); return; }
    }

    setSubmitting(true);
    setError("");

    const data = new FormData();
    Object.entries(form).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        val.forEach((v) => data.append(key, v));
      } else if (val !== null && val !== undefined) {
        data.append(key, String(val));
      }
    });

    try {
      const res = await fetch("/api/apply", { method: "POST", body: data });
      let json;
      try { json = await res.json(); } catch { json = {}; }
      if (!res.ok) {
        if (res.status === 409) {
          setError("An application with this email already exists. If you already applied, check your inbox or contact donate@nctrecycling.com.");
        } else {
          setError(json.error || "Submission failed. Please try again or email donate@nctrecycling.com.");
        }
        setSubmitting(false);
        return;
      }
      setStep(3);
      window.scrollTo(0, 0);
    } catch {
      setError("Unable to reach the server. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  function handleNext() {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError("");
    if (wantsWarehouse) {
      setStep(2);
      window.scrollTo(0, 0);
    } else {
      // No warehouse access requested → submit directly (online-only buyer).
      submitApplication();
    }
  }

  if (step === 3) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-nct-navy mb-4">
          {wantsWarehouse ? "Application Submitted!" : "You’re Approved!"}
        </h1>
        <p className="text-gray-700 mb-6">
          Thank you, <strong>{form.full_name}</strong>.
          {wantsWarehouse ? (
            <> We’ve received your application and will review your warehouse access request within 2–3 business days. You’ll hear from us at <strong>{form.email}</strong>.</>
          ) : (
            <> Your online buyer account is approved. You’ll get an email at <strong>{form.email}</strong> with sign-in details so you can start shopping curated drops in the reseller store.</>
          )}
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
        <h1 className="text-3xl font-bold text-nct-navy mb-2">Reseller Buyer Agreement</h1>
        <p className="text-gray-600 mb-2">
          Read the full agreement below, then type your full legal name to sign.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Version: {agreement?.version_label || "buyer_v1"}
        </p>

        <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 h-96 overflow-y-auto text-sm text-gray-800 font-mono leading-relaxed mb-6 whitespace-pre-wrap">
          {agreement?.body_text || "Agreement text unavailable. Contact donate@nctrecycling.com."}
        </div>

        <form onSubmit={submitApplication} className="space-y-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="contract_agreed"
              checked={form.contract_agreed}
              onChange={handleChange}
              className="mt-1 w-5 h-5 accent-nct-gold"
            />
            <span className="text-gray-800 text-sm">
              I have read, understood, and agree to the NCT Recycling Reseller Buyer Agreement in its entirety. I understand I am giving up certain legal rights, including the right to sue for ordinary negligence on the premises.
            </span>
          </label>

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
              By typing your name above you are signing this agreement electronically.
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
              {submitting ? "Submitting…" : "Sign & Submit Application"}
            </button>
          </div>
        </form>
      </main>
    );
  }

  // Step 1
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-nct-navy mb-2">Reseller Buyer Application</h1>
      <p className="text-gray-600 mb-8">
        Apply for a reseller buyer account. Online-only buyers are approved automatically. Warehouse
        on-premises sorting access requires the Reseller Buyer Agreement and admin review.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-8">

        {/* Warehouse access toggle */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
            Access Level *
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { val: "no", label: "Online Buyer Only", desc: "Curated drops & lots through the online store. Auto-approved." },
              { val: "yes", label: "Online + Warehouse Access", desc: "Also request on-premises sorting access. Requires signed Buyer Agreement and admin review." },
            ].map(({ val, label, desc }) => (
              <label
                key={val}
                className={`flex flex-col gap-1 border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  form.wants_warehouse_access === val
                    ? "border-nct-gold bg-yellow-50"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <input
                  type="radio"
                  name="wants_warehouse_access"
                  value={val}
                  checked={form.wants_warehouse_access === val}
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
              <input type="text" name="full_name" value={form.full_name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business / Shop Name</label>
              <input type="text" name="business_name" value={form.business_name} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
        </section>

        {/* Reseller Details */}
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
                    <input type="checkbox" name="platforms" value={p}
                      checked={form.platforms.includes(p)} onChange={handleChange} className="accent-nct-gold" />
                    <span className="text-sm">{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website / Shop URL (optional)</label>
              <input type="text" name="website" value={form.website} onChange={handleChange}
                placeholder="www.yourshop.com" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Visit Frequency</label>
                <select name="visit_frequency" value={form.visit_frequency} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">Select…</option>
                  <option>Weekly</option>
                  <option>Bi-weekly</option>
                  <option>Monthly</option>
                  <option>As available</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Spend per Order</label>
                <select name="expected_spend" value={form.expected_spend} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2">
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
                    <input type="checkbox" name="categories" value={c}
                      checked={form.categories.includes(c)} onChange={handleChange}
                      disabled={!form.categories.includes(c) && form.categories.length >= 3}
                      className="accent-nct-gold" />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Consent */}
        <section>
          <h2 className="text-lg font-bold text-nct-navy border-b border-gray-200 pb-2 mb-4">
            Feature Your Business (Optional)
          </h2>
          <label className="flex items-start gap-3 cursor-pointer mb-3">
            <input type="checkbox" name="feature_consent" checked={form.feature_consent}
              onChange={handleChange} className="mt-1 accent-nct-gold" />
            <span className="text-sm text-gray-700">
              I consent to NCT Recycling featuring my business name, shop name, and/or website on the
              NCT Recycling website, social media, and marketing materials. I can revoke this at any time
              by emailing donate@nctrecycling.com.
            </span>
          </label>
          {form.feature_consent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name to Feature</label>
              <input type="text" name="shop_name_to_feature" value={form.shop_name_to_feature}
                onChange={handleChange} placeholder="The name you'd like us to display"
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          )}
        </section>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold px-6 py-4 rounded-lg text-lg transition-colors disabled:opacity-50"
        >
          {wantsWarehouse
            ? "Continue to Buyer Agreement →"
            : submitting
              ? "Submitting…"
              : "Submit Application"}
        </button>
      </form>
    </main>
  );
}
