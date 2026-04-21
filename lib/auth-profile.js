import { createServiceClient } from "@/lib/supabase";

const VALID_ROLES = new Set(["nonprofit", "reseller", "both", "discard", "employee"]);

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function buildProfileSeedFromUser(user) {
  const role = normalizeString(user?.user_metadata?.role);
  const application_id = normalizeString(user?.user_metadata?.application_id);
  const discard_account_id = normalizeString(user?.user_metadata?.discard_account_id);

  if (!user?.id || !VALID_ROLES.has(role)) return null;
  if (role === "discard" && !discard_account_id) return null;
  if (["nonprofit", "reseller", "both"].includes(role) && !application_id) return null;

  return {
    id: user.id,
    role,
    application_id: ["nonprofit", "reseller", "both"].includes(role) ? application_id : null,
    discard_account_id: role === "discard" ? discard_account_id : null,
  };
}

export async function upsertProfileRecord(profile, db = createServiceClient()) {
  const payload = {
    id: profile.id,
    role: profile.role,
    application_id: profile.application_id ?? null,
    discard_account_id: profile.discard_account_id ?? null,
  };

  const { error } = await db.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    throw new Error(`Profile upsert failed: ${error.message}`);
  }

  return payload;
}

export async function getOrCreateProfile(user, db = createServiceClient()) {
  if (!user?.id) return null;

  const { data: existing, error } = await db
    .from("profiles")
    .select("role, application_id, discard_account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Profile lookup failed: ${error.message}`);
  }

  const seed = buildProfileSeedFromUser(user);

  if (existing) {
    if (!seed) return existing;

    const repaired = {
      id: user.id,
      role: existing.role || seed.role,
      application_id: existing.application_id ?? seed.application_id ?? null,
      discard_account_id: existing.discard_account_id ?? seed.discard_account_id ?? null,
    };

    const needsRepair =
      repaired.role !== existing.role ||
      repaired.application_id !== (existing.application_id ?? null) ||
      repaired.discard_account_id !== (existing.discard_account_id ?? null);

    if (!needsRepair) return existing;

    await upsertProfileRecord(repaired, db);
    return {
      role: repaired.role,
      application_id: repaired.application_id,
      discard_account_id: repaired.discard_account_id,
    };
  }

  if (!seed) return null;

  await upsertProfileRecord(seed, db);
  return {
    role: seed.role,
    application_id: seed.application_id,
    discard_account_id: seed.discard_account_id,
  };
}
