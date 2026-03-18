"use client";
import { useState, useEffect, useRef } from "react";

export default function TaxReceiptSection() {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null); // lot id being uploaded
  const [message, setMessage] = useState({ id: null, text: "", ok: true });
  const fileInputRef = useRef(null);
  const pendingLotRef = useRef(null);

  async function fetchLots() {
    setLoading(true);
    const res = await fetch("/api/nonprofit/tax-receipt");
    const json = await res.json();
    setLots(json.lots || []);
    setLoading(false);
  }

  useEffect(() => { fetchLots(); }, []);

  function handleUploadClick(lotId) {
    pendingLotRef.current = lotId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    const lotId = pendingLotRef.current;
    if (!file || !lotId) return;

    e.target.value = "";
    setUploading(lotId);
    setMessage({ id: null, text: "", ok: true });

    const fd = new FormData();
    fd.append("lot_id", lotId);
    fd.append("file", file);

    const res = await fetch("/api/nonprofit/tax-receipt", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(null);

    if (res.ok) {
      setMessage({ id: lotId, text: "Receipt uploaded successfully.", ok: true });
      fetchLots();
    } else {
      setMessage({ id: lotId, text: json.error || "Upload failed.", ok: false });
    }
  }

  async function handleViewReceipt(lotId) {
    const res = await fetch("/api/nonprofit/tax-receipt/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lot_id: lotId }),
    });
    const json = await res.json();
    if (json.url) window.open(json.url, "_blank");
  }

  const totalPieces = lots.reduce((s, l) => s + (l.piece_count || 0), 0);
  const totalValue = lots.reduce((s, l) => s + parseFloat(l.total_value || 0), 0);
  const pendingCount = lots.filter((l) => l.receipt_status === "pending_receipt").length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="font-bold text-nct-navy text-lg mb-1">Donation Lots & Tax Receipts</h2>
      <p className="text-sm text-gray-500 mb-4">
        NCT Recycling logs each lot of inventory donated to your organization. You are required to upload a written tax
        receipt for each lot within 30 days of receipt.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 text-center mb-5">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-3xl font-bold text-nct-navy">{totalPieces.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Total Pieces Received</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-3xl font-bold text-green-700">
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total Tax Receipt Value</p>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center mb-5">
        Inventory valued at $5.00/piece per co-op agreement (IRC § 170).
      </p>

      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 text-sm text-yellow-800 mb-4">
          ⚠ {pendingCount} lot{pendingCount > 1 ? "s" : ""} pending your tax receipt upload.
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
      />

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : lots.length === 0 ? (
        <p className="text-gray-400 text-sm">No donation lots recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {lots.map((lot) => (
            <div key={lot.id} className={`border rounded-lg p-4 ${lot.receipt_status === "pending_receipt" ? "border-yellow-300 bg-yellow-50" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-nct-navy">
                      {lot.piece_count?.toLocaleString()} pieces
                    </span>
                    <span className="text-green-700 text-sm font-medium">
                      — ${parseFloat(lot.total_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      lot.receipt_status === "uploaded"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {lot.receipt_status === "uploaded" ? "✓ Receipt on file" : "Receipt needed"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Lot date: {lot.lot_date ? new Date(lot.lot_date + "T00:00:00").toLocaleDateString() : "—"}
                    {lot.notes ? ` · ${lot.notes}` : ""}
                  </p>
                  {message.id === lot.id && (
                    <p className={`text-xs mt-1 ${message.ok ? "text-green-600" : "text-red-600"}`}>
                      {message.text}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {lot.receipt_status === "uploaded" ? (
                    <button
                      onClick={() => handleViewReceipt(lot.id)}
                      className="text-xs text-nct-navy underline hover:text-nct-gold"
                    >
                      View Receipt →
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUploadClick(lot.id)}
                      disabled={uploading === lot.id}
                      className="text-xs bg-nct-navy text-white px-3 py-1.5 rounded-lg hover:bg-nct-navy-dark transition-colors disabled:opacity-50"
                    >
                      {uploading === lot.id ? "Uploading…" : "Upload Receipt"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
