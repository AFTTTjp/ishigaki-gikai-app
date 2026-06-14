#!/usr/bin/env node
/**
 * 一般質問JSONをSupabaseにインポートするスクリプト
 *
 * 使い方:
 *   node scripts/import-general-questions.mjs --dry-run  # 挿入内容を確認のみ
 *   node scripts/import-general-questions.mjs            # ローカルSupabaseに挿入
 *
 * 前提:
 *   - .env に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定済み
 *   - ローカルSupabaseが起動中 (npx supabase start)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DRY_RUN = process.argv.includes("--dry-run");

// -------------------------------------------------------------------------
// 環境変数チェック
// -------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です");
  process.exit(1);
}

// ローカル Supabase か prod かを判定して警告
const isLocal =
  SUPABASE_URL.includes("localhost") || SUPABASE_URL.includes("127.0.0.1");
const isProd = !isLocal;

console.log("=".repeat(60));
console.log("一般質問インポートスクリプト");
console.log("=".repeat(60));
console.log(`モード    : ${DRY_RUN ? "DRY RUN（挿入なし）" : "実行"}`);
console.log(`接続先   : ${isLocal ? "ローカル Supabase" : "リモート（本番 or ステージング）"}`);

if (isProd && !DRY_RUN) {
  console.error("\n⚠️  警告: リモート（本番環境の可能性）への実挿入は現時点では許可されていません。");
  console.error("   prod import は別途確認を取ってから実行してください。");
  process.exit(1);
}

console.log("");

// -------------------------------------------------------------------------
// JSONファイル読み込み
// -------------------------------------------------------------------------
const JSON_PATH = resolve(
  ROOT,
  "docs/general_questions/r8-dai4-teireikai.general-questions.json"
);
const data = JSON.parse(readFileSync(JSON_PATH, "utf-8"));
const { diet_session_slug, questions } = data;

console.log(`JSONファイル: ${JSON_PATH}`);
console.log(`会期スラグ  : ${diet_session_slug}`);
console.log(`質問件数    : ${questions.length} 名`);
console.log("");

if (DRY_RUN) {
  console.log("--- DRY RUN: インポート対象一覧 ---");
  for (const q of questions) {
    console.log(
      `  [${q.question_number}] ${q.member_name_raw} (${q.question_date}, ${q.seat_type}) - ${q.items.length}項目`
    );
    for (const item of q.items) {
      console.log(`       ${item.item_number}. ${item.title}`);
      for (const sub of item.sub_items) {
        console.log(`          - ${sub}`);
      }
    }
  }
  console.log("");
  console.log("DRY RUN 完了。--dry-run フラグを外すと実際に挿入されます。");
  process.exit(0);
}

// -------------------------------------------------------------------------
// Supabase クライアント（Service Role）
// -------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// -------------------------------------------------------------------------
// diet_session_id を解決
// -------------------------------------------------------------------------
const { data: sessions, error: sessionError } = await supabase
  .from("diet_sessions")
  .select("id, slug, name")
  .eq("slug", diet_session_slug);

if (sessionError) {
  console.error("ERROR: diet_sessions 取得失敗:", sessionError.message);
  process.exit(1);
}

if (!sessions || sessions.length === 0) {
  console.error(`ERROR: slug="${diet_session_slug}" の diet_session が見つかりません`);
  process.exit(1);
}

const dietSession = sessions[0];
console.log(`会期確認: ${dietSession.name} (id: ${dietSession.id})`);
console.log("");

// -------------------------------------------------------------------------
// インポート実行
// -------------------------------------------------------------------------
let successCount = 0;
let errorCount = 0;

for (const q of questions) {
  const label = `[${q.question_number}] ${q.member_name_raw}`;

  // general_questions 挿入
  const { data: inserted, error: insertError } = await supabase
    .from("general_questions")
    .upsert(
      {
        slug: q.slug,
        diet_session_id: dietSession.id,
        member_id: q.member_id,
        question_number: q.question_number,
        question_date: q.question_date,
        seat_type: q.seat_type,
        source_kind: q.source_kind,
        member_name_raw: q.member_name_raw,
        verified_at: new Date().toISOString(),
        status: "published",
      },
      { onConflict: "slug", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (insertError) {
    console.error(`  ERROR ${label}: ${insertError.message}`);
    errorCount++;
    continue;
  }

  const generalQuestionId = inserted.id;

  // general_question_items 挿入
  const itemRows = q.items.map((item) => ({
    general_question_id: generalQuestionId,
    item_number: item.item_number,
    title: item.title,
    sub_items: item.sub_items,
  }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase
      .from("general_question_items")
      .upsert(itemRows, { onConflict: "general_question_id,item_number", ignoreDuplicates: false });

    if (itemsError) {
      console.error(`  ERROR ${label} items: ${itemsError.message}`);
      console.error(`  → general_questions レコード (id: ${generalQuestionId}) は挿入済みのため手動確認が必要です`);
      errorCount++;
      continue;
    }
  }

  console.log(`  OK ${label} (${q.items.length}項目)`);
  successCount++;
}

// -------------------------------------------------------------------------
// 結果サマリー
// -------------------------------------------------------------------------
console.log("");
console.log("=".repeat(60));
console.log(`完了: 成功=${successCount}, エラー=${errorCount}`);
console.log("=".repeat(60));

if (errorCount > 0) {
  process.exit(1);
}
