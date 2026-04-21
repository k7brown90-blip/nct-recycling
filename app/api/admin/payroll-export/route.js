import { createServiceClient } from "@/lib/supabase";
import { buildPayrollCsv, getPayrollExportEntries } from "@/lib/payroll-export";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

function isValidDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function buildFileName(periodStart, periodEnd) {
  return `nct-payroll-${periodStart}-through-${periodEnd}.csv`;
}

async function rollbackPayrollBatch(batchId, timeEntryIds, db) {
  if (timeEntryIds.length > 0) {
    await db
      .from("employee_time_entries")
      .update({ payroll_batch_id: null })
      .eq("payroll_batch_id", batchId)
      .in("id", timeEntryIds);
  }

  await db
    .from("payroll_export_batches")
    .delete()
    .eq("id", batchId);
}

export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();
  const { searchParams } = new URL(request.url);
  const periodStart = searchParams.get("period_start");
  const periodEnd = searchParams.get("period_end");

  const { data: batches, error: batchesError } = await db
    .from("payroll_export_batches")
    .select("id, created_at, period_start, period_end, status, export_target, exported_at, quickbooks_payload, notes")
    .order("created_at", { ascending: false })
    .limit(12);

  if (batchesError) {
    return NextResponse.json({ error: batchesError.message }, { status: 500 });
  }

  let batchSummaries = [];
  const batchIds = (batches || []).map((batch) => batch.id).filter(Boolean);
  if (batchIds.length > 0) {
    const { data: batchEntries, error: batchEntriesError } = await db
      .from("employee_time_entries")
      .select("payroll_batch_id, employee_id, minutes_worked")
      .in("payroll_batch_id", batchIds);

    if (batchEntriesError) {
      return NextResponse.json({ error: batchEntriesError.message }, { status: 500 });
    }

    const summaryMap = new Map();
    for (const entry of batchEntries || []) {
      const current = summaryMap.get(entry.payroll_batch_id) || {
        entry_count: 0,
        total_minutes: 0,
        employee_ids: new Set(),
      };
      current.entry_count += 1;
      current.total_minutes += entry.minutes_worked || 0;
      if (entry.employee_id) current.employee_ids.add(entry.employee_id);
      summaryMap.set(entry.payroll_batch_id, current);
    }

    batchSummaries = (batches || []).map((batch) => {
      const batchSummary = summaryMap.get(batch.id);
      return {
        ...batch,
        entry_count: batchSummary?.entry_count || 0,
        total_minutes: batchSummary?.total_minutes || 0,
        total_hours: ((batchSummary?.total_minutes || 0) / 60).toFixed(2),
        employee_count: batchSummary?.employee_ids?.size || 0,
      };
    });
  } else {
    batchSummaries = [];
  }

  if (!periodStart && !periodEnd) {
    return NextResponse.json({ batches: batchSummaries });
  }

  if (!isValidDateString(periodStart) || !isValidDateString(periodEnd)) {
    return NextResponse.json({ error: "Valid period_start and period_end are required." }, { status: 400 });
  }
  if (new Date(`${periodEnd}T12:00:00`).getTime() < new Date(`${periodStart}T12:00:00`).getTime()) {
    return NextResponse.json({ error: "period_end must be on or after period_start." }, { status: 400 });
  }

  const preview = await getPayrollExportEntries(periodStart, periodEnd, db);
  return NextResponse.json({
    batches: batchSummaries,
    previewEntries: preview.entries,
    previewSummary: preview.summary,
    fileName: buildFileName(periodStart, periodEnd),
  });
}

export async function POST(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { period_start: periodStart, period_end: periodEnd, notes } = await request.json();
  if (!isValidDateString(periodStart) || !isValidDateString(periodEnd)) {
    return NextResponse.json({ error: "Valid period_start and period_end are required." }, { status: 400 });
  }
  if (new Date(`${periodEnd}T12:00:00`).getTime() < new Date(`${periodStart}T12:00:00`).getTime()) {
    return NextResponse.json({ error: "period_end must be on or after period_start." }, { status: 400 });
  }

  const db = createServiceClient();
  const payrollExport = await getPayrollExportEntries(periodStart, periodEnd, db);

  if (payrollExport.entries.length === 0) {
    return NextResponse.json({ error: "No eligible time entries were found for this payroll period." }, { status: 409 });
  }

  const exportedAt = new Date().toISOString();
  const { data: batch, error: batchError } = await db
    .from("payroll_export_batches")
    .insert({
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft",
      export_target: "csv",
      notes: notes || null,
    })
    .select("id, period_start, period_end, status, export_target, created_at, notes")
    .maybeSingle();

  if (batchError || !batch?.id) {
    return NextResponse.json({ error: batchError?.message || "Unable to create payroll batch." }, { status: 500 });
  }

  const timeEntryIds = payrollExport.entries.map((entry) => entry.id);
  const { data: updatedEntries, error: updateEntriesError } = await db
    .from("employee_time_entries")
    .update({ payroll_batch_id: batch.id })
    .in("id", timeEntryIds)
    .is("payroll_batch_id", null)
    .select("id");

  if (updateEntriesError) {
    await rollbackPayrollBatch(batch.id, [], db);
    return NextResponse.json({ error: updateEntriesError.message }, { status: 500 });
  }

  if ((updatedEntries || []).length !== timeEntryIds.length) {
    await rollbackPayrollBatch(batch.id, timeEntryIds, db);
    return NextResponse.json({ error: "Some time entries were already exported by another batch. Refresh the payroll preview and try again." }, { status: 409 });
  }

  const payloadSummary = {
    ...payrollExport.summary,
    exported_at: exportedAt,
    file_name: buildFileName(periodStart, periodEnd),
  };

  const { error: finalizeBatchError } = await db
    .from("payroll_export_batches")
    .update({
      status: "exported",
      exported_at: exportedAt,
      quickbooks_payload: payloadSummary,
    })
    .eq("id", batch.id);

  if (finalizeBatchError) {
    await rollbackPayrollBatch(batch.id, timeEntryIds, db);
    return NextResponse.json({ error: finalizeBatchError.message }, { status: 500 });
  }

  const fileName = buildFileName(periodStart, periodEnd);
  return NextResponse.json({
    success: true,
    batch: {
      ...batch,
      status: "exported",
      exported_at: exportedAt,
    },
    summary: payrollExport.summary,
    fileName,
    csvContent: buildPayrollCsv(payrollExport.entries),
  });
}