"use client";
import { useState, useCallback } from "react";

const NCT_ADDRESS = "6108 South College Ave STE C, Fort Collins, CO 80525";

const ROUTE_COLORS = {
  scheduled:   "bg-blue-500",
  in_progress: "bg-nct-gold",
  completed:   "bg-green-500",
};

function buildMapsUrl(stops) {
  const waypoints = [...stops]
    .sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0))
    .map((s) => {
      const org = s.organization || s.nonprofit_applications || s;
      return [org.address_street, org.address_city, org.address_state].filter(Boolean).join(", ") || org.org_name;
    });
  const points = [NCT_ADDRESS, ...waypoints, NCT_ADDRESS];
  return "https://www.google.com/maps/dir/" + points.map(encodeURIComponent).join("/");
}

function openMaps(stops) {
  const a = document.createElement("a");
  a.href = buildMapsUrl(stops);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Returns array of week rows for a given year/month (0-indexed)
function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export default function DriverPage() {
  const [pin, setPin] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("driver_pin") || "";
  });
  const [authed, setAuthed] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(sessionStorage.getItem("driver_pin"));
  });
  const [pinError, setPinError] = useState("");

  // Calendar state: which two months are shown (base = first month)
  const now = new Date();
  const [baseYear, setBaseYear] = useState(now.getFullYear());
  const [baseMonth, setBaseMonth] = useState(now.getMonth()); // 0-indexed
  const [calendarData, setCalendarData] = useState({}); // { dateStr: { id, status, stop_count, completed_count } }
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Route detail state
  const [view, setView] = useState("calendar"); // "calendar" | "route"
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Stop interaction state
  const [completingStop, setCompletingStop] = useState(null); // { stop_id, route_id, org_name, estimated_bags }
  const [actualBags, setActualBags] = useState("");
  const [sanityPrompt, setSanityPrompt] = useState(false); // 3x sanity check
  const [noInventoryConfirm, setNoInventoryConfirm] = useState(null); // { stop_id, nonprofit_id, route_id, org_name }
  const [refusingStop, setRefusingStop] = useState(null); // { stop_id, discard_account_id, org_name }
  const [refuseNotes, setRefuseNotes] = useState("");
  const [refusePhotos, setRefusePhotos] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  const authHeader = { Authorization: `Bearer ${pin}` };

  // Load calendar data when months change or after auth
  const loadCalendar = useCallback(async (year, month, pinOverride) => {
    const usedPin = pinOverride || pin;
    setCalendarLoading(true);
    // Load two months
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const secondMonth = month === 11 ? 0 : month + 1;
    const secondYear = month === 11 ? year + 1 : year;
    const lastDay = new Date(secondYear, secondMonth + 1, 0).getDate();
    const end = `${secondYear}-${String(secondMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const res = await fetch(`/api/driver/routes?view=calendar&start=${start}&end=${end}`, {
      headers: { Authorization: `Bearer ${usedPin}` },
    });
    if (res.status === 401) { setAuthed(false); return; }
    const json = await res.json();
    setCalendarData(json.dates || {});
    setCalendarLoading(false);
  }, [pin]);

  async function handlePinSubmit(e) {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/driver/routes?view=calendar&start=2026-01-01&end=2026-01-01", {
      headers: { Authorization: `Bearer ${pin}` },
    });
    if (res.ok) {
      sessionStorage.setItem("driver_pin", pin);
      setAuthed(true);
      loadCalendar(baseYear, baseMonth, pin);
    } else {
      setPinError("Incorrect PIN. Try again.");
    }
  }

  function handleSignOut() {
    sessionStorage.removeItem("driver_pin");
    setAuthed(false);
    setPin("");
    setCalendarData({});
    setView("calendar");
    setRoute(null);
  }

  async function loadRoute(dateStr) {
    setRouteLoading(true);
    setView("route");
    setMessage("");
    const res = await fetch(`/api/driver/routes?date=${dateStr}`, { headers: authHeader });
    if (res.status === 401) { setAuthed(false); return; }
    const json = await res.json();
    setRoute(json.route || null);
    setRouteLoading(false);
  }

  async function refreshRoute() {
    if (!route?.scheduled_date) return;
    const res = await fetch(`/api/driver/routes?date=${route.scheduled_date}`, { headers: authHeader });
    const json = await res.json();
    setRoute(json.route || null);
  }

  async function handleRouteStatus(routeId, status) {
    setActionLoading(true);
    const res = await fetch("/api/driver/routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ action: "update_route_status", route_id: routeId, status }),
    });
    if (res.ok) {
      const json = await res.json();
      if (status === "completed") {
        if (json.completion_type === "partial") {
          setMessage("⚠️ Route marked complete (partial) — shopping day is now open.");
        } else {
          setMessage("✅ Route complete! Shopping day is open.");
        }
      } else {
        setMessage(`Route started.`);
      }
      await refreshRoute();
      loadCalendar(baseYear, baseMonth);
    } else {
      const json = await res.json().catch(() => ({}));
      setMessage(`Failed: ${json.error || res.status}`);
    }
    setActionLoading(false);
  }

  function startCompletingStop(s) {
    const org = s.organization || s.nonprofit_applications || {};
    setCompletingStop({
      stop_id: s.id,
      route_id: route.id,
      org_name: org.org_name,
      estimated_bags: s.estimated_bags,
        nonprofit_id: s.nonprofit_id,
    });
    setActualBags("");
    setSanityPrompt(false);
  }

  function handleBagsConfirmClick() {
    const bags = parseInt(actualBags);
    const est = completingStop?.estimated_bags;
    // 3× sanity check: if entered bags > 3× estimated (and est > 0), show soft confirm
    if (est && bags > est * 3) {
      setSanityPrompt(true);
      return;
    }
    submitCompleteStop(bags);
  }

  async function submitCompleteStop(bags) {
    setSanityPrompt(false);
    setActionLoading(true);
    const res = await fetch("/api/driver/routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        action: "complete_stop",
        stop_id: completingStop.stop_id,
        route_id: completingStop.route_id,
          nonprofit_id: completingStop.nonprofit_id,
        actual_bags: bags || null,
      }),
    });
    if (res.ok) {
      setMessage(`✅ Stop complete — ${completingStop.org_name}`);
      setCompletingStop(null);
      setActualBags("");
      await refreshRoute();
    } else {
      const json = await res.json().catch(() => ({}));
      setMessage(`Failed: ${json.error || res.status}`);
    }
    setActionLoading(false);
  }

  async function submitNoInventory() {
    const stop = noInventoryConfirm;
    setNoInventoryConfirm(null);
    setActionLoading(true);
    const res = await fetch("/api/driver/routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        action: "no_inventory_stop",
        stop_id: stop.stop_id,
        route_id: route.id,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.consecutive_no_inventory) {
        setMessage(`⚠️ No inventory logged for ${stop.org_name}. This is their 2nd consecutive missed pickup — consider following up.`);
      } else {
        setMessage(`No inventory logged for ${stop.org_name}.`);
      }
      await refreshRoute();
    } else {
      const json = await res.json().catch(() => ({}));
      setMessage(`Failed: ${json.error || res.status}`);
    }
    setActionLoading(false);
  }

  function startRefusingStop(s, org) {
    setRefusingStop({
      stop_id: s.id,
      discard_account_id: s.discard_account_id,
      pickup_request_id: s.pickup_request_id || null,
      org_name: org.org_name,
    });
    setRefuseNotes("");
    setRefusePhotos([]);
  }

  async function submitRefuseStop() {
    const stop = refusingStop;
    if (!stop) return;
    if (!refuseNotes.trim()) { setMessage("Describe what you saw before refusing the load."); return; }
    setActionLoading(true);
    const fd = new FormData();
    fd.append("discard_account_id", stop.discard_account_id);
    if (stop.pickup_request_id) fd.append("pickup_request_id", stop.pickup_request_id);
    fd.append("stop_id", stop.stop_id);
    fd.append("severity", "rejected");
    fd.append("notes", refuseNotes);
    for (const f of refusePhotos) fd.append("photos", f);
    const res = await fetch("/api/driver/discard-refusals", {
      method: "POST",
      headers: { ...authHeader },
      body: fd,
    });
    if (res.ok) {
      setMessage(`🚩 Load refused at ${stop.org_name}. Partner is being notified per Section 8.`);
      setRefusingStop(null);
      setRefuseNotes("");
      setRefusePhotos([]);
      await refreshRoute();
    } else {
      const json = await res.json().catch(() => ({}));
      setMessage(`Failed: ${json.error || res.status}`);
    }
    setActionLoading(false);
  }

  // ── PIN Screen ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-nct-navy flex flex-col items-center justify-center px-6">
        <div className="mb-10 text-center">
          <p className="text-nct-gold font-bold text-lg tracking-wider uppercase">NCT Recycling</p>
          <h1 className="text-white text-4xl font-bold mt-1">Driver Portal</h1>
        </div>
        <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-4">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter driver PIN"
            className="w-full text-center text-2xl font-bold tracking-widest border-2 border-white/30 rounded-2xl px-4 py-4 bg-white/10 text-white placeholder-white/40 focus:outline-none focus:border-nct-gold"
            autoFocus
          />
          {pinError && <p className="text-red-400 text-sm text-center">{pinError}</p>}
          <button
            type="submit"
            className="w-full bg-nct-gold hover:bg-nct-gold-dark text-white font-bold py-4 rounded-2xl text-lg transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const secondMonth = baseMonth === 11 ? 0 : baseMonth + 1;
  const secondYear = baseMonth === 11 ? baseYear + 1 : baseYear;

  // ── Route Detail View ──
  if (view === "route") {
    if (routeLoading) {
      return (
        <div className="min-h-screen bg-gray-100">
          <div className="bg-nct-navy text-white px-4 py-4 flex items-center gap-3">
            <button onClick={() => setView("calendar")} className="text-nct-gold text-xl font-bold">←</button>
            <h1 className="text-lg font-bold">Loading…</h1>
          </div>
          <div className="text-center py-20 text-gray-400">Loading route…</div>
        </div>
      );
    }

    if (!route) {
      return (
        <div className="min-h-screen bg-gray-100">
          <div className="bg-nct-navy text-white px-4 py-4 flex items-center gap-3">
            <button onClick={() => setView("calendar")} className="text-nct-gold text-xl font-bold">←</button>
            <h1 className="text-lg font-bold">Route Not Found</h1>
          </div>
          <div className="text-center py-20 text-gray-500">No route found for this date.</div>
        </div>
      );
    }

    const completedCount = route.stops?.filter((s) => s.stop_status === "completed").length || 0;
    const totalStops = route.stops?.length || 0;
    const allDone = completedCount === totalStops && totalStops > 0;
    const pendingCount = totalStops - completedCount;
    const progressPct = totalStops > 0 ? (completedCount / totalStops) * 100 : 0;
    const routeDateStr = new Date(route.scheduled_date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });

    return (
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <div className="bg-nct-navy text-white px-4 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => { setView("calendar"); setCompletingStop(null); setNoInventoryConfirm(null); }} className="text-nct-gold text-xl font-bold leading-none">←</button>
            <div className="flex-1">
              <p className="text-nct-gold text-xs font-bold uppercase tracking-wide">
                {route.scheduled_date === today ? "Today" : routeDateStr}
              </p>
              <h1 className="text-lg font-bold leading-tight">Pickup Route</h1>
            </div>
            <button onClick={refreshRoute} className="text-white/60 hover:text-white text-xl">↻</button>
          </div>
          <div className="flex justify-between text-xs text-white/70 mb-1">
            <span>{completedCount}/{totalStops} stops complete</span>
            {route.actual_total_bags ? <span>{route.actual_total_bags} bags</span> : null}
          </div>
          <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
          {message && (
            <div className={`rounded-xl p-3 text-sm ${message.startsWith("✅") ? "bg-green-100 text-green-800 border border-green-300" : message.startsWith("⚠️") ? "bg-yellow-50 text-yellow-800 border border-yellow-200" : "bg-red-100 text-red-700 border border-red-300"}`}>
              {message}
              <button onClick={() => setMessage("")} className="float-right opacity-50">✕</button>
            </div>
          )}

          {/* Google Maps button */}
          {route.stops?.length > 0 && (
            <button
              onClick={() => openMaps(route.stops)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              🗺 Open Full Route in Google Maps ↗
            </button>
          )}

          {route.notes && (
            <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">📋 {route.notes}</p>
          )}

          {/* Stops */}
          {route.stops?.map((s) => {
            const org = s.organization || s.nonprofit_applications || {};
            const isDone = s.stop_status === "completed";
            const isCompleting = completingStop?.stop_id === s.id;
            const isNoInventoryPending = noInventoryConfirm?.stop_id === s.id;
            const isRefusing = refusingStop?.stop_id === s.id;
            const isDiscard = s.program_type === "discard" && !!s.discard_account_id;
            const addr = [org.address_street, org.address_city, org.address_state].filter(Boolean).join(", ");
            const stopMapsUrl = addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : null;

            return (
              <div key={s.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden`}>
                <div className={`px-4 py-3 ${isDone ? "bg-green-50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isDone ? (s.no_inventory ? "bg-gray-400 text-white" : "bg-green-500 text-white") : "bg-nct-navy text-white"}`}>
                      {isDone ? (s.no_inventory ? "—" : "✓") : s.stop_order}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-base ${isDone ? (s.no_inventory ? "text-gray-500" : "text-green-800") : "text-gray-900"}`}>
                        {org.org_name}
                        {s.program_type && (
                          <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.program_type === "discard" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                            {s.program_type === "discard" ? "Discard" : "Co-op"}
                          </span>
                        )}
                        {s.no_inventory && <span className="ml-2 text-xs font-normal text-gray-400">No inventory</span>}
                      </p>
                      {addr && (
                        <a href={stopMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm block mt-0.5 underline">
                          {addr}
                        </a>
                      )}
                      {org.available_pickup_hours && (
                        <p className="text-xs text-gray-400 mt-0.5">🕐 {org.available_pickup_hours}</p>
                      )}
                      {org.dock_instructions && (
                        <p className="text-xs text-gray-500 mt-1 bg-yellow-50 rounded px-2 py-1">📦 {org.dock_instructions}</p>
                      )}
                      {s.notes && <p className="text-xs text-gray-500 mt-0.5">Note: {s.notes}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">{s.estimated_bags ?? "—"} bags est.</span>
                        {isDone && s.actual_bags != null && !s.no_inventory && (
                          <span className="text-xs font-bold text-green-700">{s.actual_bags} actual</span>
                        )}
                        {s.payout?.amount_owed != null && (
                          <span className="text-xs text-gray-500">${Number(s.payout.amount_owed || 0).toFixed(2)} payout</span>
                        )}
                        {isDone && s.completed_at && (
                          <span className="text-xs text-gray-400">
                            {new Date(s.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stop actions */}
                {!isDone && route.status !== "completed" && (
                  <div className="px-4 pb-4">
                    {/* No-inventory confirm */}
                    {isNoInventoryPending ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                        <p className="text-sm font-semibold text-gray-800">No bags at {org.org_name}?</p>
                        <p className="text-xs text-gray-500">This will log 0 bags and flag as no inventory.</p>
                        <div className="flex gap-2">
                          <button onClick={submitNoInventory} disabled={actionLoading}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
                            {actionLoading ? "Saving…" : "Confirm — No Inventory"}
                          </button>
                          <button onClick={() => setNoInventoryConfirm(null)}
                            className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm">
                            Back
                          </button>
                        </div>
                      </div>
                    ) : isRefusing ? (
                      /* Refuse contaminated load */
                      <div className="bg-red-50 border border-red-300 rounded-xl p-3 space-y-3">
                        <p className="text-sm font-bold text-red-900">🚩 Refuse load at {org.org_name}</p>
                        <p className="text-xs text-red-700">Per Section 8 of the partner agreement, contaminated loads (soiled, wet, pillows/stuffed textiles, etc.) may be refused on-site with no payment.</p>
                        <textarea
                          value={refuseNotes}
                          onChange={(e) => setRefuseNotes(e.target.value)}
                          placeholder="Describe what you saw (e.g. 6 bags of pillows, 2 bags soaked/moldy)…"
                          rows={3}
                          className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm"
                          autoFocus
                        />
                        <div>
                          <label className="block text-xs font-semibold text-red-900 mb-1">📷 Photo evidence (recommended)</label>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            capture="environment"
                            onChange={(e) => setRefusePhotos(Array.from(e.target.files || []).slice(0, 10))}
                            className="text-xs w-full"
                          />
                          {refusePhotos.length > 0 && (
                            <p className="text-xs text-red-700 mt-1">{refusePhotos.length} photo{refusePhotos.length === 1 ? "" : "s"} attached</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={submitRefuseStop} disabled={actionLoading || !refuseNotes.trim()}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
                            {actionLoading ? "Submitting…" : "🚩 Refuse & Notify Partner"}
                          </button>
                          <button onClick={() => setRefusingStop(null)}
                            className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm">
                            Back
                          </button>
                        </div>
                      </div>
                    ) : isCompleting ? (
                      /* Bag count entry form */
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-3">
                        <p className="text-sm font-semibold text-green-900">How many bags were picked up?</p>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={actualBags}
                          onChange={(e) => { setActualBags(e.target.value); setSanityPrompt(false); }}
                          placeholder="e.g. 12"
                          className="w-full border border-green-300 rounded-xl px-4 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-400"
                          autoFocus
                        />
                        {/* 3× sanity check prompt */}
                        {sanityPrompt && (
                          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 text-xs text-yellow-800">
                            ⚠️ {actualBags} bags is more than 3× the estimate ({completingStop.estimated_bags} est.). Confirm this is correct?
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => sanityPrompt ? submitCompleteStop(parseInt(actualBags)) : handleBagsConfirmClick()}
                            disabled={actionLoading || !actualBags}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm"
                          >
                            {actionLoading ? "Saving…" : sanityPrompt ? "Yes, Confirm Anyway" : "✓ Confirm Bags"}
                          </button>
                          <button onClick={() => { setCompletingStop(null); setSanityPrompt(false); }}
                            className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm">
                            Back
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Default buttons */
                      <div className="space-y-2 mt-1">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startCompletingStop(s)}
                            className="flex-1 bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-xl text-sm transition-colors"
                          >
                            Complete Stop
                          </button>
                          <button
                            onClick={() => setNoInventoryConfirm({ stop_id: s.id, org_name: org.org_name })}
                            className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-sm transition-colors"
                            title="No bags available at this location"
                          >
                            No Inventory
                          </button>
                        </div>
                        {isDiscard && (
                          <button
                            onClick={() => startRefusingStop(s, org)}
                            className="w-full border-2 border-red-300 text-red-700 hover:bg-red-50 font-bold py-2 rounded-xl text-sm transition-colors"
                            title="Refuse load due to contamination per Section 8"
                          >
                            🚩 Refuse — Contaminated
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Route actions */}
          <div className="space-y-2 pb-8">
            {route.status === "scheduled" && (
              <button onClick={() => handleRouteStatus(route.id, "in_progress")} disabled={actionLoading}
                className="w-full bg-nct-gold hover:bg-nct-gold-dark text-white font-bold py-4 rounded-2xl transition-colors disabled:opacity-50">
                🚛 Start Route
              </button>
            )}
            {route.status === "in_progress" && (
              <>
                {allDone ? (
                  <button onClick={() => handleRouteStatus(route.id, "completed")} disabled={actionLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition-colors disabled:opacity-50">
                    ✅ Complete Route
                  </button>
                ) : (
                  <>
                    <p className="text-center text-xs text-gray-400 py-1">
                      {pendingCount} stop{pendingCount !== 1 ? "s" : ""} remaining
                    </p>
                    <button onClick={() => handleRouteStatus(route.id, "completed")} disabled={actionLoading}
                      className="w-full bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 rounded-2xl transition-colors disabled:opacity-50 text-sm">
                      Mark Route Complete Anyway (Partial)
                    </button>
                  </>
                )}
              </>
            )}
            {route.status === "completed" && (
              <div className="text-center py-4">
                <p className="text-green-700 font-bold">
                  {route.completion_type === "partial" ? "⚠️ Route completed (partial)" : "✅ Route completed"}
                </p>
                {route.actual_total_bags != null && (
                  <p className="text-gray-500 text-sm mt-1">{route.actual_total_bags} total bags collected</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Calendar View ──
  const months = [
    { year: baseYear, month: baseMonth },
    { year: secondYear, month: secondMonth },
  ];

  function goBack() {
    const nextMonth = baseMonth === 0 ? 11 : baseMonth - 1;
    const nextYear = baseMonth === 0 ? baseYear - 1 : baseYear;
    setBaseMonth(nextMonth);
    setBaseYear(nextYear);
    if (authed) loadCalendar(nextYear, nextMonth);
  }
  function goForward() {
    const nextMonth = baseMonth === 11 ? 0 : baseMonth + 1;
    const nextYear = baseMonth === 11 ? baseYear + 1 : baseYear;
    setBaseMonth(nextMonth);
    setBaseYear(nextYear);
    if (authed) loadCalendar(nextYear, nextMonth);
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-nct-navy text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-nct-gold text-xs font-bold uppercase tracking-wide">NCT Recycling</p>
          <h1 className="text-lg font-bold leading-tight">Driver Portal</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => loadCalendar(baseYear, baseMonth)} className="text-white/60 hover:text-white text-xl">↻</button>
          <button onClick={handleSignOut} className="text-xs text-white/60 hover:text-white underline">Sign out</button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {message && (
          <div className={`rounded-xl p-3 text-sm mb-3 ${message.startsWith("✅") ? "bg-green-100 text-green-800 border border-green-300" : "bg-red-100 text-red-700 border border-red-300"}`}>
            {message}
            <button onClick={() => setMessage("")} className="float-right opacity-50">✕</button>
          </div>
        )}

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow text-nct-navy hover:bg-gray-50 font-bold text-lg">‹</button>
          <span className="font-bold text-nct-navy text-sm">
            {MONTH_NAMES[baseMonth]} — {MONTH_NAMES[secondMonth]} {secondYear}
          </span>
          <button onClick={goForward} className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow text-nct-navy hover:bg-gray-50 font-bold text-lg">›</button>
        </div>

        {calendarLoading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-5">
            {months.map(({ year, month }) => {
              const weeks = buildCalendarGrid(year, month);
              return (
                <div key={`${year}-${month}`} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-nct-navy text-white px-4 py-2">
                    <p className="font-bold text-sm">{MONTH_NAMES[month]} {year}</p>
                  </div>
                  <div className="px-3 py-2">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                      {DAY_LABELS.map((d) => (
                        <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
                      ))}
                    </div>
                    {/* Weeks */}
                    {weeks.map((week, wi) => (
                      <div key={wi} className="grid grid-cols-7">
                        {week.map((day, di) => {
                          if (!day) return <div key={di} />;
                          const dateStr = toDateStr(year, month, day);
                          const entry = calendarData[dateStr];
                          const isToday = dateStr === today;
                          const hasRoute = !!entry;

                          return (
                            <button
                              key={di}
                              onClick={() => hasRoute && loadRoute(dateStr)}
                              disabled={!hasRoute}
                              className={`relative flex flex-col items-center justify-center h-11 rounded-xl transition-colors
                                ${isToday ? "ring-2 ring-nct-gold" : ""}
                                ${hasRoute ? "cursor-pointer hover:bg-gray-50" : "cursor-default"}
                              `}
                            >
                              <span className={`text-sm font-medium ${isToday ? "text-nct-navy font-bold" : hasRoute ? "text-gray-900" : "text-gray-400"}`}>
                                {day}
                              </span>
                              {hasRoute && (
                                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${ROUTE_COLORS[entry.status] || "bg-gray-400"}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="flex gap-4 justify-center text-xs text-gray-500 pb-2">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Scheduled</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-nct-gold inline-block" /> In Progress</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Completed</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
