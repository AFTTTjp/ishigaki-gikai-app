export const PRODUCTION_SUPABASE_HOST =
  "sjjesaheibvpteoytbpy.supabase.co";

const ALLOWED_MATCH_MODES = new Set([
  "exact",
  "exact_after_bracket_width_normalization",
]);

export function validateBillResultDateExecutionPlan({
  supabaseUrl,
  artifact,
  plan,
  expectedTotal,
  expectedSession,
  expectedResultDate,
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

  if (!expectedSession) {
    errors.push("expectedSession is required");
  }

  if (!expectedResultDate) {
    errors.push("expectedResultDate is required");
  }

  if (artifact?.session?.slug !== expectedSession) {
    errors.push(
      `session changed: expected ${expectedSession}, got ${artifact?.session?.slug ?? "(missing)"}`
    );
  }

  if (!Array.isArray(artifact?.bills) || artifact.bills.length !== expectedTotal) {
    errors.push(
      `artifact bill count changed: expected ${expectedTotal}, got ${artifact?.bills?.length ?? 0}`
    );
  }

  const artifactDates = new Set(
    (artifact?.bills ?? []).map((bill) => bill.result_date)
  );
  if (
    artifactDates.size !== 1 ||
    !artifactDates.has(expectedResultDate)
  ) {
    errors.push(
      `artifact result_date changed: expected all ${expectedResultDate}, got ${[...artifactDates].join(", ") || "(none)"}`
    );
  }

  if (plan.unresolved.length !== 0) {
    errors.push(`unresolved must be 0, got ${plan.unresolved.length}`);
  }

  const resolved = [...plan.updates, ...plan.alreadySet];
  if (resolved.length !== expectedTotal) {
    errors.push(
      `resolved total changed: expected ${expectedTotal}, got ${resolved.length}`
    );
  }

  const resolvedBillIds = resolved.map((item) => item.bill_id);
  if (new Set(resolvedBillIds).size !== resolvedBillIds.length) {
    errors.push("resolved bill_id values must be unique");
  }

  const unexpectedMatchModes = [
    ...new Set(
      resolved
        .map((item) => item.match_mode)
        .filter((mode) => !ALLOWED_MATCH_MODES.has(mode))
    ),
  ];
  if (unexpectedMatchModes.length > 0) {
    errors.push(
      `unexpected match_mode: ${unexpectedMatchModes.join(", ")}`
    );
  }

  const unexpectedDates = [
    ...new Set(
      resolved
        .map((item) => item.result_date)
        .filter((date) => date !== expectedResultDate)
    ),
  ];
  if (unexpectedDates.length > 0) {
    errors.push(
      `planned result_date changed: expected ${expectedResultDate}, got ${unexpectedDates.join(", ")}`
    );
  }

  return errors;
}

export async function executeBillResultDateImport(client, updates) {
  let updated = 0;

  for (const row of updates) {
    const { data, error } = await client
      .from("bills")
      .update({ result_date: row.result_date })
      .eq("id", row.bill_id)
      .eq("name", row.bill_name)
      .eq("document_type", "bill")
      .is("result_date", null)
      .select("id, name, result_date");

    if (error) {
      throw new Error(
        `update failed bill_id=${row.bill_id}: ${error.message}`
      );
    }

    if (!data || data.length !== 1) {
      throw new Error(
        `update target changed bill_id=${row.bill_id}: expected 1 NULL bill row, got ${data?.length ?? 0}`
      );
    }

    if (
      data[0].name !== row.bill_name ||
      data[0].result_date !== row.result_date
    ) {
      throw new Error(`post-update mismatch bill_id=${row.bill_id}`);
    }

    updated += 1;
  }

  return updated;
}
