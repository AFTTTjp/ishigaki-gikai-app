import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_TOPICS_DIR = path.resolve(
  process.cwd(),
  "docs/ishigaki_gikai_topics_dev_set"
);
const TOPIC_STATUSES = new Set(["active", "archived"]);
const TOPIC_UPDATE_KINDS = new Set([
  "news",
  "council",
  "progress",
  "decision",
  "question",
]);

function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function printUsage() {
  console.log(`Usage:
  pnpm db:topics:import
  pnpm db:topics:import --dry-run
  pnpm db:topics:import docs/ishigaki_gikai_topics_dev_set/example.topic.json

Options:
  --dry-run    Validate and resolve bills without writing to Supabase
  --prod       Confirm writing to a remote (non-local) Supabase
  --help       Show this message
`);
}

// リモート（localhost/127.0.0.1 以外）への実書き込みには --prod を必須にする安全弁。
// dry-run と local 接続は --prod なしで許可する。SUPABASE_URL 未設定時は remote 扱い
// せず、後段の createAdminClient() の env 不足エラーに委ねる。
function assertRemoteWriteConfirmed(dryRun, prodConfirmed) {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const isRemote =
    supabaseUrl.length > 0 &&
    !supabaseUrl.includes("localhost") &&
    !supabaseUrl.includes("127.0.0.1");

  if (isRemote && !dryRun && !prodConfirmed) {
    console.error(
      "⚠️  リモート（本番/ステージングの可能性）への実書き込みには --prod が必要です。"
    );
    console.error(
      "   まず --dry-run で対象を確認し、書き込み時のみ --prod を付けてください。"
    );
    process.exit(1);
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    dryRun: false,
    prodConfirmed: false,
    files: [],
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--prod") {
      options.prodConfirmed = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    options.files.push(path.resolve(process.cwd(), arg));
  }

  return options;
}

async function resolveInputFiles(files) {
  if (files.length > 0) {
    return files;
  }

  const entries = await fs.readdir(DEFAULT_TOPICS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".topic.json"))
    .map((entry) => path.join(DEFAULT_TOPICS_DIR, entry.name))
    .sort();
}

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} は空でない文字列である必要があります。`);
  }
}

function assertNullableString(value, fieldName) {
  if (value !== null && value !== undefined && typeof value !== "string") {
    throw new Error(`${fieldName} は文字列または null である必要があります。`);
  }
}

function assertIsoDateTime(value, fieldName) {
  assertString(value, fieldName);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} は有効な date-time である必要があります。`);
  }
}

function assertJstIsoDateTime(value, fieldName) {
  assertIsoDateTime(value, fieldName);
  if (!value.endsWith("+09:00")) {
    throw new Error(`${fieldName} は JST の ISO 8601（+09:00）である必要があります。`);
  }
}

function validateTopicDocument(topic) {
  assertString(topic.topic_slug, "topic_slug");
  assertString(topic.topic_title, "topic_title");
  assertString(topic.topic_title_kana, "topic_title_kana");
  assertString(topic.topic_status, "topic_status");
  if (!TOPIC_STATUSES.has(topic.topic_status)) {
    throw new Error("topic_status は active または archived である必要があります。");
  }
  assertString(topic.description, "description");

  if (typeof topic.content !== "string") {
    throw new Error("content は文字列である必要があります。");
  }

  if (!topic.current_status || typeof topic.current_status !== "object") {
    throw new Error("current_status は必須です。");
  }

  assertNullableString(topic.current_status.label, "current_status.label");
  assertNullableString(topic.current_status.note, "current_status.note");
  if (topic.current_status.updated_at !== null) {
    assertJstIsoDateTime(
      topic.current_status.updated_at,
      "current_status.updated_at"
    );
  }

  assertString(
    topic.related_bills_summary_normal,
    "related_bills_summary_normal"
  );
  assertString(
    topic.related_bills_summary_hard,
    "related_bills_summary_hard"
  );

  if (!Array.isArray(topic.topic_updates)) {
    throw new Error("topic_updates は配列である必要があります。");
  }

  for (const [index, update] of topic.topic_updates.entries()) {
    assertJstIsoDateTime(
      update.published_at,
      `topic_updates[${index}].published_at`
    );
    assertString(update.kind, `topic_updates[${index}].kind`);
    if (!TOPIC_UPDATE_KINDS.has(update.kind)) {
      throw new Error(
        `topic_updates[${index}].kind は ${[...TOPIC_UPDATE_KINDS].join(", ")} のいずれかである必要があります。`
      );
    }
    assertString(update.title, `topic_updates[${index}].title`);
    assertString(update.summary, `topic_updates[${index}].summary`);
    assertNullableString(update.content, `topic_updates[${index}].content`);
    assertNullableString(
      update.status_label,
      `topic_updates[${index}].status_label`
    );
    assertNullableString(
      update.source_label,
      `topic_updates[${index}].source_label`
    );
    assertNullableString(update.source_url, `topic_updates[${index}].source_url`);
  }

  if (!Array.isArray(topic.topic_bill_candidates)) {
    throw new Error("topic_bill_candidates は配列である必要があります。");
  }

  for (const [index, candidate] of topic.topic_bill_candidates.entries()) {
    assertString(candidate.bill_name, `topic_bill_candidates[${index}].bill_name`);
    assertString(
      candidate.related_level,
      `topic_bill_candidates[${index}].related_level`
    );
    assertString(
      candidate.adoption_status,
      `topic_bill_candidates[${index}].adoption_status`
    );
    assertString(
      candidate.reason_normal,
      `topic_bill_candidates[${index}].reason_normal`
    );
    assertString(
      candidate.reason_hard,
      `topic_bill_candidates[${index}].reason_hard`
    );
    assertString(candidate.source_url, `topic_bill_candidates[${index}].source_url`);
  }
}

