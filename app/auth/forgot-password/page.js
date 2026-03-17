"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-green-50 border border-green-200 rounded-xl p-8">
            <div className="text-4xl mb-4">✉️</div>
            <h1 className="text-2xl font-bold text-nct-navy mb-2">Check your email</h1>
            <p className="text-gray-600 text-sm mb-4">
              We sent a password reset link to <strong>{email}</strong>. Click the link in that email to set a new password.
            </p>
            <p className="text-gray-500 text-xs">Didn't get it? Check your spam folder or{" "}
              <button onClick={() => setSubmitted(false)} className="text-nct-navy underline">try again</button>.
            </p>
          </div>
          <Link href="/login" className="block mt-6 text-sm text-gray-500 hover:text-nct-navy">
            ← Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-nct-navy mb-2">Reset your password</h1>
          <p className="text-gray-600 text-sm">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
              required
              autoFocus
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/login" className="text-nct-navy underline">← Back to login</Link>
        </p>
      </div>
    </main>
  );
}
