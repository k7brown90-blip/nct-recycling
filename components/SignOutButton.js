"use client";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/account" className="text-sm text-gray-500 hover:text-nct-navy underline transition-colors">
        Account Settings
      </Link>
      <button
        onClick={handleSignOut}
        className="text-sm text-gray-500 hover:text-red-600 underline transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
