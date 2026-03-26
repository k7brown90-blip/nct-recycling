"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AppointmentQuoteCard({ appt }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const total = (parseFloat(appt.labor_cost || 0) + parseFloat(appt.shipping_cost || 0)).toFixed(2);

  async function respond(action) {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/nonprofit/exchange-appointment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: appt.id, action }),
    });
    if (res.ok) {
      setMessage(action === "confirm_quote" ? "✅ Quote confirmed! NCT will schedule your shipment." : "Quote declined. You can submit a new request anytime.");
      router.refresh();
    } else {
      const json = await res.json();
      setMessage(json.error || "Something went wrong.");
    }
    setLoading(false);
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mt-3">
      <p className="text-sm font-bold text-amber-800 mb-2">📦 Delivery Cost Quote — Action Required</p>
      <p className="text-xs text-gray-600 mb-3">
        NCT has prepared a cost estimate for your delivery. Please review and confirm or decline.
      </p>
      <table className="w-full text-sm mb-3 border-collapse">
        <tbody>
          <tr className="border-b border-amber-200">
            <td className="py-1.5 text-gray-600">Labor (curation)</td>
            <td className="py-1.5 text-right font-medium">${parseFloat(appt.labor_cost).toFixed(2)}</td>
          </tr>
          <tr className="border-b border-amber-200">
            <td className="py-1.5 text-gray-600">FedEx Shipping</td>
            <td className="py-1.5 text-right font-medium">${parseFloat(appt.shipping_cost).toFixed(2)}</td>
          </tr>
          <tr>
            <td className="py-1.5 font-bold text-nct-navy">Total</td>
            <td className="py-1.5 text-right font-bold text-nct-navy">${total}</td>
          </tr>
        </tbody>
      </table>
      {appt.admin_notes && (
        <p className="text-xs text-gray-600 mb-3 bg-white rounded p-2 border border-amber-200">
          <span className="font-medium">Note from NCT:</span> {appt.admin_notes}
        </p>
      )}
      {message ? (
        <p className="text-sm font-medium text-center py-2">{message}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => respond("decline_quote")}
            disabled={loading}
            className="py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={() => respond("confirm_quote")}
            disabled={loading}
            className="py-2 bg-nct-navy text-white rounded-lg text-sm font-bold hover:bg-nct-navy-dark disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving…" : "Confirm Quote"}
          </button>
        </div>
      )}
    </div>
  );
}
