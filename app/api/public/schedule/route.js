import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// Major US holidays that NCT is closed
function isHoliday(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const month = d.getMonth() + 1; // 1-based
  const day = d.getDate();
  const dow = d.getDay(); // 0=Sun

  // New Year's Day (Jan 1)
  if (month === 1 && day === 1) return "New Year's Day";
  // Memorial Day (last Monday in May)
  if (month === 5 && dow === 1 && day >= 25) return "Memorial Day";
  // Independence Day (Jul 4)
  if (month === 7 && day === 4) return "Independence Day";
  // Labor Day (first Monday in September)
  if (month === 9 && dow === 1 && day <= 7) return "Labor Day";
  // Thanksgiving (fourth Thursday in November)
  if (month === 11 && dow === 4 && day >= 22 && day <= 28) return "Thanksgiving";
  // Christmas (Dec 25)
  if (month === 12 && day === 25) return "Christmas";

  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) return NextResponse.json({ error: "start and end required." }, { status: 400 });

  const db = createServiceClient();

  // Get upcoming shopping days (route-based)
  const { data: shoppingDays } = await db
    .from("shopping_days")
    .select("id, shopping_date, status")
    .eq("status", "open")
    .gte("shopping_date", start)
    .lte("shopping_date", end)
    .order("shopping_date", { ascending: true });

  // Build calendar: for each date in range, determine what's open
  const events = [];
  const startDate = new Date(start + "T12:00:00");
  const endDate = new Date(end + "T12:00:00");

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const dow = d.getDay(); // 0=Sun, 1=Mon...6=Sat
    const holiday = isHoliday(dateStr);

    if (holiday) {
      events.push({ date: dateStr, type: "closed", label: `Closed — ${holiday}` });
      continue;
    }
    if (dow === 5 || dow === 6) continue; // Skip Fri/Sat entirely

    if (dow === 0) {
      // Sunday Bin Sale — always open (no route required)
      events.push({ date: dateStr, type: "sunday_bins", label: "Sunday Bin Sale · 12PM–4PM · $2/lb · Open to Everyone" });
    } else if (dow >= 1 && dow <= 4) {
      // Mon–Thu: boutique always open
      const boutique = { date: dateStr, type: "boutique", label: "Boutique · 12PM–6PM" };
      events.push(boutique);
      // Check if there's a shopping day (route-triggered bins)
      const sd = shoppingDays?.find((s) => s.shopping_date === dateStr);
      if (sd) {
        if (dow >= 2) {
          // Tue–Thu: reseller bins + public bins
          events.push({ date: dateStr, type: "bins_reseller", label: "Reseller Bins · 12PM–4PM (portal required)" });
          events.push({ date: dateStr, type: "bins_public", label: "Public Bins · 4PM–6PM" });
        }
      }
    }
  }

  return NextResponse.json({ events });
}
