import { createServiceClient } from "@/lib/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data: profile } = await db.from("profiles").select("application_id, role").eq("id", user.id).single();
  if (!profile || profile.role !== "nonprofit") return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { data: signedUrl, error } = await db.storage
    .from("nonprofit-docs")
    .createSignedUrl(`agreements/${profile.application_id}.pdf`, 300); // 5 min

  if (error || !signedUrl) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });

  return NextResponse.json({ url: signedUrl.signedUrl });
}
