export const PRODUCTION_SUPABASE_HOST =
  "sjjesaheibvpteoytbpy.supabase.co";

export function validateBackfillExecutionPlan({
  supabaseUrl,
  voteCount,
  plan,
  expectedTotal,
}) {
  const errors = [];

  let host = null;
  try {
    host = new URL(supabaseUrl).hostname;
  } catch {
    errors.push("SUPABASE_URL is invalid");
  }

  if (host && host !== PRODUCTION_SUPABASE_HOST) {
    errors.push(
      `Production host mismatch: expected ${PRODUCTION_SUPABASE_HOST}, got ${host}`
    );
  }

  if (!Number.isInteger(expectedTotal) || expectedTotal <= 0) {
    errors.push("expectedTotal must be a positive integer");
  }

  if (voteCount !== expectedTotal) {
    errors.push(
      `vote count changed: expected ${expectedTotal}, got ${voteCount}`
    );
  }

  if (plan.unresolved.length !== 0) {
    errors.push(`unresolved must be 0, got ${plan.unresolved.length}`);
  }

  const resolvedTotal = plan.updates.length + plan.alreadySet.length;
  if (resolvedTotal !== expectedTotal) {
    errors.push(
      `resolved total changed: expected ${expectedTotal}, got ${resolvedTotal}`
    );
  }

  return errors;
}

export async function executeMemberTermVoteBackfill(client, updates) {
  let updated = 0;

  for (const row of updates) {
    const { data, error } = await client
      .from("bill_member_votes")
      .update({ member_term_id: row.member_term_id })
      .eq("bill_id", row.bill_id)
      .eq("member_id", row.member_id)
      .is("member_term_id", null)
      .select("bill_id, member_id, member_term_id");

    if (error) {
      throw new Error(
        `update failed bill_id=${row.bill_id} member_id=${row.member_id}: ${error.message}`
      );
    }

    if (!data || data.length !== 1) {
      throw new Error(
        `update target changed bill_id=${row.bill_id} member_id=${row.member_id}: expected 1 NULL row, got ${data?.length ?? 0}`
      );
    }

    if (data[0].member_term_id !== row.member_term_id) {
      throw new Error(
        `post-update mismatch bill_id=${row.bill_id} member_id=${row.member_id}`
      );
    }

    updated += 1;
  }

  return updated;
}
