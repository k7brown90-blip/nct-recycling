"use client";
import { useState, useEffect, useCallback } from "react";

const NCT_ADDRESS = "6108 South College Ave STE C, Fort Collins, CO 80525";

function buildMapsUrl(stops) {
  const waypoints = [...stops]
    .sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0))
    .map((s) => {
      const np = s.nonprofit_applications || s;
      return [np.address_street, np.address_city, np.address_state].filter(Boolean).join(", ") || np.org_name;
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

const STOP_STATUS = {
  completed: "bg-green-100 text-green-700 border-green-300",
  skipped:   "bg-gray-100  text-gray-500  border-gray-200",
  pending:   "bg-white     text-gray-900  border-gray-200",
};

export default function DriverPage() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pinError, setPinError] = useState("");

  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [completingStop, setCompletingStop] = useState(null);
  const [actualBags, setActualBags] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const authHeader = { Authorization: `Bearer ${pin}` };

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/driver/routes", { headers: authHeader });
    if (res.status === 401) { setAuthed(false); return; }
    const json = await res.json();
    setRoutes(json.routes || []);
    setLoading(false);
  }, [pin]);

  useEffect(() => {
    if (authed) fetchRoutes();
  }, [authed, fetchRoutes]);

  // Restore PIN from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("driver_pin");
    if (saved) { setPin(saved); setAuthed(true); }
  }, []);

  async function handlePinSubmit(e) {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/driver/routes", { headers: { Authorization: `Bearer ${pin}` } });
    if (res.ok) {
      sessionStorage.setItem("driver_pin", pin);
      setAuthed(true);
    } else {
      setPinError("Incorrect PIN. Try again.");
    }
  }

  function handleSignOut() {
    sessionStorage.removeItem("driver_pin");
    setAuthed(false);
    setPin("");
    setRoutes([]);
  }

  async function handleCompleteStop() {
    if (!completingStop) return;
    setActionLoading(true);
    const bags = actualBags ? parseInt(actualBags) : null;
    const res = await fetch("/api/driver/routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        action: "complete_stop",
        stop_id: completingStop.stop_id,
        nonprofit_id: completingStop.nonprofit_id,
        route_id: completingStop.route_id,
        actual_bags: bags,
      }),
    });
    if (res.ok) {
      setMessage(`✅ Stop complete — counter reset for ${completingStop.org_name}.`);
      setCompletingStop(null);
      setActualBags("");
      fetchRoutes();
    } else {
      setMessage("Failed to complete stop. Try again.");
    }
    setActionLoading(false);
  }

  async function handleRouteStatus(routeId, status) {
    setActionLoading(true);
    const res = await fetch("/api/driver/routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ action: "update_route_status", route_id: routeId, status }),
    });
    if (res.ok) {
      setMessage(status === "completed" ? "✅ Route marked complete!" : `Route marked ${status}.`);
      fetchRoutes();
    } else {
      setMessage("Update failed.");
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

  // ── Route List ──
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-nct-navy text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-nct-gold text-xs font-bold uppercase tracking-wide">NCT Recycling</p>
          <h1 className="text-lg font-bold leading-tight">Driver Portal</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchRoutes} className="text-white/60 hover:text-white text-xl">↻</button>
          <button onClick={handleSignOut} className="text-xs text-white/60 hover:text-white underline">Sign out</button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {message && (
          <div className={`rounded-xl p-3 text-sm mb-4 ${message.startsWith("✅") ? "bg-green-100 text-green-800 border border-green-300" : "bg-red-100 text-red-700 border border-red-300"}`}>
            {message}
            <button onClick={() => setMessage("")} className="float-right text-current opacity-50">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading routes…</div>
        ) : routes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🚛</p>
            <p className="text-gray-500 font-medium">No active routes right now.</p>
            <button onClick={fetchRoutes} className="mt-4 text-nct-navy underline text-sm">Refresh</button>
          </div>
        ) : (
          <div className="space-y-5">
            {routes.map((r) => {
              const completedCount = r.stops?.filter((s) => s.stop_status === "completed").length || 0;
              const totalStops = r.stops?.length || 0;
              const allDone = completedCount === totalStops && totalStops > 0;
              const isToday = r.scheduled_date === today;
              const routeDate = new Date(r.scheduled_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
              const progressPct = totalStops > 0 ? (completedCount / totalStops) * 100 : 0;

              return (
                <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* Route header */}
                  <div className={`px-4 py-3 ${r.status === "in_progress" ? "bg-nct-gold" : "bg-nct-navy"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wide ${r.status === "in_progress" ? "text-white/80" : "text-nct-gold"}`}>
                          {isToday ? "Today" : routeDate} {r.scheduled_time ? `· ${r.scheduled_time}` : ""}
                        </p>
                        <p className="text-white font-bold text-lg leading-tight">{!isToday ? routeDate : `${r.scheduled_time || "All day"}`}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.status === "in_progress" ? "bg-white text-nct-gold" : "bg-white/20 text-white"}`}>
                        {r.status === "in_progress" ? "In Progress" : "Scheduled"}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-white/70 mb-1">
                        <span>{completedCount}/{totalStops} stops complete</span>
                        {r.actual_total_bags ? <span>{r.actual_total_bags} bags collected</span> : null}
                      </div>
                      <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Google Maps button */}
                  <button
                    onClick={() => openMaps(r.stops)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-3 text-sm border-b border-blue-100 transition-colors"
                  >
                    🗺 Open Full Route in Google Maps ↗
                  </button>

                  {/* Notes */}
                  {r.notes && (
                    <p className="px-4 py-2 text-xs text-gray-500 bg-yellow-50 border-b border-yellow-100">📋 {r.notes}</p>
                  )}

                  {/* Stops */}
                  <div className="divide-y divide-gray-100">
                    {r.stops?.map((s) => {
                      const np = s.nonprofit_applications;
                      const isDone = s.stop_status === "completed";
                      const isCompleting = completingStop?.stop_id === s.id;
                      const addr = [np?.address_street, np?.address_city, np?.address_state].filter(Boolean).join(", ");
                      const stopMapsUrl = addr
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
                        : null;

                      return (
                        <div key={s.id} className={`px-4 py-3 ${isDone ? "bg-green-50" : ""}`}>
                          <div className="flex items-start gap-3">
                            {/* Stop number / checkmark */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm mt-0.5 ${isDone ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                              {isDone ? "✓" : s.stop_order}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-base ${isDone ? "text-green-800" : "text-gray-900"}`}>
                                {np?.org_name}
                              </p>
                              {addr && (
                                <a href={stopMapsUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-blue-600 text-sm block mt-0.5 underline">
                                  {addr}
                                </a>
                              )}
                              {np?.available_pickup_hours && (
                                <p className="text-xs text-gray-400 mt-0.5">🕐 {np.available_pickup_hours}</p>
                              )}
                              {np?.dock_instructions && (
                                <p className="text-xs text-gray-500 mt-0.5 bg-yellow-50 rounded px-2 py-1">📦 {np.dock_instructions}</p>
                              )}
                              {s.notes && (
                                <p className="text-xs text-gray-500 mt-0.5">Note: {s.notes}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-gray-400">{s.estimated_bags ?? "—"} bags est.</span>
                                {isDone && s.actual_bags != null && (
                                  <span className="text-xs font-bold text-green-700">{s.actual_bags} actual</span>
                                )}
                                {isDone && s.completed_at && (
                                  <span className="text-xs text-gray-400">
                                    Done {new Date(s.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Complete stop button / form */}
                          {!isDone && r.status !== "completed" && (
                            <div className="mt-3 ml-11">
                              {!isCompleting ? (
                                <button
                                  onClick={() => {
                                    setCompletingStop({ stop_id: s.id, nonprofit_id: s.nonprofit_id, route_id: r.id, org_name: np?.org_name });
                                    setActualBags("");
                                  }}
                                  className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-xl text-sm transition-colors"
                                >
                                  Complete Stop
                                </button>
                              ) : (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-3">
                                  <p className="text-sm font-semibold text-green-900">How many bags were picked up?</p>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={actualBags}
                                    onChange={(e) => setActualBags(e.target.value)}
                                    placeholder="e.g. 12"
                                    className="w-full border border-green-300 rounded-xl px-4 py-3 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-400"
                                    autoFocus
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={handleCompleteStop}
                                      disabled={actionLoading}
                                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm"
                                    >
                                      {actionLoading ? "Saving…" : "✓ Confirm Complete"}
                                    </button>
                                    <button
                                      onClick={() => setCompletingStop(null)}
                                      className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors text-sm"
                                    >
                                      Back
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Route actions */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-2">
                    {r.status === "scheduled" && (
                      <button
                        onClick={() => handleRouteStatus(r.id, "in_progress")}
                        disabled={actionLoading}
                        className="w-full bg-nct-gold hover:bg-nct-gold-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                      >
                        🚛 Start Route
                      </button>
                    )}
                    {r.status === "in_progress" && allDone && (
                      <button
                        onClick={() => handleRouteStatus(r.id, "completed")}
                        disabled={actionLoading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                      >
                        ✅ Complete Route
                      </button>
                    )}
                    {r.status === "in_progress" && !allDone && (
                      <p className="text-center text-xs text-gray-400 py-1">
                        Complete all {totalStops - completedCount} remaining stop{totalStops - completedCount !== 1 ? "s" : ""} to finish route
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
