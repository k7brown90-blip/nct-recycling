"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "true";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [verificationIssue, setVerificationIssue] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    setSessionReady(false);
    setLinkError("");
    setVerificationIssue("");

    function markReady() {
      if (!settled) {
        settled = true;
        setSessionReady(true);
        setVerificationIssue("");
        setLinkError("");
      }
    }

    function markFailed(reason) {
      if (!settled) {
        settled = true;
        console.error("Auth link error:", reason);
        setLinkError(reason || "This link has expired or is invalid.");
      }
    }

    function markSlow(reason) {
      if (!settled) {
        setVerificationIssue(reason);
      }
    }

    // Register listener first — catches SIGNED_IN / PASSWORD_RECOVERY events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        markReady();
      }
    });

    async function init() {
      try {
        // 1. PKCE flow: code in query params (?code=xxx)
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("exchangeCodeForSession error:", error.message);
            markFailed("We couldn't verify this link. It may have expired, already been used, or your browser may have blocked the secure sign-in handoff.");
            return;
          }
          if (data?.session) { markReady(); return; }
        }

        // 2. Implicit flow: tokens in URL hash (#access_token=xxx&refresh_token=xxx)
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              console.error("setSession error:", error.message);
              markFailed("We couldn't verify this link. It may have expired, already been used, or your browser may have blocked the secure sign-in handoff.");
              return;
            }
            if (data?.session) { markReady(); return; }
          }
        }

        // 3. Session may already exist (e.g. page refresh)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) { markReady(); return; }

        // 4. Nothing worked — timeout will trigger the error state
      } catch (err) {
        console.error("Auth init exception:", err);
      }
    }

    init();

    // Soft timeout: don't declare the link expired just because session setup is slow.
    const timeout = setTimeout(() => {
      markSlow("This is taking longer than expected. Your browser may still be processing the secure sign-in handoff.");
    }, 12000);

    return () => {
      settled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [retryCount]);

  function handleRetryVerification() {
    setRetryCount((count) => count + 1);
  }

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
      setError("Failed to update password. The link may have expired.");
      setLoading(false);
      return;
    }

    if (isWelcome) {
      await supabase.auth.updateUser({ data: { setup_required: false } });
    }

    router.push("/dashboard");
    router.refresh();
  }

  // Link expired / invalid state
  if (linkError) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8">
            <div className="text-4xl mb-4">🔗</div>
            <h1 className="text-xl font-bold text-red-700 mb-2">Link Expired or Already Used</h1>
            <p className="text-gray-600 text-sm mb-4">{linkError}</p>
            <p className="text-gray-500 text-sm">
              Email us at{" "}
              <a href="mailto:donate@nctrecycling.com" className="text-nct-navy underline">
                donate@nctrecycling.com
              </a>{" "}
              or call{" "}
              <a href="tel:+19702329108" className="text-nct-navy underline">(970) 232-9108</a>.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRetryVerification}
            className="mt-6 w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-lg transition-colors"
          >
            Retry Verification
          </button>
          <Link href="/auth/forgot-password" className="block mt-6 text-sm text-nct-navy underline">
            Already have an account? Reset your password →
          </Link>
        </div>
      </main>
    );
  }

  // Verifying state
  if (!sessionReady) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-8 h-8 border-4 border-nct-navy border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Verifying your link…</p>
          {verificationIssue && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
              <h2 className="text-sm font-bold text-amber-800 mb-2">Still Working</h2>
              <p className="text-sm text-amber-700">{verificationIssue}</p>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleRetryVerification}
                  className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-lg transition-colors"
                >
                  Retry Verification
                </button>
                <Link href="/auth/forgot-password" className="text-sm text-nct-navy underline">
                  Request a new password link →
                </Link>
              </div>
            </div>
          )}
        </div>
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

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[70vh] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading…</p>
      </main>
    }>
      <UpdatePasswordForm />
    </Suspense>
  );
}
