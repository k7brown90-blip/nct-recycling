"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

function Field({ label, name, value, onChange, type = "text", placeholder = "", hint = "" }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nct-navy/30 focus:border-nct-navy transition"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function AccountSettingsForm({ role, appData, program, email }) {
  // Profile fields — prefill from existing application data
  const [profile, setProfile] = useState({
    // Nonprofit
    contact_name:          appData?.contact_name          || "",
    contact_title:         appData?.contact_title         || "",
    phone:                 appData?.phone                 || "",
    website:               appData?.website               || "",
    address_street:        appData?.address_street        || "",
    address_city:          appData?.address_city          || "",
    address_state:         appData?.address_state         || "",
    address_zip:           appData?.address_zip           || "",
    available_pickup_hours: appData?.available_pickup_hours || "",
    dock_instructions:     appData?.dock_instructions     || "",
    // Discard
    org_name:              program?.legalName             || appData?.org_name || "",
    contact_email:         appData?.contact_email         || email || "",
    contact_phone:         appData?.contact_phone         || "",
    // Reseller
    full_name:             appData?.full_name             || "",
    business_name:         appData?.business_name         || "",
  });

  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Password fields
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setProfile((p) => ({ ...p, [name]: value }));
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg("");

    const body = role === "nonprofit"
      ? {
          contact_name: profile.contact_name,
          contact_title: profile.contact_title,
          phone: profile.phone,
          website: profile.website,
          address_street: profile.address_street,
          address_city: profile.address_city,
          address_state: profile.address_state,
          address_zip: profile.address_zip,
          available_pickup_hours: profile.available_pickup_hours,
          dock_instructions: profile.dock_instructions,
        }
      : role === "discard"
        ? {
            org_name: profile.org_name,
            contact_name: profile.contact_name,
            contact_email: profile.contact_email,
            contact_phone: profile.contact_phone,
            address_street: profile.address_street,
            address_city: profile.address_city,
            address_state: profile.address_state,
            address_zip: profile.address_zip,
          }
      : {
          full_name: profile.full_name,
          business_name: profile.business_name,
          phone: profile.phone,
          website: profile.website,
        };

    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    setProfileMsg(res.ok ? "✅ Profile updated." : `Error: ${json.error}`);
    setProfileLoading(false);
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault();
    setPwMsg("");

    if (password.length < 8) { setPwMsg("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setPwMsg("Passwords don't match."); return; }

    setPwLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setPwMsg("Failed to update password. Please try again.");
    } else {
      setPwMsg("✅ Password updated successfully.");
      setPassword("");
      setConfirm("");
    }
    setPwLoading(false);
  }

  const isNonprofit = role === "nonprofit";
  const isDiscard = role === "discard";

  return (
    <div className="space-y-6">

      {/* ── Profile Information ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-nct-navy mb-1">Profile Information</h2>
        <p className="text-sm text-gray-500 mb-6">
          This information is used by NCT Recycling to coordinate pickups and communicate with your organization.
        </p>

        <form onSubmit={handleProfileSave} className="space-y-5">

          {isNonprofit ? (
            <>
              {/* Point of Contact */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Point of Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Contact Name" name="contact_name" value={profile.contact_name} onChange={handleChange} placeholder="Jane Smith" />
                  <Field label="Title / Role" name="contact_title" value={profile.contact_title} onChange={handleChange} placeholder="Executive Director" />
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (Login)</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">To change your email, contact NCT Recycling.</p>
                  </div>
                  <Field label="Phone" name="phone" value={profile.phone} onChange={handleChange} type="tel" placeholder="(970) 555-0100" />
                </div>
                <div className="mt-4">
                  <Field label="Website" name="website" value={profile.website} onChange={handleChange} placeholder="https://yourorg.org" />
                </div>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pickup Address</p>
                <div className="space-y-3">
                  <Field label="Street Address" name="address_street" value={profile.address_street} onChange={handleChange} placeholder="123 Main St" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field label="City" name="address_city" value={profile.address_city} onChange={handleChange} placeholder="Fort Collins" />
                    <Field label="State" name="address_state" value={profile.address_state} onChange={handleChange} placeholder="CO" />
                    <Field label="ZIP" name="address_zip" value={profile.address_zip} onChange={handleChange} placeholder="80525" />
                  </div>
                </div>
              </div>

              {/* Logistics */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pickup Logistics</p>
                <div className="space-y-3">
                  <Field
                    label="Available Pickup Hours"
                    name="available_pickup_hours"
                    value={profile.available_pickup_hours}
                    onChange={handleChange}
                    placeholder="e.g. Mon–Fri 9am–4pm"
                  />
                  <Field
                    label="Dock / Access Instructions"
                    name="dock_instructions"
                    value={profile.dock_instructions}
                    onChange={handleChange}
                    placeholder="e.g. Ring bell at east entrance, loading dock behind building"
                  />
                </div>
              </div>
            </>
          ) : isDiscard ? (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Organization</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Organization Name" name="org_name" value={profile.org_name} onChange={handleChange} placeholder="Partner Organization" />
                  <Field label="Contact Name" name="contact_name" value={profile.contact_name} onChange={handleChange} placeholder="Jane Smith" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Contact Email" name="contact_email" value={profile.contact_email} onChange={handleChange} type="email" placeholder="partner@example.com" />
                  <Field label="Phone" name="contact_phone" value={profile.contact_phone} onChange={handleChange} type="tel" placeholder="(970) 555-0100" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pickup Address</p>
                <div className="space-y-3">
                  <Field label="Street Address" name="address_street" value={profile.address_street} onChange={handleChange} placeholder="123 Main St" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Field label="City" name="address_city" value={profile.address_city} onChange={handleChange} placeholder="Fort Collins" />
                    <Field label="State" name="address_state" value={profile.address_state} onChange={handleChange} placeholder="CO" />
                    <Field label="ZIP" name="address_zip" value={profile.address_zip} onChange={handleChange} placeholder="80525" />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Reseller fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" name="full_name" value={profile.full_name} onChange={handleChange} placeholder="Jane Smith" />
                <Field label="Business Name" name="business_name" value={profile.business_name} onChange={handleChange} placeholder="Smith Resale Co." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (Login)</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">To change your email, contact NCT Recycling.</p>
                </div>
                <Field label="Phone" name="phone" value={profile.phone} onChange={handleChange} type="tel" placeholder="(970) 555-0100" />
              </div>
              <Field label="Website" name="website" value={profile.website} onChange={handleChange} placeholder="https://yourstore.com" />
            </>
          )}

          {profileMsg && (
            <p className={`text-sm font-medium ${profileMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {profileMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={profileLoading}
            className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {profileLoading ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>

      {/* ── Change Password ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-nct-navy mb-1">Change Password</h2>
        <p className="text-sm text-gray-500 mb-6">Update your login password.</p>

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <Field
            label="New Password"
            name="new_password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            hint="Minimum 8 characters"
          />
          <Field
            label="Confirm New Password"
            name="confirm_password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
          />

          {pwMsg && (
            <p className={`text-sm font-medium ${pwMsg.startsWith("Error") || pwMsg.startsWith("Failed") || pwMsg.startsWith("Password") ? "text-red-600" : "text-green-600"}`}>
              {pwMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {pwLoading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>

    </div>
  );
}
