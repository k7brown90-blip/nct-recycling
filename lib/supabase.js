import { createClient } from "@supabase/supabase-js";

// Server-side client with service role key (bypasses RLS — use only in API routes)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
