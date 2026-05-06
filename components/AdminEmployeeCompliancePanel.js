"use client";

import { useCallback, useEffect, useState } from "react";

const EQUIPMENT_TYPES = [
  { value: "baler", label: "Baler" },
  { value: "forklift", label: "Forklift (29 CFR 1910.178)" },
  { value: "other", label: "Other" },
];

function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default function AdminEmployeeCompliancePanel({ employee, authHeader }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [auths, setAuths] = useState([]);
  const [acks, setAcks] = useState({ signed: [], pending: [] });
  const [error, setError] = useState("");

  const [equipmentType, setEquipmentType] = useState("forklift");
  const [equipmentLabel, setEquipmentLabel] = useState("");
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [granting, setGranting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [authsRes, acksRes] = await Promise.all([
        fetch(`/api/admin/employees/${employee.id}/equipment-authorizations`, {
          headers: authHeader,
        }),
        fetch(`/api/admin/employees/${employee.id}/acknowledgments`, {
          headers: authHeader,
        }),
      ]);
      const authsJson = await authsRes.json();
      const acksJson = await acksRes.json();
      if (!authsRes.ok) throw new Error(authsJson.error || "Auth load failed");
      if (!acksRes.ok) throw new Error(acksJson.error || "Ack load failed");
      setAuths(authsJson.authorizations || []);
      setAcks({ signed: acksJson.signed || [], pending: acksJson.pending || [] });
    } catch (err) {
      setError(err.message || "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [employee.id, authHeader]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  async function handleGrant(e) {
    e.preventDefault();
    setGranting(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/employees/${employee.id}/equipment-authorizations`,
        {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            equipment_type: equipmentType,
            equipment_label: equipmentLabel || null,
            authorized_by_label: authorizedBy || "Admin",
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Grant failed");
      setEquipmentLabel("");
      setAuthorizedBy("");
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke(authId) {
    const reason = window.prompt("Reason for revoking? (optional)") || "Revoked by admin";
    try {
      const res = await fetch(
        `/api/admin/employees/${employee.id}/equipment-authorizations?authorizationId=${authId}`,
        {
          method: "DELETE",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revoke failed");
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-nct-navy hover:text-nct-gold underline"
      >
        {open ? "Hide compliance ▴" : "Compliance: equipment & agreements ▾"}
      </button>

      {open && (
        <div className="mt-3 space-y-4 text-sm">
          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-red-700 text-xs">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : (
            <>
              <div>
                <h4 className="font-semibold text-nct-navy mb-2">
                  Equipment Authorizations
                </h4>
                {auths.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">None on file.</p>
                ) : (
                  <ul className="space-y-1 mb-2">
                    {auths.map((a) => {
                      const expired = a.expires_at && new Date(a.expires_at) < new Date();
                      const revoked = !!a.revoked_at;
                      return (
                        <li
                          key={a.id}
                          className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded border ${
                            revoked
                              ? "bg-gray-50 border-gray-200 text-gray-500"
                              : expired
                                ? "bg-amber-50 border-amber-300"
                                : "bg-green-50 border-green-200"
                          }`}
                        >
                          <div className="text-xs">
                            <span className="font-semibold uppercase">
                              {a.equipment_type}
                            </span>
                            {a.equipment_label ? ` — ${a.equipment_label}` : ""}
                            <span className="text-gray-500 ml-2">
                              granted {fmtDate(a.authorized_at)}
                              {a.expires_at ? ` · expires ${fmtDate(a.expires_at)}` : ""}
                            </span>
                            {revoked && (
                              <span className="ml-2 text-red-600">
                                · revoked {fmtDate(a.revoked_at)}
                                {a.revoked_reason ? `: ${a.revoked_reason}` : ""}
                              </span>
                            )}
                          </div>
                          {!revoked && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(a.id)}
                              className="text-xs text-red-700 hover:underline"
                            >
                              Revoke
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <form
                  onSubmit={handleGrant}
                  className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_auto] gap-2 items-center"
                >
                  <select
                    value={equipmentType}
                    onChange={(e) => setEquipmentType(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 bg-white text-xs"
                  >
                    {EQUIPMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={equipmentLabel}
                    onChange={(e) => setEquipmentLabel(e.target.value)}
                    placeholder="Equipment label (e.g. Toyota 5K)"
                    className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                  />
                  <input
                    value={authorizedBy}
                    onChange={(e) => setAuthorizedBy(e.target.value)}
                    placeholder="Trainer/evaluator name"
                    className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={granting}
                    className="bg-nct-navy text-white text-xs font-bold rounded px-3 py-1.5 hover:bg-nct-navy-dark disabled:opacity-50"
                  >
                    {granting ? "Granting…" : "Grant"}
                  </button>
                </form>
              </div>

              <div>
                <h4 className="font-semibold text-nct-navy mb-2">
                  Agreement Acknowledgments
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-amber-700 mb-1">
                      Pending ({acks.pending.length})
                    </div>
                    {acks.pending.length === 0 ? (
                      <p className="text-gray-500 italic">All caught up.</p>
                    ) : (
                      <ul className="space-y-1">
                        {acks.pending.map((t) => (
                          <li key={t.id} className="border border-amber-200 bg-amber-50 rounded px-2 py-1">
                            {t.title} <span className="text-gray-500">v{t.version_label}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-green-700 mb-1">
                      Signed ({acks.signed.length})
                    </div>
                    {acks.signed.length === 0 ? (
                      <p className="text-gray-500 italic">None signed yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {acks.signed.map((s) => (
                          <li key={s.id} className="border border-green-200 bg-green-50 rounded px-2 py-1">
                            <span className="font-mono">{s.template_slug}</span>{" "}
                            <span className="text-gray-500">v{s.version_label}</span>
                            <div className="text-gray-500">
                              {s.signed_name} · {fmtDate(s.signed_at)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
