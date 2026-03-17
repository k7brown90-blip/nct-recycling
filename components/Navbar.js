"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const navLinks = [
  { href: "/shop", label: "Shop" },
  { href: "/donate", label: "Donate" },
  { href: "/nonprofit-partners", label: "Nonprofit Partners" },
  { href: "/retail-partners", label: "Retail Partners" },
  { href: "/community-partners", label: "Our Partners" },
  { href: "/wholesale", label: "Wholesale" },
  { href: "/contact", label: "Contact" },
  { href: "/apply", label: "Apply" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-nct-navy text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/nct-logo.png"
            alt="NCT Recycling"
            width={48}
            height={48}
            className="rounded"
          />
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
          <Link
            href="/donate"
            className="bg-nct-gold hover:bg-nct-gold-dark text-white text-sm font-bold px-4 py-2 rounded transition-colors"
          >
            Donate Now
          </Link>
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
          <Link
            href="/donate"
            className="bg-nct-gold hover:bg-nct-gold-dark text-white text-sm font-bold px-4 py-2 rounded text-center transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Donate Now
          </Link>
        </div>
      )}
    </nav>
  );
}
