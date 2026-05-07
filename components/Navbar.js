"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/donate", label: "Donate" },
  { href: "/partners", label: "Partners" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [authedUser, setAuthedUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const applyRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (applyRef.current && !applyRef.current.contains(e.target)) {
        setApplyOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setAuthedUser(data?.user || null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthedUser(session?.user || null);
      setAuthReady(true);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="bg-nct-navy text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="bg-white rounded-lg p-1 shadow-md">
            <Image
              src="/images/nct-logo.png"
              alt="NCT Recycling"
              width={56}
              height={56}
              className="rounded"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-bold tracking-wide text-white">NCT Recycling</span>
            <span className="text-xs text-nct-gold font-medium tracking-widest uppercase">Fort Collins, CO</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-200 hover:text-nct-gold transition-colors"
            >
              {link.label}
            </Link>
          ))}

          {/* Apply dropdown */}
          <div className="relative" ref={applyRef}>
            <button
              onClick={() => setApplyOpen((v) => !v)}
              className="text-sm font-medium text-gray-200 hover:text-nct-gold transition-colors flex items-center gap-1"
            >
              Apply
              <svg className={`w-3 h-3 transition-transform ${applyOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {applyOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                <Link
                  href="/apply"
                  onClick={() => setApplyOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-nct-navy"
                >
                  Reseller Application
                </Link>
                <Link
                  href="/co-op-apply"
                  onClick={() => setApplyOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-nct-navy"
                >
                  Co-Op Partner Application
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/donate"
            className="bg-nct-gold hover:bg-nct-gold-dark text-white text-sm font-bold px-4 py-2 rounded transition-colors whitespace-nowrap"
          >
            Donate Now
          </Link>

          {authReady && (
            authedUser ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-white bg-white/10 hover:bg-nct-gold hover:text-white border border-white/30 px-3 py-2 rounded transition-colors whitespace-nowrap"
                >
                  My Portal
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm font-medium text-gray-200 hover:text-nct-gold transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-gray-200 hover:text-nct-gold transition-colors border border-white/30 px-3 py-2 rounded"
              >
                Login
              </Link>
            )
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className="block w-6 h-0.5 bg-white mb-1.5"></span>
          <span className="block w-6 h-0.5 bg-white mb-1.5"></span>
          <span className="block w-6 h-0.5 bg-white"></span>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-nct-navy-dark border-t border-white/10 px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-200 hover:text-nct-gold transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Apply</p>
            <Link
              href="/apply"
              className="text-sm font-medium text-gray-200 hover:text-nct-gold transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Reseller Application
            </Link>
            <Link
              href="/co-op-apply"
              className="text-sm font-medium text-gray-200 hover:text-nct-gold transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Co-op Partner Application
            </Link>
          </div>
          <Link
            href="/donate"
            className="bg-nct-gold hover:bg-nct-gold-dark text-white text-sm font-bold px-4 py-2 rounded text-center transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Donate Now
          </Link>

          {authReady && (
            authedUser ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-white bg-white/10 border border-white/30 px-3 py-2 rounded text-center transition-colors hover:bg-nct-gold"
                  onClick={() => setMenuOpen(false)}
                >
                  My Portal
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm font-medium text-gray-200 hover:text-nct-gold transition-colors text-center"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-gray-200 hover:text-nct-gold transition-colors border border-white/30 px-3 py-2 rounded text-center"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
            )
          )}
        </div>
      )}
    </nav>
  );
}
