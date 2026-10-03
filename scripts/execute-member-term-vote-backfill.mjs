#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { loadMemberTermVoteBackfillPlan } from "./member-term-vote-backfill-db.mjs";
import {
  executeMemberTermVoteBackfill,
  validateBackfillExecutionPlan,
} from "./member-term-vote-backfill-execution.mjs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const PROD_CONFIRMED = args.includes("--prod");
const REVIEW_CONFIRMED = args.includes("--confirm-reviewed-plan");
const expectedIndex = args.indexOf("--expected-total");
const EXPECTED_TOTAL =
  expectedIndex >= 0 ? Number(args[expectedIndex + 1]) : Number.NaN;

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`${name} is not set`);
  }
  return value;
}

if (!EXECUTE) fail("--execute is required");
if (!PROD_CONFIRMED) fail("--prod is required");
if (!REVIEW_CONFIRMED) fail("--confirm-reviewed-plan is required");
if (!Number.isInteger(EXPECTED_TOTAL) || EXPECTED_TOTAL <= 0) {
  fail("--expected-total <positive integer> is required");
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log("=".repeat(60));
console.log("bill_member_votes.member_term_id backfill EXECUTE");
console.log("=".repeat(60));
console.log(`接続先        : ${new URL(supabaseUrl).origin}`);
console.log(`reviewed total: ${EXPECTED_TOTAL}`);
console.log("");

const before = await loadMemberTermVoteBackfillPlan(client);
console.log(
  `事前計画      : votes ${before.votes.length} / updates ${before.plan.updates.length} / alreadySet ${before.plan.alreadySet.length} / unresolved ${before.plan.unresolved.length}`
);

const gateErrors = validateBackfillExecutionPlan({
  supabaseUrl,
  voteCount: before.votes.length,
  plan: before.plan,
  expectedTotal: EXPECTED_TOTAL,
});

if (gateErrors.length > 0) {
  for (const error of gateErrors) {
    console.error(`BLOCKED: ${error}`);
  }
  fail("execution gate failed; no new writes started");
}

const updated = await executeMemberTermVoteBackfill(
  client,
  before.plan.updates
);

const after = await loadMemberTermVoteBackfillPlan(client);
console.log(
  `事後計画      : votes ${after.votes.length} / updates ${after.plan.updates.length} / alreadySet ${after.plan.alreadySet.length} / unresolved ${after.plan.unresolved.length}`
);

const afterErrors = validateBackfillExecutionPlan({
  supabaseUrl,
  voteCount: after.votes.length,
  plan: after.plan,
  expectedTotal: EXPECTED_TOTAL,
});

if (afterErrors.length > 0) {
  fail(`post-write verification failed: ${afterErrors.join("; ")}`);
}

if (after.plan.updates.length !== 0) {
  fail(
    `post-write verification failed: updates remain ${after.plan.updates.length}`
  );
}

if (after.plan.alreadySet.length !== EXPECTED_TOTAL) {
  fail(
    `post-write verification failed: alreadySet expected ${EXPECTED_TOTAL}, got ${after.plan.alreadySet.length}`
  );
}

console.log("");
console.log(
  `完了: 今回 ${updated} 件更新 / alreadySet ${after.plan.alreadySet.length} / unresolved 0`
);
