#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  countByResultDate,
  executeBillResultDateImport,
  validateBillResultDateExecutionPlan,
  verifyUpdatedCount,
} from "./bill-result-date-import-execution.mjs";
import { planBillResultDateImport } from "./plan-bill-result-date-import.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

const EXECUTE = args.includes("--execute");
const PROD_CONFIRMED = args.includes("--prod");
const REVIEW_CONFIRMED = args.includes("--confirm-reviewed-plan");

const expectedTotalIndex = args.indexOf("--expected-total");
const EXPECTED_TOTAL =
  expectedTotalIndex >= 0
    ? Number(args[expectedTotalIndex + 1])
    : Number.NaN;

const expectedSessionIndex = args.indexOf("--expected-session");
const EXPECTED_SESSION =
  expectedSessionIndex >= 0 ? args[expectedSessionIndex + 1] : null;

const expectedDateIndex = args.indexOf("--expected-result-date");
const EXPECTED_RESULT_DATE =
  expectedDateIndex >= 0 ? args[expectedDateIndex + 1] : null;

const inputIndex = args.indexOf("--input");
const INPUT_PATH =
  inputIndex >= 0
    ? args[inputIndex + 1]
    : "docs/vote_results/r8-dai4-teireikai.vote-results.review.json";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is not set`);
  return value;
}

async function selectAll(client, table, columns) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to read ${table}: ${error.message}`);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}

async function loadPlan(client, artifact) {
  const [dietSessions, bills] = await Promise.all([
    selectAll(
      client,
      "diet_sessions",
      "id, slug, start_date, end_date"
    ),
    selectAll(
      client,
      "bills",
      "id, name, diet_session_id, document_type, result_date"
    ),
  ]);

  return {
    dietSessions,
    bills,
    plan: planBillResultDateImport({
      artifact,
      dietSessions,
      bills,
    }),
  };
}

if (!EXECUTE) fail("--execute is required");
if (!PROD_CONFIRMED) fail("--prod is required");
if (!REVIEW_CONFIRMED) fail("--confirm-reviewed-plan is required");
if (!Number.isInteger(EXPECTED_TOTAL) || EXPECTED_TOTAL <= 0) {
  fail("--expected-total <positive integer> is required");
}
if (!EXPECTED_SESSION) {
  fail("--expected-session <slug> is required");
}
if (!EXPECTED_RESULT_DATE) {
  fail("--expected-result-date <YYYY-MM-DD> is required");
}
if (inputIndex >= 0 && !INPUT_PATH) {
  fail("--input requires a JSON path");
}

const inputPath = resolve(ROOT, INPUT_PATH);
let artifact;
try {
  artifact = JSON.parse(readFileSync(inputPath, "utf-8"));
} catch (error) {
  fail(
    `failed to read artifact: ${error instanceof Error ? error.message : String(error)}`
  );
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
console.log("bills.result_date import EXECUTE");
console.log("=".repeat(60));
console.log(`入力          : ${inputPath}`);
console.log(`接続先        : ${new URL(supabaseUrl).origin}`);
console.log(`reviewed total: ${EXPECTED_TOTAL}`);
console.log(`reviewed session: ${EXPECTED_SESSION}`);
console.log(`reviewed date : ${EXPECTED_RESULT_DATE}`);
console.log("");

const before = await loadPlan(client, artifact);
console.log(
  `事前計画      : updates ${before.plan.updates.length} / alreadySet ${before.plan.alreadySet.length} / unresolved ${before.plan.unresolved.length}`
);

const gateErrors = validateBillResultDateExecutionPlan({
  supabaseUrl,
  artifact,
  plan: before.plan,
  expectedTotal: EXPECTED_TOTAL,
  expectedSession: EXPECTED_SESSION,
  expectedResultDate: EXPECTED_RESULT_DATE,
});

if (gateErrors.length > 0) {
  for (const error of gateErrors) {
    console.error(`BLOCKED: ${error}`);
  }
  fail("execution gate failed; no new writes started");
}

// 今回解決対象になっている（updates + alreadySet）result_date 別の件数を、書き込み前に表示する
const resolvedDateCounts = countByResultDate([
  ...before.plan.updates,
  ...before.plan.alreadySet,
]);
console.log("result_date 別件数（updates + alreadySet）:");
for (const [date, count] of Object.entries(resolvedDateCounts)) {
  console.log(`  ${date}: ${count}`);
}
console.log("");

const updated = await executeBillResultDateImport(
  client,
  before.plan.updates
);

// 更新件数が計画と一致しなければ成功扱いにしない（各UPDATEが1行である確認と事後planの検証は別に維持）
const countError = verifyUpdatedCount(updated, before.plan.updates.length);
if (countError) {
  fail(
    `${countError}. 再実行前に read-only plan で現在の状態を確認してください`
  );
}

const after = await loadPlan(client, artifact);
console.log(
  `事後計画      : updates ${after.plan.updates.length} / alreadySet ${after.plan.alreadySet.length} / unresolved ${after.plan.unresolved.length}`
);

const afterErrors = validateBillResultDateExecutionPlan({
  supabaseUrl,
  artifact,
  plan: after.plan,
  expectedTotal: EXPECTED_TOTAL,
  expectedSession: EXPECTED_SESSION,
  expectedResultDate: EXPECTED_RESULT_DATE,
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

const finalDateCounts = countByResultDate([
  ...after.plan.updates,
  ...after.plan.alreadySet,
]);

console.log("");
console.log("=".repeat(60));
console.log(`actual updated   : ${updated}`);
console.log(`final alreadySet : ${after.plan.alreadySet.length}`);
console.log(`final unresolved : ${after.plan.unresolved.length}`);
console.log(`result_date      : ${JSON.stringify(finalDateCounts)}`);
console.log("判定: SUCCESS");
console.log("=".repeat(60));
