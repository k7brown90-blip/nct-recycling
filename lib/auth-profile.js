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

// Fallback: when the auth user has no usable user_metadata (legacy invites,
// admin-created users, or users whose metadata was wiped by a Supabase reset)
// AND no profiles row, look up their email across the approved-partner tables
// so already-approved partners can still sign in after schema/invite-flow
// changes. Matches are case-insensitive and require an approved/active record.
async function buildProfileSeedFromEmail(user, db) {
  const email = normalizeString(user?.email)?.toLowerCase();
  if (!user?.id || !email) return null;

  const [resellerLookup, nonprofitLookup, discardLookup] = await Promise.all([
    db
      .from("reseller_applications")
      .select("id, status")
      .ilike("email", email)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("nonprofit_applications")
      .select("id, status")
      .ilike("email", email)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("discard_accounts")
      .select("id, status")
      .ilike("contact_email", email)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const resellerId = resellerLookup?.data?.id || null;
  const nonprofitId = nonprofitLookup?.data?.id || null;
  const discardId = discardLookup?.data?.id || null;

  // Prefer combined reseller+nonprofit role when both exist.
  if (resellerId && nonprofitId) {
    return {
      id: user.id,
      role: "both",
      application_id: resellerId,
      discard_account_id: null,
    };
  }
  if (resellerId) {
    return {
      id: user.id,
      role: "reseller",
      application_id: resellerId,
      discard_account_id: null,
    };
  }
  if (nonprofitId) {
    return {
      id: user.id,
      role: "nonprofit",
      application_id: nonprofitId,
      discard_account_id: null,
    };
  }
  if (discardId) {
    return {
      id: user.id,
      role: "discard",
      application_id: null,
      discard_account_id: discardId,
    };
  }
  return null;
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
    // If the existing row already has the linkage we need for its role,
    // accept it as-is.
    const hasRequiredLink =
      (existing.role === "discard" && existing.discard_account_id) ||
      (["nonprofit", "reseller", "both"].includes(existing.role) && existing.application_id) ||
      existing.role === "employee";

    let repairSeed = seed;
    if (!hasRequiredLink && !repairSeed) {
      repairSeed = await buildProfileSeedFromEmail(user, db);
    }

    if (!repairSeed) return existing;

    const repaired = {
      id: user.id,
      role: existing.role || repairSeed.role,
      application_id: existing.application_id ?? repairSeed.application_id ?? null,
      discard_account_id: existing.discard_account_id ?? repairSeed.discard_account_id ?? null,
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

  const finalSeed = seed || (await buildProfileSeedFromEmail(user, db));
  if (!finalSeed) return null;

  await upsertProfileRecord(finalSeed, db);
  return {
    role: finalSeed.role,
    application_id: finalSeed.application_id,
    discard_account_id: finalSeed.discard_account_id,
  };
}
