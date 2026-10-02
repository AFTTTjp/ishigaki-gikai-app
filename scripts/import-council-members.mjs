#!/usr/bin/env node
/**
 * 議員・議会任期データ(council-members/v2)の検証・dry-run・import
 *
 * 既定は dry-run（検証 + DB照合のread-only。書き込みなし）。
 *
 * 使い方:
 *   node scripts/import-council-members.mjs                 # 検証 + dry-run
 *   node scripts/import-council-members.mjs --execute       # ローカルDBへ書き込み
 *   node scripts/import-council-members.mjs --input <path>
 *
 * Production（リモート）への書き込みは次を全て満たす場合のみ:
 *   --execute --prod --confirm-ui-compat-deployed
 *   かつ JSON の production_import_gate.status が "open"
 * （現行UIは members を全件表示するため、UI互換PRのdeploy前に投入すると
 *   退任者を含む27人が現任として表示される。Phase 2A では gate = blocked）
 *
 * 前提: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定なら DB 照合なし(offline)。
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  buildImportPlan,
  executeImportPlan,
  formatPlanSummary,
} from "./import-council-members-plan.mjs";
import {
  splitAffiliationEntries,
  validateCouncilMembersDocument,
} from "./import-council-members-validation.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const PROD_CONFIRMED = args.includes("--prod");
const UI_COMPAT_CONFIRMED = args.includes("--confirm-ui-compat-deployed");
const inputIndex = args.indexOf("--input");
const INPUT_PATH =
  inputIndex >= 0
    ? args[inputIndex + 1]
    : "docs/ishigaki_council_members/ishigaki-council-members.2022-2030.json";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

if (inputIndex >= 0 && !INPUT_PATH) fail("--input にはJSONファイルパスが必要です");

const jsonPath = resolve(ROOT, INPUT_PATH);
let doc;
try {
  doc = validateCouncilMembersDocument(
    JSON.parse(readFileSync(jsonPath, "utf-8")),
    jsonPath
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const { ready, hold } = splitAffiliationEntries(doc);
console.log("=".repeat(60));
console.log("議員・議会任期データ import");
console.log("=".repeat(60));
console.log(`入力          : ${jsonPath}`);
console.log(`検証          : OK（人物 ${doc.persons.length} / 議会任期 ${doc.council_terms.length} / member_terms ${doc.member_terms.length}）`);
console.log(`所属履歴候補  : ${doc.affiliation_entries.length}（ready ${ready.length} / hold ${hold.length}）`);
console.log(`観測snapshot  : ${doc.affiliation_snapshots.length}`);
console.log(`source矛盾    : ${doc.source_discrepancies.length} 件`);
console.log(`Production gate: ${doc.production_import_gate.status}`);
console.log("");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasDb = Boolean(url && key);
function isLocalHost(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}
const isLocal = hasDb && isLocalHost(url);

if (EXECUTE) {
  if (!hasDb) fail("--execute には SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です");
  if (!isLocal) {
    if (!PROD_CONFIRMED) {
      fail("リモートDBへの書き込みには --prod が必要です");
    }
    if (doc.production_import_gate.status !== "open") {
      fail(
        `Production書き込みは禁止されています（production_import_gate=${doc.production_import_gate.status}）: ${doc.production_import_gate.reason}`
      );
    }
    if (!UI_COMPAT_CONFIRMED) {
      fail("--confirm-ui-compat-deployed（UI互換PRをProductionへdeploy済みの確認）が必要です");
    }
  }
}

let client = null;
let dbState = null;
if (hasDb) {
  client = createClient(url, key, { auth: { persistSession: false } });
  console.log(`接続先        : ${isLocal ? "ローカル Supabase" : "リモート（read-only照合）"}`);
  const read = async (table, columns) => {
    const { data, error } = await client.from(table).select(columns);
    if (error) fail(`${table} の取得に失敗しました: ${error.message}`);
    // ページングは未対応。1000件以上は取りこぼすため中止する
    if ((data ?? []).length >= 1000) {
      fail(`${table} が1000件以上あり、照合できません（ページング未対応）`);
    }
    return data ?? [];
  };
  dbState = {
    members: await read("members", "id, name, name_kana, address"),
    councilTerms: await read("council_terms", "id, start_date, end_date"),
    memberTerms: await read(
      "member_terms",
      "id, council_term_id, member_id, seat_number, election_count, start_date, end_date"
    ),
    memberAffiliations: await read(
      "member_affiliations",
      "member_term_id, party, party_group, valid_from, valid_to, source_url"
    ),
    memberAffiliationSnapshots: await read(
      "member_affiliation_snapshots",
      "id, member_term_id, party, party_group, party_observed_on, party_group_observed_on, party_source_url, party_group_source_url, observed_on"
    ),
  };
} else {
  console.log("接続先        : なし（offline: DB照合は行いません）");
}
console.log("");

const plan = buildImportPlan(doc, dbState);
console.log(formatPlanSummary(plan));
console.log("");

if (plan.errors.length > 0) fail("計画にエラーがあります。何も書き込みません。");

if (!EXECUTE) {
  console.log("DRY RUN 完了（書き込みなし）。実行には --execute が必要です。");
  process.exit(0);
}

const result = await executeImportPlan(plan, client);
console.log(
  `完了: members ${result.members} / council_terms ${result.councilTerms} / member_terms ${result.memberTerms} / member_affiliations ${result.affiliations} / member_affiliation_snapshots ${result.snapshots} 件を追加しました`
);