function mapTopicStatusToDbStatus(topicStatus) {
  return topicStatus;
}

async function loadTopicFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const topic = JSON.parse(raw);
  validateTopicDocument(topic);
  return topic;
}

async function resolveBills(supabase, topic) {
  const adoptCandidates = topic.topic_bill_candidates
    .filter((candidate) => candidate.adoption_status === "adopt")
    .sort(
      (a, b) =>
        (a.display_order ?? Number.MAX_SAFE_INTEGER) -
        (b.display_order ?? Number.MAX_SAFE_INTEGER)
    );

  const resolved = [];
  const unmatched = [];

  for (const candidate of adoptCandidates) {
    const { data, error } = await supabase
      .from("bills")
      .select("id, name")
      .eq("name", candidate.bill_name)
      .maybeSingle();

    if (error) {
      throw new Error(
        `bills 照合に失敗しました (${candidate.bill_name}): ${error.message}`
      );
    }

    if (!data) {
      unmatched.push(candidate);
      continue;
    }

    resolved.push({
      candidate,
      billId: data.id,
    });
  }

  return { resolved, unmatched };
}

async function upsertTopic(supabase, topic, dryRun) {
  const payload = {
    slug: topic.topic_slug,
    title: topic.topic_title,
    description: topic.description,
    content: topic.content,
    content_hard: topic.content_hard ?? null,
    status: mapTopicStatusToDbStatus(topic.topic_status),
    current_status_label: topic.current_status.label,
    current_status_note: topic.current_status.note,
    current_status_updated_at: topic.current_status.updated_at,
  };

  if (dryRun) {
    const { data, error } = await supabase
      .from("topics")
      .select("id, slug")
      .eq("slug", topic.topic_slug)
      .maybeSingle();

    if (error) {
      throw new Error(`topics 参照に失敗しました: ${error.message}`);
    }

    return data ?? { id: `(dry-run:${topic.topic_slug})`, slug: topic.topic_slug };
  }

  const { data, error } = await supabase
    .from("topics")
    .upsert(payload, { onConflict: "slug" })
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(`topics upsert に失敗しました: ${error.message}`);
  }

  return data;
}

async function replaceTopicUpdates(supabase, topicId, topicUpdates, dryRun) {
  const payload = topicUpdates.map((update) => ({
    topic_id: topicId,
    kind: update.kind,
    title: update.title,
    summary: update.summary,
    content: update.content ?? "",
    status_label: update.status_label ?? null,
    source_url: update.source_url ?? null,
    source_label: update.source_label ?? null,
    published_at: update.published_at,
  }));

  if (dryRun) {
    return payload.length;
  }

  const { error: deleteError } = await supabase
    .from("topic_updates")
    .delete()
    .eq("topic_id", topicId);

  if (deleteError) {
    throw new Error(`topic_updates 削除に失敗しました: ${deleteError.message}`);
  }

  if (payload.length === 0) {
    return 0;
  }

  const { error: insertError } = await supabase
    .from("topic_updates")
    .insert(payload);

  if (insertError) {
    throw new Error(`topic_updates 追加に失敗しました: ${insertError.message}`);
  }

  return payload.length;
}

async function replaceTopicBills(supabase, topicId, resolvedBills, dryRun) {
  const payload = resolvedBills.map(({ billId }) => ({
    topic_id: topicId,
    bill_id: billId,
  }));

  if (dryRun) {
    return payload.length;
  }

  const { error: deleteError } = await supabase
    .from("topic_bills")
    .delete()
    .eq("topic_id", topicId);

  if (deleteError) {
    throw new Error(`topic_bills 削除に失敗しました: ${deleteError.message}`);
  }

  if (payload.length === 0) {
    return 0;
  }

  const { error: insertError } = await supabase
    .from("topic_bills")
    .insert(payload);

  if (insertError) {
    throw new Error(`topic_bills 追加に失敗しました: ${insertError.message}`);
  }

  return payload.length;
}

async function importTopicFile(supabase, filePath, dryRun) {
  const topic = await loadTopicFile(filePath);
  const topicRecord = await upsertTopic(supabase, topic, dryRun);
  const { resolved, unmatched } = await resolveBills(supabase, topic);
  const updatesCount = await replaceTopicUpdates(
    supabase,
    topicRecord.id,
    topic.topic_updates,
    dryRun
  );
  const billsCount = await replaceTopicBills(
    supabase,
    topicRecord.id,
    resolved,
    dryRun
  );

  return {
    filePath,
    slug: topic.topic_slug,
    dryRun,
    updatesCount,
    billsCount,
    unmatched,
  };
}

async function main() {
  const { dryRun, prodConfirmed, files } = parseArgs(process.argv.slice(2));
  const inputFiles = await resolveInputFiles(files);

  if (inputFiles.length === 0) {
    throw new Error("import 対象の .topic.json ファイルが見つかりません。");
  }

  assertRemoteWriteConfirmed(dryRun, prodConfirmed);

  const supabase = createAdminClient();
  const results = [];

  for (const filePath of inputFiles) {
    console.log(`\n[topics-import] Processing ${filePath}`);
    const result = await importTopicFile(supabase, filePath, dryRun);
    results.push(result);

    console.log(
      `[topics-import] ${result.slug}: updates=${result.updatesCount}, topic_bills=${result.billsCount}${dryRun ? " (dry-run)" : ""}`
    );

    for (const candidate of result.unmatched) {
      console.warn(
        `[topics-import] unmatched bill: ${candidate.bill_name} (${candidate.source_url})`
      );
    }
  }

  const hasUnmatched = results.some((result) => result.unmatched.length > 0);
  if (hasUnmatched) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[topics-import] failed:", error);
  process.exitCode = 1;
});
