#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { planBillResultDateImport } from "./plan-bill-result-date-import.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
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

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function printCounts(title, entries) {
  console.log(title);
  if (entries.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const [key, count] of entries) {
    console.log(`  ${key}: ${count}`);
  }
}

if (inputIndex >= 0 && !INPUT_PATH) {
  fail("--input requires a JSON path");
}

const inputPath = resolve(ROOT, INPUT_PATH);
let artifact;
try {
  artifact = JSON.parse(readFileSync(inputPath, "utf-8"));
} catch (error) {
  fail(`failed to read artifact: ${error instanceof Error ? error.message : String(error)}`);
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log("============================================================");
console.log("bills.result_date import plan");
console.log("============================================================");
console.log(`入力          : ${inputPath}`);
console.log(`接続先        : ${new URL(supabaseUrl).origin}`);
console.log("モード        : READ ONLY（DB書き込み処理なし）");
console.log("");

try {
  const [dietSessions, bills] = await Promise.all([
    selectAll(
      supabase,
      "diet_sessions",
      "id, slug, start_date, end_date"
    ),
    selectAll(
      supabase,
      "bills",
      "id, name, diet_session_id, document_type, result_date"
    ),
  ]);

  const plan = planBillResultDateImport({
    artifact,
    dietSessions,
    bills,
  });

  console.log(
    `artifact       : session ${artifact.session?.slug ?? "(missing)"} / bills ${artifact.bills?.length ?? 0}`
  );
  console.log(
    `DB入力         : diet_sessions ${dietSessions.length} / bills ${bills.length}`
  );
  console.log(
    `計画          : updates ${plan.updates.length} / alreadySet ${plan.alreadySet.length} / unresolved ${plan.unresolved.length}`
  );
  console.log("");

  printCounts(
    "update候補 result_date別:",
    countBy(plan.updates, (item) => item.result_date)
  );
  console.log("");
  printCounts(
    "unresolved 理由別:",
    countBy(plan.unresolved, (item) => item.reason)
  );

  if (plan.unresolved.length > 0) {
    console.log("");
    console.log("unresolved 詳細:");
    for (const item of plan.unresolved) {
      console.log(
        `  bill_number=${item.bill_number ?? "-"} bill_id=${item.bill_id ?? "-"} reason=${item.reason}`
      );
    }
  }

  console.log("");
  console.log(
    plan.unresolved.length === 0
      ? "判定: READY FOR HUMAN REVIEW（まだ書き込みはしていません）"
      : "判定: BLOCKED（unresolved を解消するまで書き込み禁止）"
  );
  console.log("READ ONLY 完了。DB変更はありません。");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
