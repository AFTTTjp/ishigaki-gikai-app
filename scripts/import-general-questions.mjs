#!/usr/bin/env node
/**
 * 一般質問JSONをSupabaseにインポートするスクリプト
 *
 * 使い方:
 *   node scripts/import-general-questions.mjs --dry-run  # 挿入内容を確認のみ
 *   node scripts/import-general-questions.mjs --input /tmp/general-questions.json
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
const PROD_CONFIRMED = process.argv.includes("--prod");
const INPUT_ARG_INDEX = process.argv.indexOf("--input");
const INPUT_JSON_PATH =
  INPUT_ARG_INDEX >= 0
    ? process.argv[INPUT_ARG_INDEX + 1]
    : "docs/general_questions/r8-dai4-teireikai.general-questions.json";

if (INPUT_ARG_INDEX >= 0 && !INPUT_JSON_PATH) {
  console.error("ERROR: --input にはJSONファイルパスが必要です");
  process.exit(1);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(value, fieldPath) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldPath} must be an array`);
  }

  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string") {
      throw new Error(`${fieldPath}[${index}] must be a string`);
    }
    if (entry.trim().length === 0) {
      throw new Error(`${fieldPath}[${index}] must not be empty or whitespace-only`);
    }
  }

  return value;
}

function validateAndNormalizeGeneralQuestionsDocument(raw, jsonPath) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${jsonPath} must be a JSON object`);
  }

  if (!isNonEmptyString(raw.diet_session_slug)) {
    throw new Error(`${jsonPath}.diet_session_slug must be a non-empty string`);
  }

  if (!Array.isArray(raw.questions)) {
    throw new Error(`${jsonPath}.questions must be an array`);
  }

  const questions = raw.questions.map((question, questionIndex) => {
    const questionPath = `${jsonPath}.questions[${questionIndex}]`;

    if (!question || typeof question !== "object" || Array.isArray(question)) {
      throw new Error(`${questionPath} must be an object`);
    }

    if (!isNonEmptyString(question.slug)) {
      throw new Error(`${questionPath}.slug must be a non-empty string`);
    }

    if (!Array.isArray(question.items)) {
      throw new Error(`${questionPath}.items must be an array`);
    }

    if (
      question.topic_slugs !== undefined &&
      (!Array.isArray(question.topic_slugs) ||
        question.topic_slugs.some((slug) => !isNonEmptyString(slug)))
    ) {
      throw new Error(
        `${questionPath}.topic_slugs must be an array of non-empty strings when present`
      );
    }

    const items = question.items.map((item, itemIndex) => {
      const itemPath = `${questionPath}.items[${itemIndex}]`;

      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`${itemPath} must be an object`);
      }

      if (!Number.isInteger(item.item_number) || item.item_number < 1) {
        throw new Error(`${itemPath}.item_number must be a positive integer`);
      }

      if (!isNonEmptyString(item.title)) {
        throw new Error(`${itemPath}.title must be a non-empty string`);
      }

      const subItems = validateStringArray(item.sub_items, `${itemPath}.sub_items`);

      const confirmedFactsRaw = item.confirmed_facts;
      const confirmedFacts =
        confirmedFactsRaw === undefined
          ? []
          : validateStringArray(confirmedFactsRaw, `${itemPath}.confirmed_facts`);

      return {
        ...item,
        sub_items: subItems,
        confirmed_facts: confirmedFacts,
      };
    });

    return {
      ...question,
      items,
      topic_slugs: question.topic_slugs ?? [],
    };
  });

  return {
    diet_session_slug: raw.diet_session_slug,
    questions,
  };
}

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

if (isProd && !DRY_RUN && !PROD_CONFIRMED) {
  console.error("\n⚠️  警告: リモート（本番環境の可能性）への実挿入には --prod フラグが必要です。");
  console.error("   例: node scripts/import-general-questions.mjs --prod");
  process.exit(1);
}

console.log("");

// -------------------------------------------------------------------------
// JSONファイル読み込み
// -------------------------------------------------------------------------
const JSON_PATH = resolve(
  ROOT,
  INPUT_JSON_PATH
);
let data;

try {
  data = validateAndNormalizeGeneralQuestionsDocument(
    JSON.parse(readFileSync(JSON_PATH, "utf-8")),
    JSON_PATH
  );
} catch (error) {
  console.error(
    `ERROR: 一般質問JSONの読み込みまたは検証に失敗しました: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

const { diet_session_slug, questions } = data;

console.log(`JSONファイル: ${JSON_PATH}`);
console.log(`会期スラグ  : ${diet_session_slug}`);
console.log(`質問件数    : ${questions.length} 名`);
console.log("");

if (DRY_RUN) {
  console.log("--- DRY RUN: インポート対象一覧 ---");
  for (const q of questions) {
    const topicInfo = q.topic_slugs?.length > 0 ? ` [topics: ${q.topic_slugs.join(", ")}]` : "";
    console.log(
      `  [${q.question_number}] ${q.member_name_raw} (${q.question_date}, ${q.seat_type}) - ${q.items.length}項目${topicInfo}`
    );
    for (const item of q.items) {
      console.log(`       ${item.item_number}. ${item.title}`);
      for (const sub of item.sub_items) {
        console.log(`          - ${sub}`);
      }
      for (const fact of item.confirmed_facts) {
        console.log(`          * 市の答弁で確認できたこと: ${fact}`);
      }
    }
  }
  console.log("");
  // topic_slugs の解決確認（DB接続して slug → id を検証）
  const allSlugs = [...new Set(questions.flatMap((q) => q.topic_slugs ?? []))];
  if (allSlugs.length > 0) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: topics, error } = await supabase
      .from("topics")
      .select("id, slug")
      .in("slug", allSlugs);
    if (error) {
      console.error("ERROR: topic_slugs 解決失敗:", error.message);
    } else {
      const resolved = (topics ?? []).map((t) => t.slug);
      const missing = allSlugs.filter((s) => !resolved.includes(s));
      console.log("--- topic_slugs 解決確認 ---");
      resolved.forEach((s) => console.log(`  ✓ ${s}`));
      if (missing.length > 0) {
        missing.forEach((s) => console.error(`  ✗ 未解決: ${s}`));
      } else {
        console.log("  全 topic_slugs の解決を確認しました");
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
    confirmed_facts: item.confirmed_facts,
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

  // topic_general_questions 挿入（topic_slugs が指定されている場合のみ）
  const topicSlugs = q.topic_slugs ?? [];
  if (topicSlugs.length > 0) {
    // slug → topic_id を解決
    const { data: topics, error: topicsError } = await supabase
      .from("topics")
      .select("id, slug")
      .in("slug", topicSlugs);

    if (topicsError) {
      console.error(`  ERROR ${label} topics lookup: ${topicsError.message}`);
      errorCount++;
      continue;
    }

    const resolvedSlugs = (topics ?? []).map((t) => t.slug);
    const missingSlugs = topicSlugs.filter((s) => !resolvedSlugs.includes(s));
    if (missingSlugs.length > 0) {
      console.error(`  ERROR ${label}: topic_slugs 未解決: ${missingSlugs.join(", ")}`);
      errorCount++;
      continue;
    }

    // 既存レコードを削除して再挿入（冪等）
    const { error: deleteError } = await supabase
      .from("topic_general_questions")
      .delete()
      .eq("general_question_id", generalQuestionId);

    if (deleteError) {
      console.error(`  ERROR ${label} topic_general_questions delete: ${deleteError.message}`);
      errorCount++;
      continue;
    }

    const payload = topics.map((t) => ({
      topic_id: t.id,
      general_question_id: generalQuestionId,
    }));

    const { error: tgqError } = await supabase
      .from("topic_general_questions")
      .insert(payload);

    if (tgqError) {
      console.error(`  ERROR ${label} topic_general_questions: ${tgqError.message}`);
      errorCount++;
      continue;
    }
  }

  console.log(`  OK ${label} (${q.items.length}項目${topicSlugs.length > 0 ? `, topics: ${topicSlugs.join(", ")}` : ""})`);
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
