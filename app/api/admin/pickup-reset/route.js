import { createServiceClient } from "@/lib/supabase";
import { markCanonicalCoOpPickupCollected, updateCanonicalCoOpRequestStatus } from "@/lib/co-op-canonical";
import { markCanonicalDiscardPickupCollected, updateCanonicalDiscardPickupRequest } from "@/lib/discard-canonical";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

function normalizeStatuses(statuses) {
  const valid = ["pending", "scheduled", "completed", "cancelled"];
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return ["pending", "scheduled"];
  }
  const normalized = statuses.filter((status) => valid.includes(status));
  return normalized.length ? normalized : ["pending", "scheduled"];
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("could not find") && message.includes(`'${columnName.toLowerCase()}'`) && message.includes("column");
}

async function updateWithScheduledDateFallback(db, tableName, ids, payload) {
  const { error } = await db
    .from(tableName)
    .update(payload)
    .in("id", ids);
  if (error && isMissingColumnError(error, "scheduled_date")) {
    const { scheduled_date: _ignored, ...withoutScheduledDate } = payload;
    return db
      .from(tableName)
      .update(withoutScheduledDate)
      .in("id", ids);
  }
  return { error };
}

export async function POST(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const program = ["co_op", "discard", "all"].includes(body.program) ? body.program : "all";
  const targetStatus = ["pending", "scheduled", "completed", "cancelled"].includes(body.target_status)
    ? body.target_status
    : "cancelled";
  const fromStatuses = normalizeStatuses(body.from_statuses);
  const dryRun = body.dry_run !== false;
  const resetBagCounts = body.reset_bag_counts !== false;
  const note = (typeof body.note === "string" && body.note.trim())
    ? body.note.trim()
    : "Admin test reset";

  const db = createServiceClient();

  const [coOpRows, discardRows] = await Promise.all([
    (program === "all" || program === "co_op")
      ? db
          .from("nonprofit_pickup_requests")
          .select("id, nonprofit_id, status")
          .in("status", fromStatuses)
      : Promise.resolve({ data: [], error: null }),
    (program === "all" || program === "discard")
      ? db
          .from("discard_pickup_requests")
          .select("id, discard_account_id, status")
          .in("status", fromStatuses)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (coOpRows.error) {
    return NextResponse.json({ error: "Failed to load co-op requests.", detail: coOpRows.error.message }, { status: 500 });
  }
  if (discardRows.error) {
    return NextResponse.json({ error: "Failed to load discard requests.", detail: discardRows.error.message }, { status: 500 });
  }

  const coOpRequests = coOpRows.data || [];
  const discardRequests = discardRows.data || [];
  const nonprofitIds = [...new Set(coOpRequests.map((row) => row.nonprofit_id).filter(Boolean))];
  const discardAccountIds = [...new Set(discardRequests.map((row) => row.discard_account_id).filter(Boolean))];

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      program,
      from_statuses: fromStatuses,
      target_status: targetStatus,
      reset_bag_counts: resetBagCounts,
      counts: {
        co_op_requests: coOpRequests.length,
        discard_requests: discardRequests.length,
        co_op_accounts: nonprofitIds.length,
        discard_accounts: discardAccountIds.length,
      },
      sample: {
        co_op_request_ids: coOpRequests.slice(0, 10).map((row) => row.id),
        discard_request_ids: discardRequests.slice(0, 10).map((row) => row.id),
      },
    });
  }

  if (coOpRequests.length > 0) {
    const { error } = await updateWithScheduledDateFallback(
      db,
      "nonprofit_pickup_requests",
      coOpRequests.map((row) => row.id),
      { status: targetStatus, scheduled_date: null }
    );
    if (error) {
      return NextResponse.json({ error: "Failed to reset co-op requests.", detail: error.message }, { status: 500 });
    }
  }

  if (discardRequests.length > 0) {
    const { error } = await updateWithScheduledDateFallback(
      db,
      "discard_pickup_requests",
      discardRequests.map((row) => row.id),
      { status: targetStatus, scheduled_date: null, admin_notes: note }
    );
    if (error) {
      return NextResponse.json({ error: "Failed to reset discard requests.", detail: error.message }, { status: 500 });
    }
  }

  const canonicalErrors = [];

  await Promise.all(
    coOpRequests.map(async (row) => {
      try {
        await updateCanonicalCoOpRequestStatus(db, row.nonprofit_id, targetStatus, row.id);
      } catch (error) {
        canonicalErrors.push({ type: "co_op_request", id: row.id, error: error?.message || "canonical sync failed" });
      }
    })
  );

  await Promise.all(
    discardRequests.map(async (row) => {
      try {
        await updateCanonicalDiscardPickupRequest(db, row.id, {
          status: targetStatus,
          scheduled_date: null,
          admin_notes: note,
        });
      } catch (error) {
        canonicalErrors.push({ type: "discard_request", id: row.id, error: error?.message || "canonical sync failed" });
      }
    })
  );

  if (resetBagCounts) {
    if (nonprofitIds.length > 0) {
      const { error } = await db.from("bag_counts").insert(
        nonprofitIds.map((nonprofitId) => ({
          nonprofit_id: nonprofitId,
          bag_count: 0,
          entry_type: "pickup",
          notes: note,
        }))
      );
      if (error) {
        return NextResponse.json({ error: "Failed to reset co-op bag counts.", detail: error.message }, { status: 500 });
      }

      await Promise.all(
        nonprofitIds.map(async (nonprofitId) => {
          try {
            await markCanonicalCoOpPickupCollected(db, nonprofitId, note);
          } catch (err) {
            canonicalErrors.push({ type: "co_op_bag_count", id: nonprofitId, error: err?.message || "canonical bag sync failed" });
          }
        })
      );
    }

    if (discardAccountIds.length > 0) {
      const { error } = await db.from("discard_bag_counts").insert(
        discardAccountIds.map((accountId) => ({
          discard_account_id: accountId,
          bag_count: 0,
          entry_type: "pickup",
          notes: note,
        }))
      );
      if (error) {
        return NextResponse.json({ error: "Failed to reset discard bag counts.", detail: error.message }, { status: 500 });
      }

      await Promise.all(
        discardAccountIds.map(async (accountId) => {
          try {
            await markCanonicalDiscardPickupCollected(db, accountId);
          } catch (err) {
            canonicalErrors.push({ type: "discard_bag_count", id: accountId, error: err?.message || "canonical bag sync failed" });
          }
        })
      );
    }
  }

  return NextResponse.json({
    success: true,
    program,
    from_statuses: fromStatuses,
    target_status: targetStatus,
    reset_bag_counts: resetBagCounts,
    updated: {
      co_op_requests: coOpRequests.length,
      discard_requests: discardRequests.length,
      co_op_accounts: nonprofitIds.length,
      discard_accounts: discardAccountIds.length,
    },
    canonical_errors: canonicalErrors,
    no_notifications_sent: true,
  });
}
