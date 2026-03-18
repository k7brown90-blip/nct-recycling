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

const SECTIONS = ["Reseller Apps", "Nonprofit Apps", "Bag Levels", "Routes", "Exchange Appts", "Shopping Days", "Donation Lots", "Discard Accounts"];

// Bag weight constants — 55-gal bag ≈ 20 lbs (LTL accounts only)
const LBS_PER_BAG = 20;
const SCHEDULE_LBS = 750;   // trigger: schedule pickup
const TARGET_LBS   = 1000;  // ideal pickup weight
const SCHEDULE_BAGS = Math.round(SCHEDULE_LBS / LBS_PER_BAG); // ~38
const TARGET_BAGS   = Math.round(TARGET_LBS   / LBS_PER_BAG); // 50

function bagColor(count) {
  if (count === null || count === undefined) return "text-gray-300";
  if (count >= TARGET_BAGS)   return "text-red-600";
  if (count >= SCHEDULE_BAGS) return "text-yellow-600";
  return "text-green-600";
}
function bagBarColor(count) {
  if (count >= TARGET_BAGS)   return "bg-red-500";
  if (count >= SCHEDULE_BAGS) return "bg-yellow-400";
  return "bg-green-500";
}

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
  const [completingStop, setCompletingStop] = useState(null); // { stop_id, nonprofit_id, route_id, org_name }
  const [actualBagsInput, setActualBagsInput] = useState("");

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
  const [editingShoppingDay, setEditingShoppingDay] = useState(null); // id being edited
  const [shoppingDayEdits, setShoppingDayEdits] = useState({ wholesale_capacity: "", bins_capacity: "", admin_notes: "" });
  const [shoppingDayLoading, setShoppingDayLoading] = useState(false);
  const [newShoppingDay, setNewShoppingDay] = useState({ shopping_date: "", wholesale_capacity: "", bins_capacity: "" });
  const [showNewShoppingDay, setShowNewShoppingDay] = useState(false);

  // Donation lots state (tab overview)
  const [lots, setLots] = useState([]);
  const [lotNonprofits, setLotNonprofits] = useState([]);
  const [lotForm, setLotForm] = useState({ application_id: "", piece_count: "", lot_date: "", notes: "" });
  const [lotLoading, setLotLoading] = useState(false);

  // Inline lot state (within selected nonprofit card)
  const [npLots, setNpLots] = useState([]);
  const [npLotsLoading, setNpLotsLoading] = useState(false);
  const [inlineLot, setInlineLot] = useState({ piece_count: "", lot_date: "", notes: "" });
  const [inlineLotLoading, setInlineLotLoading] = useState(false);

  // Documents dropdown open state
  const [docsOpen, setDocsOpen] = useState(false);

  // Discard accounts state
  const [discardAccounts, setDiscardAccounts] = useState([]);
  const [discardLoading, setDiscardLoading] = useState(false);
  const [selectedDiscard, setSelectedDiscard] = useState(null);
  const [discardPickups, setDiscardPickups] = useState([]);
  const [discardPickupsLoading, setDiscardPickupsLoading] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    org_name: "", address_street: "", address_city: "", address_state: "", address_zip: "",
    contact_name: "", contact_email: "", contact_phone: "",
    pickup_frequency: "weekly", rate_per_1000_lbs: "20",
    min_lbs_weekly: "1000", min_lbs_biweekly: "2500", min_lbs_adhoc: "5000",
    projected_lbs_week: "", contract_date: "", notes: "",
  });
  const [newAccountLoading, setNewAccountLoading] = useState(false);
  const [pickupForm, setPickupForm] = useState({
    pickup_date: "", pickup_time: "", weight_lbs: "", load_type: "recurring",
    accepted: true, rejection_reason: "", notes: "",
  });
  const [pickupFormLoading, setPickupFormLoading] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(null); // pickup id being paid
  const [paymentMethod, setPaymentMethod] = useState("");

  // Container pickup requests (FL accounts)
  const [containerRequests, setContainerRequests] = useState([]);
  const [containerLoading, setContainerLoading] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [containerAdminNotes, setContainerAdminNotes] = useState("");
  const [containerScheduleDate, setContainerScheduleDate] = useState("");

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

  const fetchNpLots = useCallback(async (applicationId) => {
    setNpLotsLoading(true);
    const res = await fetch(`/api/admin/tax-receipts?application_id=${applicationId}`, { headers: authHeader });
    const json = await res.json();
    setNpLots(json.lots || []);
    setNpLotsLoading(false);
  }, [secret]);

  const fetchLots = useCallback(async () => {
    setLoading(true);
    const [lotsRes, npRes] = await Promise.all([
      fetch("/api/admin/tax-receipts", { headers: authHeader }),
      fetch("/api/admin/bag-levels", { headers: authHeader }),
    ]);
    const lotsJson = await lotsRes.json();
    const npJson = await npRes.json();
    setLots(lotsJson.lots || []);
    setLotNonprofits(npJson.nonprofits || []);
    setLoading(false);
  }, [secret]);

  const fetchContainerRequests = useCallback(async () => {
    setContainerLoading(true);
    const res = await fetch("/api/admin/container-requests", { headers: authHeader });
    const json = await res.json();
    setContainerRequests(json.requests || []);
    setContainerLoading(false);
  }, [secret]);

  const fetchDiscardAccounts = useCallback(async () => {
    setDiscardLoading(true);
    const res = await fetch("/api/admin/discard-accounts", { headers: authHeader });
    const json = await res.json();
    setDiscardAccounts(json.accounts || []);
    setDiscardLoading(false);
  }, [secret]);

  const fetchDiscardPickups = useCallback(async (accountId) => {
    setDiscardPickupsLoading(true);
    const res = await fetch(`/api/admin/discard-pickups?account_id=${accountId}`, { headers: authHeader });
    const json = await res.json();
    setDiscardPickups(json.pickups || []);
    setDiscardPickupsLoading(false);
  }, [secret]);

  const fetchShoppingDays = useCallback(async () => {
    setLoading(true);
    const upcoming = shoppingFilter === "upcoming";
    const res = await fetch(`/api/admin/shopping-days?upcoming=${upcoming}`, { headers: authHeader });
    const json = await res.json();
    setShoppingDays(json.days || []);
    setLoading(false);
  }, [secret, shoppingFilter]);

  async function handleGenerateSundays() {
    setShoppingDayLoading(true); setMessage("");
    const res = await fetch("/api/admin/shopping-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ action: "generate_sundays", weeks: 8 }),
    });
    const json = await res.json();
    if (res.ok) { setMessage(`✅ Created ${json.created} Sunday shopping day${json.created !== 1 ? "s" : ""}.`); fetchShoppingDays(); }
    else setMessage(`Error: ${json.error}`);
    setShoppingDayLoading(false);
  }

  async function handleCreateShoppingDay(e) {
    e.preventDefault();
    const dow = new Date(newShoppingDay.shopping_date + "T12:00:00").getDay();
    if (dow === 5 || dow === 6) { setMessage("Error: NCT is closed Fridays and Saturdays."); return; }
    setShoppingDayLoading(true); setMessage("");
    const res = await fetch("/api/admin/shopping-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify(newShoppingDay),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage("✅ Shopping day created.");
      setShowNewShoppingDay(false);
      setNewShoppingDay({ shopping_date: "", wholesale_capacity: "", bins_capacity: "" });
      fetchShoppingDays();
    } else setMessage(`Error: ${json.error}`);
    setShoppingDayLoading(false);
  }

  async function handleSaveShoppingDayEdits(id) {
    setShoppingDayLoading(true); setMessage("");
    const res = await fetch("/api/admin/shopping-days", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id, ...shoppingDayEdits }),
    });
    if (res.ok) {
      setMessage("✅ Shopping day updated.");
      setEditingShoppingDay(null);
      fetchShoppingDays();
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error}`);
    }
    setShoppingDayLoading(false);
  }

  async function handleDeleteShoppingDay(id) {
    if (!confirm("Delete this shopping day? All bookings will be cancelled.")) return;
    const res = await fetch("/api/admin/shopping-days", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { setMessage("Shopping day deleted."); fetchShoppingDays(); }
    else setMessage("Delete failed.");
  }

  useEffect(() => {
    if (!authed) return;
    setSelected(null); setSelectedAppt(null); setMessage(""); setApplications([]); setBuildingRoute(false);
    if (section === "Reseller Apps" || section === "Nonprofit Apps") fetchApplications();
    if (section === "Bag Levels") { fetchBagLevels(); fetchContainerRequests(); }
    if (section === "Routes") { fetchRoutes(); fetchBagLevels(); }
    if (section === "Exchange Appts") fetchAppointments();
    if (section === "Shopping Days") fetchShoppingDays();
    if (section === "Donation Lots") fetchLots();
    if (section === "Discard Accounts") fetchDiscardAccounts();
  }, [authed, section, fetchApplications, fetchBagLevels, fetchRoutes, fetchAppointments, fetchShoppingDays, fetchLots, fetchContainerRequests, fetchDiscardAccounts]);

  useEffect(() => {
    if (selectedDiscard?.id) {
      setDiscardPickups([]);
      setPickupForm({ pickup_date: "", pickup_time: "", weight_lbs: "", load_type: "recurring", accepted: true, rejection_reason: "", notes: "" });
      setMarkingPaid(null);
      fetchDiscardPickups(selectedDiscard.id);
    }
  }, [selectedDiscard?.id, fetchDiscardPickups]);

  useEffect(() => {
    setDocsOpen(false);
    if (isNonprofit && selected?.id) {
      setNpLots([]);
      setInlineLot({ piece_count: "", lot_date: "", notes: "" });
      fetchNpLots(selected.id);
    }
  }, [selected?.id, isNonprofit, fetchNpLots]);

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

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Permanently delete this application from ${selected.email}? This cannot be undone.`)) return;
    setActionLoading(true); setMessage("");
    const res = await fetch(apiPath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id: selected.id }),
    });
    if (res.ok) { setMessage("Application deleted."); setSelected(null); fetchApplications(); }
    else setMessage("Delete failed. Try again.");
    setActionLoading(false);
  }

  async function viewDocument(fileName, bucket) {
    const endpoint = bucket === "nonprofit-docs" ? "/api/admin/irs-letter" : "/api/admin/dr0563";
    const res = await fetch(`${endpoint}?file=${encodeURIComponent(fileName)}`, { headers: authHeader });
    const json = await res.json();
    if (json.url) window.open(json.url, "_blank");
  }

  async function handleLogLot(e) {
    e.preventDefault();
    if (!selected || !inlineLot.piece_count) return;
    setInlineLotLoading(true);
    const res = await fetch("/api/admin/tax-receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ ...inlineLot, application_id: selected.id }),
    });
    const json = await res.json();
    if (res.ok) {
      setInlineLot({ piece_count: "", lot_date: "", notes: "" });
      fetchNpLots(selected.id);
      setMessage("✅ Donation lot logged.");
    } else {
      setMessage(`Error: ${json.error}`);
    }
    setInlineLotLoading(false);
  }

  async function handleCreateLot(e) {
    e.preventDefault();
    if (!lotForm.application_id || !lotForm.piece_count) return;
    setLotLoading(true); setMessage("");
    const res = await fetch("/api/admin/tax-receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify(lotForm),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage("✅ Donation lot logged.");
      setLotForm({ application_id: "", piece_count: "", lot_date: "", notes: "" });
      fetchLots();
    } else {
      setMessage(`Error: ${json.error}`);
    }
    setLotLoading(false);
  }

  async function handleDeleteLot(id) {
    if (!confirm("Delete this donation lot? This cannot be undone.")) return;
    const res = await fetch("/api/admin/tax-receipts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { setMessage("Lot deleted."); fetchLots(); }
    else setMessage("Delete failed.");
  }

  async function viewReceiptAsAdmin(lotId) {
    const res = await fetch("/api/admin/tax-receipts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id: lotId }),
    });
    const json = await res.json();
    if (json.url) window.open(json.url, "_blank");
    else setMessage("No receipt uploaded yet.");
  }

  async function viewAgreement(applicationId) {
    const res = await fetch(`/api/admin/nonprofit-agreement?application_id=${applicationId}`, { headers: authHeader });
    const json = await res.json();
    if (json.url) {
      const a = document.createElement("a");
      a.href = json.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (json.missing) {
      setMessage("⚠ No agreement PDF on file. Click \"Regenerate\" next to the agreement link to create it.");
    } else {
      setMessage(`Error: ${json.error}`);
    }
  }

  async function regenerateAgreement(applicationId) {
    setMessage("Generating agreement PDF…");
    const res = await fetch("/api/admin/nonprofit-agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ application_id: applicationId }),
    });
    const json = await res.json();
    if (json.url) {
      setMessage("✅ Agreement PDF generated.");
      const a = document.createElement("a");
      a.href = json.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      setMessage(`Error generating PDF: ${json.error}`);
    }
  }

  async function handleUpdateAccountType(applicationId, account_type) {
    const res = await fetch("/api/admin/nonprofit-applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id: applicationId, account_type }),
    });
    if (res.ok) {
      setMessage(`✅ Account type updated to ${account_type.toUpperCase()}.`);
      fetchApplications();
    } else {
      setMessage("Failed to update account type.");
    }
  }

  async function viewContainerPhoto(requestId) {
    const res = await fetch("/api/admin/container-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ request_id: requestId }),
    });
    const json = await res.json();
    if (json.url) {
      const a = document.createElement("a");
      a.href = json.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else {
      setMessage("No photo on file for this request.");
    }
  }

  async function handleUpdateContainerRequest(id, updates) {
    const res = await fetch("/api/admin/container-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) {
      setMessage("✅ Request updated.");
      setSelectedContainer(null);
      setContainerAdminNotes("");
      setContainerScheduleDate("");
      fetchContainerRequests();
    } else {
      setMessage("Update failed.");
    }
  }

  async function handleDeleteContainerRequest(id) {
    if (!confirm("Delete this container pickup request?")) return;
    const res = await fetch("/api/admin/container-requests", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { setMessage("Request deleted."); fetchContainerRequests(); }
    else setMessage("Delete failed.");
  }

  // ── Discard account helpers ──
  function calcDiscardPayment(weight_lbs, load_type, account) {
    if (!account || !weight_lbs) return 0;
    const freq = account.pickup_frequency;
    const min = load_type === "single_run" ? account.min_lbs_adhoc
      : freq === "weekly" ? account.min_lbs_weekly : account.min_lbs_biweekly;
    if (parseFloat(weight_lbs) < min) return 0;
    return Math.floor(parseFloat(weight_lbs) / 1000) * parseFloat(account.rate_per_1000_lbs);
  }

  async function handleCreateDiscardAccount(e) {
    e.preventDefault();
    setNewAccountLoading(true); setMessage("");
    const res = await fetch("/api/admin/discard-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({
        ...newAccount,
        rate_per_1000_lbs: parseFloat(newAccount.rate_per_1000_lbs) || 20,
        min_lbs_weekly:    parseInt(newAccount.min_lbs_weekly)    || 1000,
        min_lbs_biweekly:  parseInt(newAccount.min_lbs_biweekly)  || 2500,
        min_lbs_adhoc:     parseInt(newAccount.min_lbs_adhoc)     || 5000,
        projected_lbs_week: newAccount.projected_lbs_week ? parseInt(newAccount.projected_lbs_week) : null,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage("✅ Account created.");
      setShowNewAccount(false);
      setNewAccount({ org_name: "", address_street: "", address_city: "", address_state: "", address_zip: "", contact_name: "", contact_email: "", contact_phone: "", pickup_frequency: "weekly", rate_per_1000_lbs: "20", min_lbs_weekly: "1000", min_lbs_biweekly: "2500", min_lbs_adhoc: "5000", projected_lbs_week: "", contract_date: "", notes: "" });
      fetchDiscardAccounts();
    } else { setMessage(`Error: ${json.error}`); }
    setNewAccountLoading(false);
  }

  async function handleDeleteDiscardAccount(id) {
    if (!confirm("Delete this discard account and all its pickup records? Cannot be undone.")) return;
    const res = await fetch("/api/admin/discard-accounts", { method: "DELETE", headers: { "Content-Type": "application/json", ...authHeader }, body: JSON.stringify({ id }) });
    if (res.ok) { setMessage("Account deleted."); setSelectedDiscard(null); fetchDiscardAccounts(); }
    else setMessage("Delete failed.");
  }

  async function handleLogPickup(e) {
    e.preventDefault();
    if (!selectedDiscard || !pickupForm.pickup_date || !pickupForm.weight_lbs) return;
    setPickupFormLoading(true); setMessage("");
    const res = await fetch("/api/admin/discard-pickups", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ account_id: selectedDiscard.id, ...pickupForm, weight_lbs: parseFloat(pickupForm.weight_lbs) }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage(`✅ Pickup logged. Amount owed: $${json.amount_owed.toFixed(2)}`);
      setPickupForm({ pickup_date: "", pickup_time: "", weight_lbs: "", load_type: "recurring", accepted: true, rejection_reason: "", notes: "" });
      fetchDiscardPickups(selectedDiscard.id);
    } else { setMessage(`Error: ${json.error}`); }
    setPickupFormLoading(false);
  }

  async function handleMarkPaid(pickupId, method) {
    const res = await fetch("/api/admin/discard-pickups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id: pickupId, payment_status: "paid", payment_method: method || null, payment_date: new Date().toISOString().split("T")[0] }),
    });
    if (res.ok) {
      setMessage("✅ Payment recorded.");
      setMarkingPaid(null); setPaymentMethod("");
      fetchDiscardPickups(selectedDiscard.id);
    } else setMessage("Failed to record payment.");
  }

  async function handleVoidPickup(pickupId) {
    if (!confirm("Void this pickup? Payment will be removed.")) return;
    const res = await fetch("/api/admin/discard-pickups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ id: pickupId, payment_status: "voided" }),
    });
    if (res.ok) { setMessage("Pickup voided."); fetchDiscardPickups(selectedDiscard.id); }
    else setMessage("Failed.");
  }

  async function handleDeletePickup(pickupId) {
    if (!confirm("Delete this pickup record? Cannot be undone.")) return;
    const res = await fetch("/api/admin/discard-pickups", { method: "DELETE", headers: { "Content-Type": "application/json", ...authHeader }, body: JSON.stringify({ id: pickupId }) });
    if (res.ok) { setMessage("Record deleted."); fetchDiscardPickups(selectedDiscard.id); }
    else setMessage("Delete failed.");
  }

  async function handleCompleteStop() {
    if (!completingStop) return;
    const { stop_id, nonprofit_id, route_id } = completingStop;
    const actual = actualBagsInput ? parseInt(actualBagsInput) : null;
    const res = await fetch("/api/admin/routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ action: "complete_stop", stop_id, nonprofit_id, route_id, actual_bags: actual }),
    });
    if (res.ok) {
      setMessage(`✅ Stop completed — bag counter reset for ${completingStop.org_name}.`);
      setCompletingStop(null);
      setActualBagsInput("");
      fetchRoutes();
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error}`);
    }
  }

  async function handleUpdateRouteStatus(routeId, status) {
    const res = await fetch("/api/admin/routes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ action: "update_route_status", route_id: routeId, status }),
    });
    if (res.ok) { setMessage(`✅ Route marked ${status}.`); fetchRoutes(); }
    else setMessage("Failed to update route status.");
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

  const NCT_ADDRESS = "6108 South College Ave STE C, Fort Collins, CO 80525";

  function buildGoogleMapsUrl(stops) {
    const waypoints = [...stops]
      .sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0))
      .map((s) => {
        // Supports both route-builder stops (address on root) and saved route stops (address on nonprofit_applications)
        const np = s.nonprofit_applications || s;
        const addr = [np.address_street, np.address_city, np.address_state].filter(Boolean).join(", ");
        return addr || np.org_name || s.org_name;
      });
    const points = [NCT_ADDRESS, ...waypoints, NCT_ADDRESS]; // start and end at NCT
    return "https://www.google.com/maps/dir/" + points.map(encodeURIComponent).join("/");
  }

  function openInMaps(stops) {
    const url = buildGoogleMapsUrl(stops);
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function addStop(nonprofit) {
    if (routeStops.find((s) => s.nonprofit_id === nonprofit.id)) return;
    setRouteStops((prev) => [...prev, {
      nonprofit_id: nonprofit.id,
      org_name: nonprofit.org_name,
      email: nonprofit.email,
      address_street: nonprofit.address_street,
      address_city: nonprofit.address_city,
      address_state: nonprofit.address_state,
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

          {loading ? <p className="text-gray-500 text-sm">Loading…</p>
           : applications.length === 0 ? <p className="text-gray-500 text-sm">No applications found.</p>
           : (
            <div className="space-y-2">
              {applications.map((app) => {
                const isExpanded = selected?.id === app.id;
                return (
                  <div key={app.id} className={`border rounded-xl overflow-hidden transition-colors ${isExpanded ? "border-nct-navy" : "border-gray-200"}`}>

                    {/* ── Collapsed header row ── */}
                    <button
                      onClick={() => {
                        if (isExpanded) { setSelected(null); }
                        else { setSelected(app); setNotes(app.admin_notes || ""); }
                      }}
                      className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {isNonprofit ? app.org_name : app.full_name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {app.email}
                            {isNonprofit ? (app.contact_name ? ` · ${app.contact_name}` : "") : (app.business_name ? ` · ${app.business_name}` : "")}
                            {" · "}{new Date(app.created_at).toLocaleDateString()}
                            {isNonprofit && app.irs_letter_url && " · IRS letter on file"}
                            {!isNonprofit && app.dr0563_file_url && " · DR 0563 on file"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status]}`}>
                            {app.status}
                          </span>
                          <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>
                    </button>

                    {/* ── Expanded body ── */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">

                        {/* Organization / Contact Details */}
                        <div className="px-5 py-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                            {isNonprofit ? "Organization Details" : "Details"}
                          </p>
                          <dl className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                            {(isNonprofit ? [
                              ["Contact", app.contact_name], ["Title", app.contact_title],
                              ["Email", app.email || "—"], ["Phone", app.phone || "—"],
                              ["Org Type", app.org_type], ["EIN", app.ein],
                              ["Website", app.website], ["Est. Monthly (lbs)", app.estimated_donation_lbs],
                              ["Categories", app.categories_needed?.join(", ")],
                              ["Address", [app.address_street, app.address_city, app.address_state, app.address_zip].filter(Boolean).join(", ")],
                              ["Pickup Hours", app.available_pickup_hours],
                              ["Dock Instructions", app.dock_instructions],
                              ["Feature Consent", app.feature_consent ? "Yes" : "No"],
                              ["Signed As", app.contract_signed_name],
                              ["Agreed At", app.contract_agreed_at ? new Date(app.contract_agreed_at).toLocaleString() : null],
                              ["Submitted", new Date(app.created_at).toLocaleString()],
                            ] : [
                              ["Business", app.business_name], ["Phone", app.phone],
                              ["Program", app.program_type], ["Platforms", app.platforms?.join(", ")],
                              ["Website", app.website], ["Tax License #", app.tax_license_number],
                              ["Feature Consent", app.feature_consent ? "Yes" : "No"],
                              ["Signed As", app.contract_signed_name],
                              ["Agreed At", app.contract_agreed_at ? new Date(app.contract_agreed_at).toLocaleString() : null],
                              ["Submitted", new Date(app.created_at).toLocaleString()],
                            ]).filter(([, v]) => v).map(([label, val]) => (
                              <div key={label} className="flex gap-2">
                                <dt className="text-gray-500 w-32 shrink-0">{label}:</dt>
                                <dd className="font-medium break-all">{val}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>

                        {/* Documents — collapsible dropdown */}
                        <div className="px-5 py-3">
                          <button
                            onClick={() => setDocsOpen((o) => !o)}
                            className="flex items-center justify-between w-full text-left group"
                          >
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide group-hover:text-gray-600 transition-colors">
                              Documents on File
                            </p>
                            <span className="text-gray-400 text-xs">{docsOpen ? "▲ Hide" : "▼ Show"}</span>
                          </button>
                          {docsOpen && (
                            <div className="mt-3 space-y-2 pl-1">
                              {isNonprofit ? (
                                <>
                                  {app.irs_letter_url ? (
                                    <button onClick={() => viewDocument(app.irs_letter_url, "nonprofit-docs")}
                                      className="flex items-center gap-2 text-sm text-nct-navy hover:text-nct-gold transition-colors">
                                      📄 IRS Determination Letter →
                                    </button>
                                  ) : (
                                    <p className="text-sm text-gray-400 italic">No IRS letter uploaded</p>
                                  )}
                                  <div className="flex items-center gap-3">
                                    <button onClick={() => viewAgreement(app.id)}
                                      className="flex items-center gap-2 text-sm text-nct-navy hover:text-nct-gold transition-colors">
                                      📄 Co-Op Participation Agreement (PDF) →
                                    </button>
                                    <button onClick={() => regenerateAgreement(app.id)}
                                      className="text-xs text-gray-400 hover:text-nct-navy underline transition-colors">
                                      Regenerate
                                    </button>
                                  </div>
                                  {npLots.filter((l) => l.receipt_status === "uploaded").map((lot) => (
                                    <button key={lot.id} onClick={() => viewReceiptAsAdmin(lot.id)}
                                      className="flex items-center gap-2 text-sm text-nct-navy hover:text-nct-gold transition-colors">
                                      🧾 Tax Receipt — {lot.piece_count?.toLocaleString()} pcs
                                      {lot.lot_date ? ` (${new Date(lot.lot_date + "T00:00:00").toLocaleDateString()})` : ""} →
                                    </button>
                                  ))}
                                  {npLots.filter((l) => l.receipt_status === "uploaded").length === 0 && (
                                    <p className="text-sm text-gray-400 italic">No tax receipts uploaded yet</p>
                                  )}
                                </>
                              ) : (
                                app.dr0563_file_url ? (
                                  <button onClick={() => viewDocument(app.dr0563_file_url, "dr0563")}
                                    className="flex items-center gap-2 text-sm text-nct-navy hover:text-nct-gold transition-colors">
                                    📄 DR 0563 / Resale Certificate →
                                  </button>
                                ) : (
                                  <p className="text-sm text-gray-400 italic">No documents uploaded</p>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        {/* Donation Lots — nonprofit only */}
                        {isNonprofit && (
                          <div className="px-5 py-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Donation Lots</p>

                            {/* Donation summary */}
                            {npLots.length > 0 && (() => {
                              const totalPieces = npLots.reduce((s, l) => s + (l.piece_count || 0), 0);
                              const totalValue = npLots.reduce((s, l) => s + parseFloat(l.total_value || 0), 0);
                              const pending = npLots.filter((l) => l.receipt_status === "pending_receipt").length;
                              return (
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                                    <p className="text-xl font-bold text-nct-navy">{totalPieces.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Total Pieces</p>
                                  </div>
                                  <div className="bg-green-50 rounded-lg p-3 text-center">
                                    <p className="text-xl font-bold text-green-700">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Total Value</p>
                                  </div>
                                  <div className={`rounded-lg p-3 text-center ${pending > 0 ? "bg-yellow-50" : "bg-gray-50"}`}>
                                    <p className={`text-xl font-bold ${pending > 0 ? "text-yellow-700" : "text-gray-400"}`}>{pending}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Awaiting Receipt</p>
                                  </div>
                                </div>
                              );
                            })()}

                            <form onSubmit={handleLogLot} className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                <div>
                                  <label className="text-xs text-gray-500 block mb-0.5">Pieces *</label>
                                  <input type="number" min="1"
                                    value={inlineLot.piece_count}
                                    onChange={(e) => setInlineLot((p) => ({ ...p, piece_count: e.target.value }))}
                                    placeholder="e.g. 120"
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" required />
                                  {inlineLot.piece_count > 0 && (
                                    <p className="text-xs text-green-600 mt-0.5">${(parseInt(inlineLot.piece_count || 0) * 5).toLocaleString()}</p>
                                  )}
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-0.5">Date</label>
                                  <input type="date"
                                    value={inlineLot.lot_date}
                                    onChange={(e) => setInlineLot((p) => ({ ...p, lot_date: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-0.5">Notes</label>
                                  <input type="text"
                                    value={inlineLot.notes}
                                    onChange={(e) => setInlineLot((p) => ({ ...p, notes: e.target.value }))}
                                    placeholder="Optional"
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                                </div>
                              </div>
                              <button type="submit"
                                disabled={inlineLotLoading || !inlineLot.piece_count}
                                className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white text-xs font-bold py-2 rounded transition-colors disabled:opacity-50">
                                {inlineLotLoading ? "Logging…" : "Log Donation Lot →"}
                              </button>
                            </form>
                            {npLotsLoading ? (
                              <p className="text-xs text-gray-400">Loading…</p>
                            ) : npLots.length === 0 ? (
                              <p className="text-xs text-gray-400">No donation lots logged yet.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {npLots.map((lot) => (
                                  <div key={lot.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 text-xs">
                                    <div className="min-w-0">
                                      <span className="font-semibold text-nct-navy">{lot.piece_count?.toLocaleString()} pcs</span>
                                      <span className="text-green-700 font-medium ml-2">${parseFloat(lot.total_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                      <span className="text-gray-400 ml-2">{lot.lot_date ? new Date(lot.lot_date + "T00:00:00").toLocaleDateString() : "—"}</span>
                                      {lot.notes && <span className="text-gray-400 ml-2">· {lot.notes}</span>}
                                    </div>
                                    <div className="flex items-center gap-2 ml-2 shrink-0">
                                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${lot.receipt_status === "uploaded" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                        {lot.receipt_status === "uploaded" ? "✓ Receipt" : "Pending"}
                                      </span>
                                      <button onClick={() => handleDeleteLot(lot.id)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Admin Actions */}
                        <div className="px-5 py-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Admin Actions</p>

                          {/* Account type (nonprofit only) */}
                          {isNonprofit && (
                            <div className="mb-3 flex items-center gap-3">
                              <label className="text-xs font-medium text-gray-500 shrink-0">Account Type:</label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateAccountType(app.id, "ltl")}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                                    (app.account_type || "ltl") === "ltl"
                                      ? "bg-nct-navy text-white border-nct-navy"
                                      : "bg-white text-gray-600 border-gray-300 hover:border-nct-navy"
                                  }`}
                                >
                                  LTL — Less than Truckload
                                </button>
                                <button
                                  onClick={() => handleUpdateAccountType(app.id, "fl")}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                                    app.account_type === "fl"
                                      ? "bg-nct-navy text-white border-nct-navy"
                                      : "bg-white text-gray-600 border-gray-300 hover:border-nct-navy"
                                  }`}
                                >
                                  FL — Full Load
                                </button>
                              </div>
                            </div>
                          )}

                          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                            placeholder="Admin notes" className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3" />
                          <div className="flex gap-2">
                            <button onClick={handleApproveAndInvite} disabled={actionLoading || app.status === "approved"}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 rounded transition-colors disabled:opacity-40">✅ Approve & Invite</button>
                            <button onClick={() => handleAction("denied")} disabled={actionLoading || app.status === "denied"}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 rounded transition-colors disabled:opacity-40">Deny</button>
                            <button onClick={() => handleAction("pending")} disabled={actionLoading || app.status === "pending"}
                              className="px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold py-2 rounded transition-colors disabled:opacity-40" title="Reset to pending">↺</button>
                            <button onClick={handleDelete} disabled={actionLoading}
                              className="px-3 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-bold py-2 rounded transition-colors disabled:opacity-40" title="Delete">🗑</button>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== BAG LEVELS ===== */}
      {section === "Bag Levels" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Inventory levels across all approved nonprofit partners.</p>
            <button onClick={() => { fetchBagLevels(); fetchContainerRequests(); }}
              className="px-4 py-2 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">↻ Refresh</button>
          </div>

          {/* ── LTL Accounts ── */}
          {(() => {
            const ltlAccounts = bagLevels.filter((n) => (n.account_type || "ltl") === "ltl");
            return (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-700 mb-1">LTL — Less than Truckload</h3>
                <p className="text-xs text-gray-400 mb-4">
                  ~{LBS_PER_BAG} lbs/bag · Schedule at {SCHEDULE_BAGS} bags (~{SCHEDULE_LBS} lbs) · Ideal pickup at {TARGET_BAGS} bags (~{TARGET_LBS} lbs)
                </p>
                {loading ? <p className="text-gray-500 text-sm">Loading…</p>
                 : ltlAccounts.length === 0 ? <p className="text-gray-400 text-sm italic">No LTL accounts.</p>
                 : (
                  <div className="space-y-3">
                    {ltlAccounts
                      .sort((a, b) => (b.bag_count ?? -1) - (a.bag_count ?? -1))
                      .map((np) => {
                        const count = np.bag_count ?? 0;
                        const hasCount = np.bag_count !== null;
                        const estLbs = count * LBS_PER_BAG;
                        const barMax = TARGET_BAGS * 1.2;
                        const barPct = hasCount ? Math.min((count / barMax) * 100, 100) : 0;
                        const schedulePct = (SCHEDULE_BAGS / barMax) * 100;
                        const targetPct  = (TARGET_BAGS  / barMax) * 100;
                        const status = !hasCount ? null
                          : count >= TARGET_BAGS   ? { label: "Needs Pickup",    cls: "bg-red-100 text-red-700" }
                          : count >= SCHEDULE_BAGS ? { label: "Schedule Pickup", cls: "bg-yellow-100 text-yellow-700" }
                          : { label: "Building Up", cls: "bg-green-100 text-green-700" };
                        return (
                          <div key={np.id} className="border border-gray-200 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-nct-navy">{np.org_name}</p>
                                <p className="text-xs text-gray-500">
                                  {[np.address_street, np.address_city, np.address_state].filter(Boolean).join(", ")}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">{np.available_pickup_hours || "Hours not specified"}</p>
                                {np.dock_instructions && <p className="text-xs text-gray-400">Dock: {np.dock_instructions}</p>}
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-3xl font-bold leading-none ${bagColor(np.bag_count)}`}>
                                  {np.bag_count ?? "—"}
                                </p>
                                <p className="text-xs text-gray-400">bags</p>
                                {hasCount && <p className="text-xs text-gray-400">~{estLbs.toLocaleString()} lbs</p>}
                                {np.bag_count_updated && (
                                  <p className="text-xs text-gray-300 mt-1">Updated {new Date(np.bag_count_updated).toLocaleDateString()}</p>
                                )}
                              </div>
                            </div>
                            <div className="relative h-3 bg-gray-100 rounded-full overflow-visible">
                              <div className={`h-3 rounded-full transition-all ${bagBarColor(np.bag_count)}`} style={{ width: `${barPct}%` }} />
                              <div className="absolute top-0 bottom-0 w-0.5 bg-yellow-500 opacity-70" style={{ left: `${schedulePct}%` }} title={`Schedule at ~${SCHEDULE_BAGS} bags`} />
                              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 opacity-70" style={{ left: `${targetPct}%` }} title={`Pickup target ~${TARGET_BAGS} bags`} />
                            </div>
                            <div className="flex justify-between text-xs text-gray-300 mt-1">
                              <span>0</span>
                              <span className="text-yellow-500">{SCHEDULE_BAGS} bags ({SCHEDULE_LBS} lbs)</span>
                              <span className="text-red-400">{TARGET_BAGS} bags ({TARGET_LBS} lbs)</span>
                            </div>
                            {status && (
                              <div className="mt-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
                <div className="mt-4 flex gap-5 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span> Under {SCHEDULE_BAGS} bags — building up</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span> {SCHEDULE_BAGS}–{TARGET_BAGS - 1} bags — schedule pickup</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> {TARGET_BAGS}+ bags — needs pickup</span>
                </div>
              </div>
            );
          })()}

          {/* ── FL Accounts ── */}
          {(() => {
            const flAccounts = bagLevels.filter((n) => n.account_type === "fl");
            return (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-1">FL — Full Load</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Container-based accounts. Pickup triggered when container reaches ~75% full. Partners submit photo requests.
                </p>
                {loading || containerLoading ? <p className="text-gray-500 text-sm">Loading…</p>
                 : flAccounts.length === 0 ? <p className="text-gray-400 text-sm italic">No FL accounts.</p>
                 : (
                  <div className="space-y-3">
                    {flAccounts.map((np) => {
                      const myRequests = containerRequests.filter((r) => r.application_id === np.id);
                      const pendingRequests = myRequests.filter((r) => ["pending", "reviewed"].includes(r.status));
                      const isSelected = selectedContainer?.application_id === np.id;
                      return (
                        <div key={np.id} className={`border rounded-xl p-4 ${pendingRequests.length > 0 ? "border-yellow-400 bg-yellow-50" : "border-gray-200"}`}>
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-nct-navy">{np.org_name}</p>
                                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">FL</span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {[np.address_street, np.address_city, np.address_state].filter(Boolean).join(", ")}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{np.available_pickup_hours || "Hours not specified"}</p>
                            </div>
                            <div className="text-right shrink-0">
                              {pendingRequests.length > 0 ? (
                                <div>
                                  <p className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</p>
                                  <p className="text-xs text-yellow-700">pickup request{pendingRequests.length !== 1 ? "s" : ""}</p>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">No pending requests</p>
                              )}
                            </div>
                          </div>

                          {/* Pickup requests for this FL account */}
                          {myRequests.length > 0 && (
                            <div className="space-y-2 mt-2">
                              {myRequests.map((req) => (
                                <div key={req.id} className={`border rounded-lg p-3 text-sm ${selectedContainer?.id === req.id ? "border-nct-navy bg-white" : "border-gray-200 bg-white"}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status] || "bg-gray-100 text-gray-600"}`}>
                                          {req.status}
                                        </span>
                                        <span className="text-xs text-gray-400">{new Date(req.created_at).toLocaleDateString()}</span>
                                        {req.container_photo_path && (
                                          <button onClick={() => viewContainerPhoto(req.id)}
                                            className="text-xs text-nct-navy underline hover:text-nct-gold">
                                            📷 View Photo
                                          </button>
                                        )}
                                      </div>
                                      {req.notes && <p className="text-gray-600 mt-1">{req.notes}</p>}
                                      {req.admin_notes && <p className="text-xs text-gray-400 mt-0.5">Admin note: {req.admin_notes}</p>}
                                      {req.scheduled_date && (
                                        <p className="text-xs text-blue-700 font-medium mt-0.5">
                                          Scheduled: {new Date(req.scheduled_date + "T00:00:00").toLocaleDateString()}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                      <button
                                        onClick={() => {
                                          if (selectedContainer?.id === req.id) {
                                            setSelectedContainer(null);
                                          } else {
                                            setSelectedContainer(req);
                                            setContainerAdminNotes(req.admin_notes || "");
                                            setContainerScheduleDate(req.scheduled_date || "");
                                          }
                                        }}
                                        className="text-xs bg-nct-navy text-white px-2.5 py-1 rounded-lg hover:bg-nct-navy-dark transition-colors"
                                      >
                                        {selectedContainer?.id === req.id ? "Done" : "Manage"}
                                      </button>
                                      <button onClick={() => handleDeleteContainerRequest(req.id)}
                                        className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
                                    </div>
                                  </div>

                                  {/* Inline manage panel */}
                                  {selectedContainer?.id === req.id && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-xs text-gray-500 block mb-0.5">Schedule Date</label>
                                          <input type="date" value={containerScheduleDate}
                                            onChange={(e) => setContainerScheduleDate(e.target.value)}
                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-500 block mb-0.5">Admin Note</label>
                                          <input type="text" value={containerAdminNotes}
                                            onChange={(e) => setContainerAdminNotes(e.target.value)}
                                            placeholder="Note to nonprofit"
                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleUpdateContainerRequest(req.id, { status: "reviewed", admin_notes: containerAdminNotes })}
                                          className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 rounded transition-colors">
                                          Mark Reviewed
                                        </button>
                                        <button onClick={() => handleUpdateContainerRequest(req.id, { status: "scheduled", scheduled_date: containerScheduleDate, admin_notes: containerAdminNotes })}
                                          disabled={!containerScheduleDate}
                                          className="flex-1 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1.5 rounded transition-colors disabled:opacity-40">
                                          Schedule Pickup
                                        </button>
                                        <button onClick={() => handleUpdateContainerRequest(req.id, { status: "completed", admin_notes: containerAdminNotes })}
                                          className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 rounded transition-colors">
                                          Complete
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {myRequests.length === 0 && (
                            <p className="text-xs text-gray-400 italic mt-1">No pickup requests submitted.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ===== ROUTES ===== */}
      {section === "Routes" && (
        <div>
          <div className="flex gap-2 mb-4 items-center">
            {[
              { value: "scheduled",   label: "Scheduled" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed",   label: "Completed" },
              { value: "cancelled",   label: "Cancelled" },
              { value: "",            label: "All" },
            ].map(({ value, label }) => (
              <button key={value} onClick={() => setRouteFilter(value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  routeFilter === value ? "bg-nct-navy text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
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
                          <span className={`font-bold ${bagColor(np.bag_count)}`}>
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

              {routeStops.length > 0 && (
                <button
                  type="button"
                  onClick={() => openInMaps(routeStops)}
                  className="w-full mb-3 border-2 border-nct-navy text-nct-navy font-bold py-2.5 rounded-lg hover:bg-nct-navy hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  🗺 Preview Route in Google Maps ↗
                </button>
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
              {routes.map((r) => {
                const completedStops = r.stops?.filter((s) => s.stop_status === "completed").length || 0;
                const totalStops = r.stops?.length || 0;
                const isActive = r.status === "scheduled" || r.status === "in_progress";
                return (
                  <div key={r.id} className={`border rounded-xl p-4 ${r.status === "in_progress" ? "border-nct-gold bg-yellow-50" : "border-gray-200"}`}>
                    {/* Route header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-nct-navy">
                          {new Date(r.scheduled_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                          {r.scheduled_time && ` at ${r.scheduled_time}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {totalStops} stops · ~{r.estimated_total_bags || 0} bags est
                          {r.actual_total_bags ? ` · ${r.actual_total_bags} bags actual` : ""}
                          {isActive && totalStops > 0 && ` · ${completedStops}/${totalStops} complete`}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                    </div>

                    {/* Stops */}
                    <div className="space-y-1.5 mb-3">
                      {r.stops?.map((s) => {
                        const isDone = s.stop_status === "completed";
                        const isSkipped = s.stop_status === "skipped";
                        const isCompleting = completingStop?.stop_id === s.id;
                        return (
                          <div key={s.id} className={`border rounded-lg p-2.5 ${isDone ? "border-green-200 bg-green-50" : isSkipped ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-gray-700 shrink-0">{s.stop_order}.</span>
                                <span className="text-sm font-medium text-gray-900 truncate">{s.nonprofit_applications?.org_name}</span>
                                {isDone && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold shrink-0">✓ Done</span>}
                                {isSkipped && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">Skipped</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-gray-400">{s.estimated_bags ?? "—"} est</span>
                                {isDone && s.actual_bags != null && (
                                  <span className="text-xs font-semibold text-green-700">{s.actual_bags} actual</span>
                                )}
                                {!isDone && !isSkipped && isActive && (
                                  <button
                                    onClick={() => {
                                      if (isCompleting) { setCompletingStop(null); setActualBagsInput(""); }
                                      else { setCompletingStop({ stop_id: s.id, nonprofit_id: s.nonprofit_id, route_id: r.id, org_name: s.nonprofit_applications?.org_name }); setActualBagsInput(""); }
                                    }}
                                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-lg transition-colors"
                                  >
                                    {isCompleting ? "Cancel" : "Complete Stop"}
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Completion form */}
                            {isCompleting && (
                              <div className="mt-2 pt-2 border-t border-green-200 flex items-end gap-2">
                                <div className="flex-1">
                                  <label className="text-xs text-gray-500 block mb-0.5">Actual bags picked up</label>
                                  <input
                                    type="number" min="0"
                                    value={actualBagsInput}
                                    onChange={(e) => setActualBagsInput(e.target.value)}
                                    placeholder="e.g. 12"
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                                  />
                                </div>
                                <button
                                  onClick={handleCompleteStop}
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors whitespace-nowrap"
                                >
                                  ✓ Confirm & Reset Counter
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {r.notes && <p className="text-xs text-gray-400 mb-2">Note: {r.notes}</p>}

                    {/* Route actions */}
                    <div className="flex gap-2 flex-wrap">
                      {r.stops?.length > 0 && (
                        <button onClick={() => openInMaps(r.stops)}
                          className="flex-1 border border-nct-navy text-nct-navy text-xs font-semibold py-1.5 rounded-lg hover:bg-nct-navy hover:text-white transition-colors flex items-center justify-center gap-1">
                          🗺 Open in Google Maps ↗
                        </button>
                      )}
                      {r.status === "scheduled" && (
                        <button onClick={() => handleUpdateRouteStatus(r.id, "in_progress")}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          Start Route
                        </button>
                      )}
                      {isActive && (
                        <button onClick={() => handleUpdateRouteStatus(r.id, "completed")}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          Complete Route
                        </button>
                      )}
                      {isActive && (
                        <button onClick={() => handleUpdateRouteStatus(r.id, "cancelled")}
                          className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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

      {/* ===== DONATION LOTS ===== */}
      {section === "Donation Lots" && (
        <div>
          {/* Log new lot form */}
          <div className="border-2 border-nct-navy rounded-xl p-5 mb-6 bg-blue-50">
            <h3 className="font-bold text-nct-navy text-lg mb-4">Log Donation Lot</h3>
            <form onSubmit={handleCreateLot} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nonprofit *</label>
                <select
                  value={lotForm.application_id}
                  onChange={(e) => setLotForm((p) => ({ ...p, application_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select nonprofit…</option>
                  {lotNonprofits.map((n) => (
                    <option key={n.id} value={n.id}>{n.org_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Piece Count *</label>
                <input
                  type="number" min="1"
                  value={lotForm.piece_count}
                  onChange={(e) => setLotForm((p) => ({ ...p, piece_count: e.target.value }))}
                  placeholder="e.g. 120"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
                {lotForm.piece_count > 0 && (
                  <p className="text-xs text-green-700 mt-1">
                    Value: ${(parseInt(lotForm.piece_count || 0) * 5).toLocaleString()}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lot Date</label>
                <input
                  type="date"
                  value={lotForm.lot_date}
                  onChange={(e) => setLotForm((p) => ({ ...p, lot_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={lotForm.notes}
                  onChange={(e) => setLotForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Spring lot #1, winter coats mix"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <button
                  type="submit"
                  disabled={lotLoading || !lotForm.application_id || !lotForm.piece_count}
                  className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {lotLoading ? "Saving…" : "Log Donation Lot"}
                </button>
              </div>
            </form>
          </div>

          {/* Lots list */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">All logged donation lots across nonprofits.</p>
            <button onClick={fetchLots} className="px-4 py-2 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">↻ Refresh</button>
          </div>

          {loading ? <p className="text-gray-500 text-sm">Loading…</p>
           : lots.length === 0 ? <p className="text-gray-500 text-sm">No lots logged yet.</p>
           : (
            <div className="space-y-2">
              {lots.map((lot) => (
                <div key={lot.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-nct-navy">{lot.nonprofit_applications?.org_name}</p>
                    <p className="text-sm text-gray-600">
                      {lot.piece_count?.toLocaleString()} pieces
                      {" · "}
                      <span className="text-green-700 font-medium">
                        ${parseFloat(lot.total_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {lot.lot_date ? new Date(lot.lot_date + "T00:00:00").toLocaleDateString() : "No date"}
                      {lot.notes ? ` · ${lot.notes}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      lot.receipt_status === "uploaded"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {lot.receipt_status === "uploaded" ? "✓ Receipt on file" : "Awaiting receipt"}
                    </span>
                    {lot.receipt_status === "uploaded" && (
                      <button
                        onClick={() => viewReceiptAsAdmin(lot.id)}
                        className="text-xs text-nct-navy underline"
                      >
                        View
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteLot(lot.id)}
                      className="text-xs text-red-500 underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== SHOPPING DAYS ===== */}
      {section === "Shopping Days" && (
        <div>
          <div className="flex gap-2 mb-4 items-center flex-wrap">
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
            <div className="ml-auto flex gap-2">
              <button
                onClick={handleGenerateSundays}
                disabled={shoppingDayLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-full text-sm transition-colors disabled:opacity-50"
              >
                ☀ Generate Next 8 Sundays
              </button>
              <button onClick={() => setShowNewShoppingDay((v) => !v)}
                className="bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-4 py-2 rounded-full text-sm transition-colors">
                {showNewShoppingDay ? "Cancel" : "+ New Day"}
              </button>
            </div>
          </div>

          {/* New day form */}
          {showNewShoppingDay && (
            <form onSubmit={handleCreateShoppingDay} className="border-2 border-nct-gold rounded-xl p-4 mb-5 bg-yellow-50">
              <h3 className="font-bold text-nct-navy mb-3">Create Shopping Day</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Date *</label>
                  <input type="date" required value={newShoppingDay.shopping_date}
                    onChange={(e) => setNewShoppingDay((p) => ({ ...p, shopping_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Wholesale spots (blank = auto)</label>
                  <input type="number" min="0" value={newShoppingDay.wholesale_capacity}
                    onChange={(e) => setNewShoppingDay((p) => ({ ...p, wholesale_capacity: e.target.value }))}
                    placeholder="Auto"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Bins cap (blank = default)</label>
                  <input type="number" min="0" value={newShoppingDay.bins_capacity}
                    onChange={(e) => setNewShoppingDay((p) => ({ ...p, bins_capacity: e.target.value }))}
                    placeholder="10 or unlimited"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
              </div>
              <button type="submit" disabled={shoppingDayLoading || !newShoppingDay.shopping_date}
                className="bg-nct-navy hover:bg-nct-navy-dark text-white text-sm font-bold py-2 px-5 rounded transition-colors disabled:opacity-50">
                {shoppingDayLoading ? "Creating…" : "Create →"}
              </button>
            </form>
          )}

          {loading ? <p className="text-gray-500 text-sm">Loading…</p>
           : shoppingDays.length === 0 ? <p className="text-gray-500 text-sm">No shopping days found.</p>
           : (
            <div className="space-y-5">
              {shoppingDays.map((day) => {
                const dateStr = new Date(day.shopping_date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                });
                const route = day.pickup_routes;
                const isEditing = editingShoppingDay === day.id;
                const actualLbs = (route?.actual_total_bags || 0) * 20;
                const estimatedLbs = (route?.estimated_total_bags || 0) * 20;

                return (
                  <div key={day.id} className={`border rounded-xl p-5 ${day.is_sunday ? "border-purple-300 bg-purple-50" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-nct-navy text-lg">{dateStr}</h3>
                          {day.is_sunday && (
                            <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">Sunday</span>
                          )}
                        </div>
                        {route && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Pickup route: {new Date(route.scheduled_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {actualLbs > 0 ? ` · ${actualLbs.toLocaleString()} lbs actual` : estimatedLbs > 0 ? ` · ~${estimatedLbs.toLocaleString()} lbs est` : ""}
                          </p>
                        )}
                        {day.admin_notes && (
                          <p className="text-xs text-yellow-700 bg-yellow-100 rounded px-2 py-0.5 mt-1 inline-block">{day.admin_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[day.status] || "bg-gray-100 text-gray-600"}`}>
                          {day.status}
                        </span>
                        <button onClick={() => {
                          if (isEditing) { setEditingShoppingDay(null); }
                          else {
                            setEditingShoppingDay(day.id);
                            setShoppingDayEdits({
                              wholesale_capacity: day.wholesale_capacity ?? "",
                              bins_capacity: day.bins_capacity ?? "",
                              admin_notes: day.admin_notes || "",
                            });
                          }
                        }} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors">
                          {isEditing ? "Done" : "Edit"}
                        </button>
                        {day.status === "open" && (
                          <button onClick={async () => {
                            await fetch("/api/admin/shopping-days", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...authHeader },
                              body: JSON.stringify({ id: day.id, status: "closed" }),
                            });
                            fetchShoppingDays();
                          }} className="text-xs text-gray-500 underline">Close</button>
                        )}
                        {day.status !== "open" && (
                          <button onClick={async () => {
                            await fetch("/api/admin/shopping-days", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...authHeader },
                              body: JSON.stringify({ id: day.id, status: "open" }),
                            });
                            fetchShoppingDays();
                          }} className="text-xs text-green-600 underline">Reopen</button>
                        )}
                        <button onClick={() => handleDeleteShoppingDay(day.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                      </div>
                    </div>

                    {/* Edit panel */}
                    {isEditing && (
                      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Edit Capacities & Notes</p>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-0.5">
                              Wholesale spots
                              {day.wholesale_capacity == null && (
                                <span className="text-gray-400 ml-1">(auto: {day.wholesale_capacity_auto})</span>
                              )}
                            </label>
                            <input type="number" min="0" value={shoppingDayEdits.wholesale_capacity}
                              onChange={(e) => setShoppingDayEdits((p) => ({ ...p, wholesale_capacity: e.target.value }))}
                              placeholder={`Auto (${day.wholesale_capacity_auto})`}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                            <p className="text-xs text-gray-400 mt-0.5">Blank = 1 spot per 500 lbs collected</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-0.5">
                              Bins cap
                              {day.bins_capacity == null && (
                                <span className="text-gray-400 ml-1">(default: {day.is_sunday ? "unlimited" : "10"})</span>
                              )}
                            </label>
                            <input type="number" min="0" value={shoppingDayEdits.bins_capacity}
                              onChange={(e) => setShoppingDayEdits((p) => ({ ...p, bins_capacity: e.target.value }))}
                              placeholder={day.is_sunday ? "Unlimited" : "10"}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                            <p className="text-xs text-gray-400 mt-0.5">Blank = {day.is_sunday ? "unlimited (Sunday)" : "10 (weekday)"}</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-0.5">Admin note (shown on day card)</label>
                            <input type="text" value={shoppingDayEdits.admin_notes}
                              onChange={(e) => setShoppingDayEdits((p) => ({ ...p, admin_notes: e.target.value }))}
                              placeholder="e.g. Closed for Memorial Day"
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                          </div>
                        </div>
                        <button onClick={() => handleSaveShoppingDayEdits(day.id)} disabled={shoppingDayLoading}
                          className="bg-nct-navy hover:bg-nct-navy-dark text-white text-sm font-bold py-1.5 px-5 rounded transition-colors disabled:opacity-50">
                          {shoppingDayLoading ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Wholesale slot */}
                      <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-nct-navy">Wholesale</p>
                            <p className="text-xs text-gray-500">10:00 AM – 4:00 PM · $0.30/lb</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-nct-navy">
                              {day.slots.wholesale.booked}/{day.slots.wholesale.capacity}
                            </span>
                            {day.wholesale_capacity == null && (
                              <p className="text-xs text-gray-400">auto</p>
                            )}
                          </div>
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
                          <div className="text-right">
                            <span className="text-sm font-bold text-nct-navy">
                              {day.slots.bins.booked}{day.slots.bins.capacity === 999 ? "" : `/${day.slots.bins.capacity}`}
                            </span>
                            <p className="text-xs text-gray-400">{day.slots.bins.capacity === 999 ? "no cap" : ""}</p>
                          </div>
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
      {/* ===== DISCARD ACCOUNTS ===== */}
      {section === "Discard Accounts" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Organizations that sell discard directly instead of joining the co-op.</p>
            <div className="flex gap-2">
              <button onClick={fetchDiscardAccounts} className="px-4 py-2 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">↻ Refresh</button>
              <button onClick={() => setShowNewAccount((v) => !v)}
                className="bg-nct-gold hover:bg-nct-gold-dark text-white font-bold px-5 py-2 rounded-full text-sm transition-colors">
                {showNewAccount ? "Cancel" : "+ New Account"}
              </button>
            </div>
          </div>

          {/* New account form */}
          {showNewAccount && (
            <form onSubmit={handleCreateDiscardAccount} className="border-2 border-nct-gold rounded-xl p-5 mb-6 bg-yellow-50 space-y-4">
              <h3 className="font-bold text-nct-navy text-lg">New Discard Purchase Account</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Organization Name *</label>
                  <input type="text" required value={newAccount.org_name}
                    onChange={(e) => setNewAccount((p) => ({ ...p, org_name: e.target.value }))}
                    placeholder="e.g. Denver Rescue Mission"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Street Address</label>
                  <input type="text" value={newAccount.address_street}
                    onChange={(e) => setNewAccount((p) => ({ ...p, address_street: e.target.value }))}
                    placeholder="123 Main St"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input type="text" value={newAccount.address_city}
                    onChange={(e) => setNewAccount((p) => ({ ...p, address_city: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                    <input type="text" value={newAccount.address_state} maxLength={2}
                      onChange={(e) => setNewAccount((p) => ({ ...p, address_state: e.target.value }))}
                      placeholder="CO"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ZIP</label>
                    <input type="text" value={newAccount.address_zip}
                      onChange={(e) => setNewAccount((p) => ({ ...p, address_zip: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
                  <input type="text" value={newAccount.contact_name}
                    onChange={(e) => setNewAccount((p) => ({ ...p, contact_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Email</label>
                  <input type="email" value={newAccount.contact_email}
                    onChange={(e) => setNewAccount((p) => ({ ...p, contact_email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone</label>
                  <input type="tel" value={newAccount.contact_phone}
                    onChange={(e) => setNewAccount((p) => ({ ...p, contact_phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pickup Frequency</label>
                  <select value={newAccount.pickup_frequency}
                    onChange={(e) => setNewAccount((p) => ({ ...p, pickup_frequency: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="adhoc">Ad Hoc</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-yellow-200 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Agreement Terms</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rate ($/1,000 lbs)</label>
                    <input type="number" min="0" step="0.01" value={newAccount.rate_per_1000_lbs}
                      onChange={(e) => setNewAccount((p) => ({ ...p, rate_per_1000_lbs: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min lbs (weekly)</label>
                    <input type="number" min="0" value={newAccount.min_lbs_weekly}
                      onChange={(e) => setNewAccount((p) => ({ ...p, min_lbs_weekly: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min lbs (biweekly)</label>
                    <input type="number" min="0" value={newAccount.min_lbs_biweekly}
                      onChange={(e) => setNewAccount((p) => ({ ...p, min_lbs_biweekly: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min lbs (ad hoc)</label>
                    <input type="number" min="0" value={newAccount.min_lbs_adhoc}
                      onChange={(e) => setNewAccount((p) => ({ ...p, min_lbs_adhoc: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Projected lbs/week</label>
                    <input type="number" min="0" value={newAccount.projected_lbs_week}
                      onChange={(e) => setNewAccount((p) => ({ ...p, projected_lbs_week: e.target.value }))}
                      placeholder="Optional estimate"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contract Date</label>
                    <input type="date" value={newAccount.contract_date}
                      onChange={(e) => setNewAccount((p) => ({ ...p, contract_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea rows={2} value={newAccount.notes}
                    onChange={(e) => setNewAccount((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Any relevant notes about this account"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <button type="submit" disabled={newAccountLoading || !newAccount.org_name}
                className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {newAccountLoading ? "Creating…" : "Create Discard Account"}
              </button>
            </form>
          )}

          {/* Account list */}
          {discardLoading ? <p className="text-gray-500 text-sm">Loading…</p>
           : discardAccounts.length === 0 ? <p className="text-gray-400 text-sm italic">No discard accounts yet.</p>
           : (
            <div className="space-y-2">
              {discardAccounts.map((acct) => {
                const isExpanded = selectedDiscard?.id === acct.id;
                return (
                  <div key={acct.id} className={`border rounded-xl overflow-hidden transition-colors ${isExpanded ? "border-nct-navy" : "border-gray-200"}`}>

                    {/* Collapsed header */}
                    <button
                      onClick={() => setSelectedDiscard(isExpanded ? null : acct)}
                      className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{acct.org_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {acct.contact_name ? `${acct.contact_name} · ` : ""}
                            {acct.pickup_frequency} · ${acct.rate_per_1000_lbs}/1,000 lbs
                            {acct.contact_email ? ` · ${acct.contact_email}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${acct.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {acct.status}
                          </span>
                          <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>
                    </button>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">

                        {/* Account details */}
                        <div className="px-5 py-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Account Details</p>
                          <dl className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                            {[
                              ["Address", [acct.address_street, acct.address_city, acct.address_state, acct.address_zip].filter(Boolean).join(", ")],
                              ["Contact", acct.contact_name],
                              ["Email", acct.contact_email],
                              ["Phone", acct.contact_phone],
                              ["Frequency", acct.pickup_frequency],
                              ["Rate", `$${acct.rate_per_1000_lbs} per 1,000 lbs`],
                              ["Min (weekly)", acct.min_lbs_weekly ? `${acct.min_lbs_weekly.toLocaleString()} lbs` : null],
                              ["Min (biweekly)", acct.min_lbs_biweekly ? `${acct.min_lbs_biweekly.toLocaleString()} lbs` : null],
                              ["Min (ad hoc)", acct.min_lbs_adhoc ? `${acct.min_lbs_adhoc.toLocaleString()} lbs` : null],
                              ["Projected/wk", acct.projected_lbs_week ? `${acct.projected_lbs_week.toLocaleString()} lbs` : null],
                              ["Contract Date", acct.contract_date ? new Date(acct.contract_date + "T00:00:00").toLocaleDateString() : null],
                              ["Notes", acct.notes],
                            ].filter(([, v]) => v).map(([label, val]) => (
                              <div key={label} className="flex gap-2">
                                <dt className="text-gray-500 w-32 shrink-0">{label}:</dt>
                                <dd className="font-medium break-all">{val}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>

                        {/* Financial summary */}
                        {(() => {
                          const pending = discardPickups.filter((p) => p.payment_status === "pending");
                          const paid = discardPickups.filter((p) => p.payment_status === "paid");
                          const outstanding = pending.reduce((s, p) => s + parseFloat(p.amount_owed || 0), 0);
                          const totalPaid = paid.reduce((s, p) => s + parseFloat(p.amount_owed || 0), 0);
                          const totalLbs = discardPickups.filter((p) => p.accepted !== false).reduce((s, p) => s + parseFloat(p.weight_lbs || 0), 0);
                          if (discardPickups.length === 0) return null;
                          return (
                            <div className="px-5 py-4">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Financial Summary</p>
                              <div className="grid grid-cols-3 gap-3">
                                <div className={`rounded-lg p-3 text-center ${outstanding > 0 ? "bg-yellow-50" : "bg-gray-50"}`}>
                                  <p className={`text-xl font-bold ${outstanding > 0 ? "text-yellow-700" : "text-gray-400"}`}>
                                    ${outstanding.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">Outstanding</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 text-center">
                                  <p className="text-xl font-bold text-green-700">${totalPaid.toFixed(2)}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Total Paid</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-3 text-center">
                                  <p className="text-xl font-bold text-nct-navy">{totalLbs.toLocaleString()}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Total lbs</p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Log pickup form */}
                        <div className="px-5 py-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Log Pickup</p>
                          <form onSubmit={handleLogPickup} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Pickup Date *</label>
                                <input type="date" required value={pickupForm.pickup_date}
                                  onChange={(e) => setPickupForm((p) => ({ ...p, pickup_date: e.target.value }))}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Pickup Time</label>
                                <input type="time" value={pickupForm.pickup_time}
                                  onChange={(e) => setPickupForm((p) => ({ ...p, pickup_time: e.target.value }))}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Weight (lbs) *</label>
                                <input type="number" min="0" step="0.1" required value={pickupForm.weight_lbs}
                                  onChange={(e) => setPickupForm((p) => ({ ...p, weight_lbs: e.target.value }))}
                                  placeholder="e.g. 3500"
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                                {pickupForm.weight_lbs && (
                                  <p className="text-xs text-green-600 mt-0.5 font-medium">
                                    Est. owed: ${calcDiscardPayment(pickupForm.weight_lbs, pickupForm.load_type, selectedDiscard).toFixed(2)}
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Load Type</label>
                                <select value={pickupForm.load_type}
                                  onChange={(e) => setPickupForm((p) => ({ ...p, load_type: e.target.value }))}
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                                  <option value="recurring">Recurring</option>
                                  <option value="single_run">Single Run (Ad Hoc)</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <label className="text-xs font-medium text-gray-600">Load Accepted?</label>
                              <div className="flex gap-2">
                                <button type="button"
                                  onClick={() => setPickupForm((p) => ({ ...p, accepted: true, rejection_reason: "" }))}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${pickupForm.accepted ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300 hover:border-green-400"}`}>
                                  Yes
                                </button>
                                <button type="button"
                                  onClick={() => setPickupForm((p) => ({ ...p, accepted: false }))}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${!pickupForm.accepted ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300 hover:border-red-400"}`}>
                                  No (Rejected)
                                </button>
                              </div>
                            </div>
                            {!pickupForm.accepted && (
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Rejection Reason</label>
                                <input type="text" value={pickupForm.rejection_reason}
                                  onChange={(e) => setPickupForm((p) => ({ ...p, rejection_reason: e.target.value }))}
                                  placeholder="e.g. Non-textile items in load"
                                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                              </div>
                            )}
                            <div>
                              <label className="text-xs text-gray-500 block mb-0.5">Notes</label>
                              <input type="text" value={pickupForm.notes}
                                onChange={(e) => setPickupForm((p) => ({ ...p, notes: e.target.value }))}
                                placeholder="Optional internal notes"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                            </div>
                            <button type="submit" disabled={pickupFormLoading || !pickupForm.pickup_date || !pickupForm.weight_lbs}
                              className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white text-sm font-bold py-2 rounded transition-colors disabled:opacity-50">
                              {pickupFormLoading ? "Logging…" : "Log Pickup →"}
                            </button>
                          </form>
                        </div>

                        {/* Pickup history */}
                        <div className="px-5 py-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pickup History</p>
                          {discardPickupsLoading ? (
                            <p className="text-xs text-gray-400">Loading…</p>
                          ) : discardPickups.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No pickups logged yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {discardPickups.map((pu) => (
                                <div key={pu.id} className={`border rounded-lg p-3 text-sm ${pu.payment_status === "paid" ? "border-green-200 bg-green-50" : pu.payment_status === "voided" ? "border-gray-100 bg-gray-50" : !pu.accepted ? "border-red-100 bg-red-50" : "border-gray-200 bg-white"}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-nct-navy">
                                          {new Date(pu.pickup_date + "T00:00:00").toLocaleDateString()}
                                          {pu.pickup_time ? ` ${pu.pickup_time}` : ""}
                                        </span>
                                        <span className="text-gray-600">{parseFloat(pu.weight_lbs).toLocaleString()} lbs</span>
                                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                                          pu.payment_status === "paid" ? "bg-green-100 text-green-700"
                                          : pu.payment_status === "voided" ? "bg-gray-100 text-gray-500"
                                          : "bg-yellow-100 text-yellow-700"
                                        }`}>
                                          {pu.payment_status}
                                        </span>
                                        {!pu.accepted && <span className="text-xs bg-red-100 text-red-700 font-semibold px-1.5 py-0.5 rounded-full">Rejected</span>}
                                        {pu.load_type === "single_run" && <span className="text-xs text-gray-400">Ad Hoc</span>}
                                      </div>
                                      <div className="flex items-center gap-3 mt-0.5">
                                        <span className={`font-bold ${pu.payment_status === "voided" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                          ${parseFloat(pu.amount_owed).toFixed(2)}
                                        </span>
                                        {pu.payment_method && <span className="text-xs text-gray-400">via {pu.payment_method}</span>}
                                        {pu.payment_date && <span className="text-xs text-gray-400">paid {new Date(pu.payment_date + "T00:00:00").toLocaleDateString()}</span>}
                                        {pu.rejection_reason && <span className="text-xs text-red-600">Reason: {pu.rejection_reason}</span>}
                                      </div>
                                      {pu.notes && <p className="text-xs text-gray-400 mt-0.5">{pu.notes}</p>}
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                      {pu.payment_status === "pending" && (
                                        <button
                                          onClick={() => { setMarkingPaid(pu.id === markingPaid ? null : pu.id); setPaymentMethod(""); }}
                                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-lg transition-colors">
                                          Mark Paid
                                        </button>
                                      )}
                                      {pu.payment_status === "pending" && (
                                        <button onClick={() => handleVoidPickup(pu.id)}
                                          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-300 px-2 py-1 rounded-lg transition-colors">
                                          Void
                                        </button>
                                      )}
                                      <button onClick={() => handleDeletePickup(pu.id)}
                                        className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
                                    </div>
                                  </div>

                                  {/* Mark paid inline panel */}
                                  {markingPaid === pu.id && (
                                    <div className="mt-2 pt-2 border-t border-green-200 flex items-end gap-2">
                                      <div className="flex-1">
                                        <label className="text-xs text-gray-500 block mb-0.5">Payment Method</label>
                                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                                          <option value="">Select…</option>
                                          <option value="check">Check</option>
                                          <option value="ach">ACH</option>
                                          <option value="cash">Cash</option>
                                          <option value="other">Other</option>
                                        </select>
                                      </div>
                                      <button
                                        onClick={() => handleMarkPaid(pu.id, paymentMethod)}
                                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors whitespace-nowrap">
                                        ✓ Confirm Payment
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Danger zone */}
                        <div className="px-5 py-3 flex justify-end">
                          <button onClick={() => handleDeleteDiscardAccount(acct.id)}
                            className="text-xs text-red-400 hover:text-red-600 underline transition-colors">
                            Delete account and all pickups
                          </button>
                        </div>

                      </div>
                    )}
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
