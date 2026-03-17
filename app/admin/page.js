"use client";
import { useState, useEffect, useCallback } from "react";

const STATUS_COLORS = {
  pending:     "bg-yellow-100 text-yellow-800",
  approved:    "bg-green-100 text-green-800",
  denied:      "bg-red-100 text-red-800",
  requested:   "bg-yellow-100 text-yellow-800",
  scheduled:   "bg-blue-100 text-blue-800",
  completed:   "bg-green-100 text-green-800",
  cancelled:   "bg-gray-100 text-gray-600",
  in_progress: "bg-purple-100 text-purple-800",
};

const SECTIONS = ["Reseller Apps", "Nonprofit Apps", "Bag Levels", "Routes", "Exchange Appts", "Shopping Days"];

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [section, setSection] = useState("Reseller Apps");
  const [message, setMessage] = useState("");

  // Applications state
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Bag levels state
  const [bagLevels, setBagLevels] = useState([]);

  // Routes state
  const [routes, setRoutes] = useState([]);
  const [routeFilter, setRouteFilter] = useState("scheduled");
  const [buildingRoute, setBuildingRoute] = useState(false);
  const [routeDate, setRouteDate] = useState("");
  const [routeTime, setRouteTime] = useState("");
  const [routeNotes, setRouteNotes] = useState("");
  const [routeStops, setRouteStops] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);

  // Exchange appointments state
  const [appointments, setAppointments] = useState([]);
  const [apptFilter, setApptFilter] = useState("requested");
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [apptAdminNotes, setApptAdminNotes] = useState("");
  const [apptLoading, setApptLoading] = useState(false);

  // Shopping days state
  const [shoppingDays, setShoppingDays] = useState([]);
  const [shoppingFilter, setShoppingFilter] = useState("upcoming");

  const isNonprofit = section === "Nonprofit Apps";
  const apiPath = isNonprofit ? "/api/admin/nonprofit-applications" : "/api/admin/applications";

  const authHeader = { Authorization: `Bearer ${secret}` };

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${apiPath}?status=${filter}`, { headers: authHeader });
    if (res.status === 401) { setAuthed(false); return; }
    const json = await res.json();
    setApplications(json.applications || []);
    setLoading(false);
  }, [filter, secret, apiPath]);

  const fetchBagLevels = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/bag-levels", { headers: authHeader });
    const json = await res.json();
    setBagLevels(json.nonprofits || []);
    setLoading(false);
  }, [secret]);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/routes?status=${routeFilter}`, { headers: authHeader });
    const json = await res.json();
    setRoutes(json.routes || []);
    setLoading(false);
  }, [secret, routeFilter]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/exchange-appointments?status=${apptFilter}`, { headers: authHeader });
    const json = await res.json();
    setAppointments(json.appointments || []);
    setLoading(false);
  }, [secret, apptFilter]);

  const fetchShoppingDays = useCallback(async () => {
    setLoading(true);
    const upcoming = shoppingFilter === "upcoming";
    const res = await fetch(`/api/admin/shopping-days?upcoming=${upcoming}`, { headers: authHeader });
    const json = await res.json();
    setShoppingDays(json.days || []);
    setLoading(false);
  }, [secret, shoppingFilter]);

  useEffect(() => {
    if (!authed) return;
    setSelected(null); setSelectedAppt(null); setMessage(""); setApplications([]); setBuildingRoute(false);
    if (section === "Reseller Apps" || section === "Nonprofit Apps") fetchApplications();
    if (section === "Bag Levels") fetchBagLevels();
    if (section === "Routes") fetchRoutes();
    if (section === "Exchange Appts") fetchAppointments();
    if (section === "Shopping Days") fetchShoppingDays();
  }, [authed, section, fetchApplications, fetchBagLevels, fetchRoutes, fetchAppointments, fetchShoppingDays]);

  async function handleAuth(e) {
    e.preventDefault();
    const res = await fetch("/api/admin/applications", { headers: authHeader });
    if (res.ok) { setAuthed(true); setAuthError(""); }
    else setAuthError("Invalid password.");
  }

  async function handleApproveAndInvite() {
    if (!selected) return;
    setActionLoading(true); setMessage("");
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        application_id: selected.id,
        email: selected.email,
        full_name: isNonprofit ? selected.contact_name : selected.full_name,
        role: isNonprofit ? "nonprofit" : "reseller",
      }),
    });
    const json = await res.json();
    if (!res.ok) setMessage(`Error: ${json.error}`);
    else { setMessage(`✅ Approved and invite sent to ${selected.email}`); setSelected(null); fetchApplications(); }
    setActionLoading(false);
  }

  async function handleAction(status) {
    if (!selected) return;
    setActionLoading(true); setMessage("");
    const res = await fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id: selected.id, status, admin_notes: notes }),
    });
    if (res.ok) { setMessage(`Application ${status}.`); setSelected(null); fetchApplications(); }
    else setMessage("Action failed. Try again.");
    setActionLoading(false);
  }

  async function viewDocument(fileName, bucket) {
    const endpoint = bucket === "nonprofit-docs" ? "/api/admin/irs-letter" : "/api/admin/dr0563";
    const res = await fetch(`${endpoint}?file=${encodeURIComponent(fileName)}`, { headers: authHeader });
    const json = await res.json();
    if (json.url) window.open(json.url, "_blank");
  }

  async function handleCreateRoute() {
    if (!routeDate || routeStops.length === 0) { setMessage("Set a date and add at least one stop."); return; }
    setRouteLoading(true); setMessage("");
    const res = await fetch("/api/admin/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        scheduled_date: routeDate,
        scheduled_time: routeTime || null,
        notes: routeNotes || null,
        stops: routeStops,
      }),
    });
    if (res.ok) {
      setMessage("✅ Route created and notifications sent to nonprofits and resellers.");
      setBuildingRoute(false); setRouteDate(""); setRouteTime(""); setRouteNotes(""); setRouteStops([]);
      fetchRoutes();
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error}`);
    }
    setRouteLoading(false);
  }

  function addStop(nonprofit) {
    if (routeStops.find((s) => s.nonprofit_id === nonprofit.id)) return;
    setRouteStops((prev) => [...prev, {
      nonprofit_id: nonprofit.id,
      org_name: nonprofit.org_name,
      email: nonprofit.email,
      estimated_bags: nonprofit.bag_count || 0,
      stop_order: prev.length + 1,
      notes: "",
    }]);
  }

  async function handleScheduleAppt() {
    if (!selectedAppt) return;
    setApptLoading(true); setMessage("");
    const res = await fetch("/api/admin/exchange-appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        id: selectedAppt.id,
        status: "scheduled",
        scheduled_date: apptDate || null,
        scheduled_time: apptTime || null,
        admin_notes: apptAdminNotes || null,
      }),
    });
    if (res.ok) {
      setMessage(`✅ Appointment scheduled and ${selectedAppt.nonprofit_applications?.email} notified.`);
      setSelectedAppt(null); setApptDate(""); setApptTime(""); setApptAdminNotes("");
      fetchAppointments();
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error}`);
    }
    setApptLoading(false);
  }

  if (!authed) {
    return (
      <main className="max-w-sm mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-nct-navy mb-6">Admin Login</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin password" className="w-full border border-gray-300 rounded-lg px-4 py-2" />
          {authError && <p className="text-red-600 text-sm">{authError}</p>}
          <button type="submit" className="w-full bg-nct-navy text-white font-bold py-2 rounded-lg hover:bg-nct-navy-dark transition-colors">
            Sign In
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-nct-navy">Admin Dashboard</h1>
        <button onClick={() => setAuthed(false)} className="text-sm text-gray-500 underline">Sign out</button>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
        {SECTIONS.map((s) => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              section === s ? "bg-nct-navy text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-sm mb-4 ${message.startsWith("Error") ? "bg-red-50 border border-red-300 text-red-700" : "bg-green-50 border border-green-300 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* ===== APPLICATIONS (Reseller or Nonprofit) ===== */}
      {(section === "Reseller Apps" || section === "Nonprofit Apps") && (
        <>
          <div className="flex gap-2 mb-6">
            {["pending", "approved", "denied", ""].map((s) => (
              <button key={s} onClick={() => { setFilter(s); setSelected(null); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === s ? "bg-nct-navy text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button onClick={fetchApplications} className="ml-auto px-4 py-2 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">↻ Refresh</button>
          </div>

          <div className="flex gap-6">
            <div className="flex-1 min-w-0">
              {loading ? <p className="text-gray-500 text-sm">Loading…</p>
               : applications.length === 0 ? <p className="text-gray-500 text-sm">No applications found.</p>
               : (
                <div className="space-y-2">
                  {applications.map((app) => (
                    <button key={app.id} onClick={() => { setSelected(app); setNotes(app.admin_notes || ""); }}
                      className={`w-full text-left border rounded-lg px-4 py-3 transition-colors hover:border-nct-navy ${selected?.id === app.id ? "border-nct-navy bg-blue-50" : "border-gray-200"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {isNonprofit ? app.org_name : app.full_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {app.email}{isNonprofit ? (app.contact_name ? ` · ${app.contact_name}` : "") : (app.business_name ? ` · ${app.business_name}` : "")}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[app.status]}`}>
                          {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(app.created_at).toLocaleDateString()}
                        {isNonprofit && app.irs_letter_url && " · IRS letter on file"}
                        {!isNonprofit && app.dr0563_file_url && " · DR 0563 on file"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <div className="w-96 shrink-0 border border-gray-200 rounded-xl p-5 self-start sticky top-20">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-nct-navy text-lg">{isNonprofit ? selected.org_name : selected.full_name}</h2>
                    <p className="text-sm text-gray-500">{selected.email}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>

                <dl className="space-y-1.5 text-sm mb-4">
                  {(isNonprofit ? [
                    ["Contact", selected.contact_name], ["Title", selected.contact_title],
                    ["Phone", selected.phone], ["Org Type", selected.org_type], ["EIN", selected.ein],
                    ["Website", selected.website], ["Est. Monthly (lbs)", selected.estimated_donation_lbs],
                    ["Categories", selected.categories_needed?.join(", ")],
                    ["Address", [selected.address_street, selected.address_city, selected.address_state, selected.address_zip].filter(Boolean).join(", ")],
                    ["Pickup Hours", selected.available_pickup_hours], ["Dock Instructions", selected.dock_instructions],
                    ["Feature Consent", selected.feature_consent ? "Yes" : "No"],
                    ["Signed As", selected.contract_signed_name],
                    ["Agreed At", selected.contract_agreed_at ? new Date(selected.contract_agreed_at).toLocaleString() : null],
                    ["Submitted", new Date(selected.created_at).toLocaleString()],
                  ] : [
                    ["Business", selected.business_name], ["Phone", selected.phone],
                    ["Program", selected.program_type], ["Platforms", selected.platforms?.join(", ")],
                    ["Website", selected.website], ["Tax License #", selected.tax_license_number],
                    ["Feature Consent", selected.feature_consent ? "Yes" : "No"],
                    ["Signed As", selected.contract_signed_name],
                    ["Agreed At", selected.contract_agreed_at ? new Date(selected.contract_agreed_at).toLocaleString() : null],
                    ["Submitted", new Date(selected.created_at).toLocaleString()],
                  ]).filter(([, v]) => v).map(([label, val]) => (
                    <div key={label} className="flex gap-2">
                      <dt className="text-gray-500 w-36 shrink-0">{label}:</dt>
                      <dd className="font-medium break-all">{val}</dd>
                    </div>
                  ))}
                </dl>

                {isNonprofit && selected.irs_letter_url && (
                  <button onClick={() => viewDocument(selected.irs_letter_url, "nonprofit-docs")}
                    className="text-nct-navy underline text-sm mb-4 block">View IRS Letter →</button>
                )}
                {!isNonprofit && selected.dr0563_file_url && (
                  <button onClick={() => viewDocument(selected.dr0563_file_url, "dr0563")}
                    className="text-nct-navy underline text-sm mb-4 block">View DR 0563 →</button>
                )}

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    placeholder="Admin notes" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={handleApproveAndInvite} disabled={actionLoading || selected.status === "approved"}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 rounded transition-colors disabled:opacity-40">
                      ✅ Approve & Invite
                    </button>
                    <button onClick={() => handleAction("denied")} disabled={actionLoading || selected.status === "denied"}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 rounded transition-colors disabled:opacity-40">
                      Deny
                    </button>
                    <button onClick={() => handleAction("pending")} disabled={actionLoading || selected.status === "pending"}
                      className="px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold py-2 rounded transition-colors disabled:opacity-40" title="Reset to pending">
                      ↺
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== BAG LEVELS ===== */}
      {section === "Bag Levels" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Current bag inventory across all approved nonprofit partners.</p>
            <button onClick={fetchBagLevels} className="px-4 py-2 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">↻ Refresh</button>
          </div>
          {loading ? <p className="text-gray-500 text-sm">Loading…</p>
           : bagLevels.length === 0 ? <p className="text-gray-500 text-sm">No approved nonprofits yet.</p>
           : (
            <div className="space-y-3">
              {bagLevels
                .sort((a, b) => (b.bag_count ?? -1) - (a.bag_count ?? -1))
                .map((np) => (
                <div key={np.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-nct-navy">{np.org_name}</p>
                    <p className="text-xs text-gray-500">
                      {[np.address_street, np.address_city, np.address_state].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{np.available_pickup_hours || "Hours not specified"}</p>
                    {np.dock_instructions && <p className="text-xs text-gray-400">Dock: {np.dock_instructions}</p>}
                  </div>
                  <div className="text-center shrink-0">
                    <p className={`text-3xl font-bold ${np.bag_count === null ? "text-gray-300" : np.bag_count >= 5 ? "text-red-600" : np.bag_count >= 2 ? "text-yellow-600" : "text-green-600"}`}>
                      {np.bag_count ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400">bags</p>
                    {np.bag_count_updated && (
                      <p className="text-xs text-gray-300 mt-1">
                        Updated {new Date(np.bag_count_updated).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> 0–1 bags (low)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"></span> 2–4 bags (getting full)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> 5+ bags (needs pickup)</span>
          </div>
        </div>
      )}

      {/* ===== ROUTES ===== */}
      {section === "Routes" && (
        <div>
          <div className="flex gap-2 mb-4 items-center">
            {["scheduled", "completed", "cancelled", ""].map((s) => (
              <button key={s} onClick={() => { setRouteFilter(s); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  routeFilter === s ? "bg-nct-navy text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button onClick={fetchRoutes} className="px-4 py-2 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">↻</button>
            <button onClick={() => setBuildingRoute(!buildingRoute)}
              className="ml-auto bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-5 py-2 rounded-full text-sm transition-colors">
              {buildingRoute ? "Cancel" : "+ Build Route"}
            </button>
          </div>

          {/* Route builder */}
          {buildingRoute && (
            <div className="border-2 border-nct-gold rounded-xl p-5 mb-6 bg-yellow-50">
              <h3 className="font-bold text-nct-navy text-lg mb-4">Build Pickup Route</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Date *</label>
                  <input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time (optional)</label>
                  <input type="time" value={routeTime} onChange={(e) => setRouteTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Route Notes</label>
                  <input type="text" value={routeNotes} onChange={(e) => setRouteNotes(e.target.value)}
                    placeholder="e.g. Driver: Kyle, Truck #2"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              </div>

              <h4 className="font-semibold text-nct-navy text-sm mb-2">Add Stops</h4>
              <p className="text-xs text-gray-500 mb-3">Click a nonprofit below to add them to this route. Sorted by bag count (highest first).</p>
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {bagLevels
                  .sort((a, b) => (b.bag_count ?? -1) - (a.bag_count ?? -1))
                  .map((np) => {
                    const added = routeStops.find((s) => s.nonprofit_id === np.id);
                    return (
                      <div key={np.id} className={`flex items-center justify-between border rounded-lg px-3 py-2 text-sm ${added ? "bg-green-50 border-green-300" : "bg-white border-gray-200"}`}>
                        <div>
                          <span className="font-medium">{np.org_name}</span>
                          <span className="text-gray-400 ml-2 text-xs">{[np.address_city, np.address_state].filter(Boolean).join(", ")}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-bold ${np.bag_count >= 5 ? "text-red-600" : np.bag_count >= 2 ? "text-yellow-600" : "text-green-600"}`}>
                            {np.bag_count ?? "—"} bags
                          </span>
                          {added ? (
                            <button onClick={() => setRouteStops((prev) => prev.filter((s) => s.nonprofit_id !== np.id))}
                              className="text-xs text-red-600 underline">Remove</button>
                          ) : (
                            <button onClick={() => addStop(np)}
                              className="text-xs bg-nct-navy text-white px-3 py-1 rounded-full">Add</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {routeStops.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-nct-navy text-sm mb-2">Stops on This Route ({routeStops.length})</h4>
                  {routeStops.map((s, i) => (
                    <div key={s.nonprofit_id} className="flex items-center gap-2 text-sm mb-1">
                      <span className="w-5 h-5 rounded-full bg-nct-navy text-white flex items-center justify-center text-xs">{i + 1}</span>
                      <span className="flex-1 font-medium">{s.org_name}</span>
                      <input type="number" min="0" value={s.estimated_bags}
                        onChange={(e) => setRouteStops((prev) => prev.map((stop) => stop.nonprofit_id === s.nonprofit_id ? { ...stop, estimated_bags: parseInt(e.target.value) || 0 } : stop))}
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="bags" />
                      <span className="text-xs text-gray-400">bags</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={handleCreateRoute} disabled={routeLoading || !routeDate || routeStops.length === 0}
                className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
                {routeLoading ? "Creating & Notifying…" : `Create Route & Notify (${routeStops.length} stops)`}
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                This will email each nonprofit on the route and all approved resellers.
              </p>
            </div>
          )}

          {/* Route list */}
          {loading ? <p className="text-gray-500 text-sm">Loading…</p>
           : routes.length === 0 ? <p className="text-gray-500 text-sm">No routes found.</p>
           : (
            <div className="space-y-3">
              {routes.map((r) => (
                <div key={r.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-nct-navy">
                        {new Date(r.scheduled_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                        {r.scheduled_time && ` at ${r.scheduled_time}`}
                      </p>
                      <p className="text-xs text-gray-500">{r.stops?.length || 0} stops · ~{r.estimated_total_bags || 0} bags estimated</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                  </div>
                  {r.stops?.map((s) => (
                    <div key={s.id} className="flex justify-between text-sm text-gray-600 border-t border-gray-50 pt-1 mt-1">
                      <span>{s.stop_order}. {s.nonprofit_applications?.org_name}</span>
                      <span className="text-gray-400">{s.estimated_bags ?? "—"} bags</span>
                    </div>
                  ))}
                  {r.notes && <p className="text-xs text-gray-400 mt-2">Note: {r.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== EXCHANGE APPOINTMENTS ===== */}
      {section === "Exchange Appts" && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-4 items-center">
              {["requested", "scheduled", "completed", ""].map((s) => (
                <button key={s} onClick={() => { setApptFilter(s); setSelectedAppt(null); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    apptFilter === s ? "bg-nct-navy text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
              <button onClick={fetchAppointments} className="px-4 py-2 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">↻</button>
            </div>

            {loading ? <p className="text-gray-500 text-sm">Loading…</p>
             : appointments.length === 0 ? <p className="text-gray-500 text-sm">No appointments found.</p>
             : (
              <div className="space-y-2">
                {appointments.map((a) => (
                  <button key={a.id} onClick={() => { setSelectedAppt(a); setApptDate(a.scheduled_date || ""); setApptTime(a.scheduled_time || ""); setApptAdminNotes(a.admin_notes || ""); }}
                    className={`w-full text-left border rounded-lg px-4 py-3 transition-colors hover:border-nct-navy ${selectedAppt?.id === a.id ? "border-nct-navy bg-blue-50" : "border-gray-200"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{a.nonprofit_applications?.org_name}</p>
                        <p className="text-xs text-gray-500">
                          {a.appointment_type === "in_person" ? "In-Person" : "Delivery"}
                          {a.preferred_date ? ` · Preferred: ${new Date(a.preferred_date).toLocaleDateString()}` : ""}
                          {a.scheduled_date ? ` · Scheduled: ${new Date(a.scheduled_date).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status]}`}>{a.status}</span>
                    </div>
                    {a.categories_requested?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">Needs: {a.categories_requested.join(", ")}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedAppt && (
            <div className="w-80 shrink-0 border border-gray-200 rounded-xl p-5 self-start sticky top-20">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-bold text-nct-navy">{selectedAppt.nonprofit_applications?.org_name}</h2>
                  <p className="text-sm text-gray-500">{selectedAppt.nonprofit_applications?.email}</p>
                </div>
                <button onClick={() => setSelectedAppt(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>

              <dl className="space-y-1.5 text-sm mb-4">
                {[
                  ["Type", selectedAppt.appointment_type === "in_person" ? "In-Person" : "Delivery"],
                  ["Preferred Date", selectedAppt.preferred_date ? new Date(selectedAppt.preferred_date).toLocaleDateString() : null],
                  ["Categories", selectedAppt.categories_requested?.join(", ")],
                  ["Their Notes", selectedAppt.notes],
                  ["Requested", new Date(selectedAppt.created_at).toLocaleString()],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label} className="flex gap-2">
                    <dt className="text-gray-500 w-28 shrink-0">{label}:</dt>
                    <dd className="font-medium break-all">{val}</dd>
                  </div>
                ))}
              </dl>

              <div className="border-t border-gray-200 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Schedule Date</label>
                    <input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                    <input type="time" value={apptTime} onChange={(e) => setApptTime(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                  </div>
                </div>
                <textarea value={apptAdminNotes} onChange={(e) => setApptAdminNotes(e.target.value)} rows={2}
                  placeholder="Note to nonprofit (included in confirmation email)"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                <button onClick={handleScheduleAppt} disabled={apptLoading || !apptDate}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition-colors disabled:opacity-40">
                  {apptLoading ? "Scheduling…" : "Confirm & Notify Nonprofit"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== SHOPPING DAYS ===== */}
      {section === "Shopping Days" && (
        <div>
          <div className="flex gap-2 mb-4 items-center">
            {[["upcoming", "Upcoming"], ["all", "All"]].map(([val, label]) => (
              <button key={val} onClick={() => setShoppingFilter(val)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  shoppingFilter === val ? "bg-nct-navy text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
            <button onClick={fetchShoppingDays} className="px-4 py-2 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">↻</button>
          </div>

          {loading ? <p className="text-gray-500 text-sm">Loading…</p>
           : shoppingDays.length === 0 ? <p className="text-gray-500 text-sm">No shopping days found.</p>
           : (
            <div className="space-y-6">
              {shoppingDays.map((day) => {
                const dateStr = new Date(day.shopping_date).toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                });
                const pickupDateStr = day.pickup_routes?.scheduled_date
                  ? new Date(day.pickup_routes.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : null;

                return (
                  <div key={day.id} className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-nct-navy text-lg">{dateStr}</h3>
                        {pickupDateStr && (
                          <p className="text-xs text-gray-400">Pickup route: {pickupDateStr}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[day.status] || "bg-gray-100 text-gray-600"}`}>
                          {day.status}
                        </span>
                        {day.status === "open" && (
                          <button
                            onClick={async () => {
                              await fetch("/api/admin/shopping-days", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", ...authHeader },
                                body: JSON.stringify({ id: day.id, status: "closed" }),
                              });
                              fetchShoppingDays();
                            }}
                            className="text-xs text-gray-500 underline"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Wholesale slot */}
                      <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-nct-navy">Wholesale</p>
                            <p className="text-xs text-gray-500">10:00 AM – 12:00 PM · $0.30/lb</p>
                          </div>
                          <span className="text-sm font-bold text-nct-navy">
                            {day.slots.wholesale.booked}/{day.slots.wholesale.capacity}
                          </span>
                        </div>
                        {day.slots.wholesale.bookings.length === 0 ? (
                          <p className="text-xs text-gray-400">No bookings yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {day.slots.wholesale.bookings.map((b) => (
                              <div key={b.id} className="text-sm">
                                <span className="font-medium">{b.reseller_applications?.full_name}</span>
                                {b.reseller_applications?.business_name && (
                                  <span className="text-gray-400 ml-1">({b.reseller_applications.business_name})</span>
                                )}
                                <span className="text-gray-400 ml-2 text-xs">{b.reseller_applications?.email}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bins slot */}
                      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-nct-navy">Bins</p>
                            <p className="text-xs text-gray-500">12:00 PM – 4:00 PM · $2.00/lb</p>
                          </div>
                          <span className="text-sm font-bold text-nct-navy">
                            {day.slots.bins.booked}/{day.slots.bins.capacity}
                          </span>
                        </div>
                        {day.slots.bins.bookings.length === 0 ? (
                          <p className="text-xs text-gray-400">No bookings yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {day.slots.bins.bookings.map((b) => (
                              <div key={b.id} className="text-sm">
                                <span className="font-medium">{b.reseller_applications?.full_name}</span>
                                {b.reseller_applications?.business_name && (
                                  <span className="text-gray-400 ml-1">({b.reseller_applications.business_name})</span>
                                )}
                                <span className="text-gray-400 ml-2 text-xs">{b.reseller_applications?.email}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Nonprofit bins slot */}
                      <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-nct-navy">Nonprofit Bins</p>
                            <p className="text-xs text-gray-500">12:00 PM – 4:00 PM · 2 volunteer spots</p>
                          </div>
                          <span className="text-sm font-bold text-nct-navy">
                            {day.slots.nonprofit_bins.booked}/{day.slots.nonprofit_bins.capacity}
                          </span>
                        </div>
                        {day.slots.nonprofit_bins.bookings.length === 0 ? (
                          <p className="text-xs text-gray-400">No bookings yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {day.slots.nonprofit_bins.bookings.map((b) => (
                              <div key={b.id} className="text-sm">
                                <span className="font-medium">{b.nonprofit_applications?.org_name}</span>
                                <span className="text-gray-400 ml-2 text-xs">{b.nonprofit_applications?.email}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
