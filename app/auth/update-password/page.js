"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "true";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Handle password reset link: Supabase passes code in the URL hash or query
    const supabase = createClient();

    // Listen for the PASSWORD_RECOVERY event (fired when reset link is clicked)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });

    // Also check if already have a session (invite flow lands here after callback)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

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
      setError("Failed to update password. The reset link may have expired.");
      setLoading(false);
      return;
    }

    // Clear setup flag if this was a first-login invite
    if (isWelcome) {
      await supabase.auth.updateUser({ data: { setup_required: false } });
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (!sessionReady) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <p className="text-gray-500 text-sm">Verifying your link…</p>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {isWelcome ? (
            <>
              <div className="text-4xl mb-3">👋</div>
              <h1 className="text-3xl font-bold text-nct-navy mb-2">Welcome to NCT Recycling</h1>
              <p className="text-gray-600 text-sm">
                Your partner account is approved. Set a password to access your portal.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-nct-navy mb-2">Set a new password</h1>
              <p className="text-gray-600 text-sm">Choose a strong password for your account.</p>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
              required
              autoFocus
              minLength={8}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Saving…" : isWelcome ? "Set Password & Enter Portal" : "Update Password"}
          </button>
        </form>
      </div>
    </main>
  );
}
