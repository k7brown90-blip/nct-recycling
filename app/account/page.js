"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AccountSettingsPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("Failed to update password. Please try again.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setPassword("");
    setConfirm("");
    setLoading(false);
  }

  return (
    <main className="min-h-[70vh] max-w-xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-nct-navy">← Back to dashboard</Link>
      </div>

      <h1 className="text-3xl font-bold text-nct-navy mb-2">Account Settings</h1>
      <p className="text-gray-600 text-sm mb-8">Update your login password below.</p>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
        <h2 className="text-lg font-semibold text-nct-navy mb-5">Change Password</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
              required
              minLength={8}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm font-medium">Password updated successfully.</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Saving…" : "Update Password"}
          </button>
        </form>
      </div>
    </main>
  );
}
