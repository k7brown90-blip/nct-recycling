import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Check env vars are present
  const envCheck = {
    url: url ? "✅ set" : "❌ missing",
    anonKey: anonKey ? "✅ set" : "❌ missing",
    serviceKey: serviceKey ? "✅ set" : "❌ missing",
  };

  // Try a simple Supabase query
  let dbCheck = "not attempted";
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("reseller_applications")
      .select("id")
      .limit(1);
    dbCheck = error ? `❌ ${error.message}` : "✅ connected";
  } catch (err) {
    dbCheck = `❌ threw: ${err.message}`;
  }

  return NextResponse.json({ envCheck, dbCheck });
}
