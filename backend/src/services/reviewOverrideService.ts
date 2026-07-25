import supabase from "./supabaseClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Decision = "approved" | "declined" | "pending";
/** DB constraint only allows "company" or "certification" */
export type Classification = "company" | "certification";
/** confirm_merge: explicitly confirm cross-semester split pair as single internship; reject_merge: treat as two separate internships */
export type MergeDecision = "confirm_merge" | "reject_merge";

export interface ReviewOverride {
  id?: number;
  batch_id: string;
  division: string;
  prn: string;
  semester_label: string;
  sibling_semester_label?: string | null;
  internship_name_snapshot?: string | null;
  decision?: Decision | null;
  classification?: Classification | null;
  merge_decision?: MergeDecision | null;
  override_credits?: number | null;
  reviewed_by?: string | null;
  note?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Lookup key for fast access during enrichment: `${division}:${prn}:${semesterLabel}` */
export type ReviewOverrideKey = string;

export function makeOverrideKey(
  division: string,
  prn: string,
  semesterLabel: string
): ReviewOverrideKey {
  return `${division}:${prn}:${semesterLabel}`;
}

// ---------------------------------------------------------------------------
// getOverridesForBatch
// ---------------------------------------------------------------------------

/**
 * Fetch all override rows for a batch, optionally filtered by division.
 * Returns a Map keyed by `${division}:${prn}:${semesterLabel}` for O(1) lookup
 * during the enrichment pipeline.
 */
export async function getOverridesForBatch(
  batchId: string,
  division?: string
): Promise<Map<ReviewOverrideKey, ReviewOverride>> {
  let query = supabase
    .from("review_overrides")
    .select("*")
    .eq("batch_id", batchId);

  if (division) {
    query = query.eq("division", division);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`[reviewOverrideService] getOverridesForBatch failed: ${error.message}`);
  }

  const map = new Map<ReviewOverrideKey, ReviewOverride>();
  for (const row of (data ?? [])) {
    map.set(makeOverrideKey(row.division, row.prn, row.semester_label), row);
  }

  return map;
}

// ---------------------------------------------------------------------------
// upsertOverride
// ---------------------------------------------------------------------------

/**
 * Insert or update a single override row.
 * Sets reviewed_at to the current timestamp.
 * Upserts on the unique constraint (batch_id, division, prn, semester_label).
 */
export async function upsertOverride(
  entry: Omit<ReviewOverride, "id" | "created_at" | "updated_at">
): Promise<ReviewOverride> {
  const payload = {
    ...entry,
    reviewed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("review_overrides")
    .upsert(payload, {
      onConflict: "batch_id,division,prn,semester_label",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`[reviewOverrideService] upsertOverride failed: ${error.message}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// bulkUpsertOverrides
// ---------------------------------------------------------------------------

/**
 * Batch upsert multiple override rows in a single Supabase call.
 * Each entry gets reviewed_at = now().
 */
export async function bulkUpsertOverrides(
  entries: Omit<ReviewOverride, "id" | "created_at" | "updated_at">[]
): Promise<ReviewOverride[]> {
  if (entries.length === 0) return [];

  const now = new Date().toISOString();
  const payload = entries.map((e) => ({ ...e, reviewed_at: now }));

  const { data, error } = await supabase
    .from("review_overrides")
    .upsert(payload, {
      onConflict: "batch_id,division,prn,semester_label",
    })
    .select();

  if (error) {
    throw new Error(`[reviewOverrideService] bulkUpsertOverrides failed: ${error.message}`);
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// deleteOverride
// ---------------------------------------------------------------------------

/**
 * Reset a single entry back to no-override state by deleting the row.
 */
export async function deleteOverride(
  batchId: string,
  division: string,
  prn: string,
  semesterLabel: string
): Promise<void> {
  const { error } = await supabase
    .from("review_overrides")
    .delete()
    .eq("batch_id", batchId)
    .eq("division", division)
    .eq("prn", prn)
    .eq("semester_label", semesterLabel);

  if (error) {
    throw new Error(`[reviewOverrideService] deleteOverride failed: ${error.message}`);
  }
}
