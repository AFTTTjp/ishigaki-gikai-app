import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ACTIONS_DIR = path.resolve(
  process.cwd(),
  "docs/ishigaki_council_actions"
);

const COUNCIL_ACTION_KINDS = new Set([
  "advocacy",
  "request",
  "inspection",
  "submission",
  "resolution_delivery",
]);

const COUNCIL_ACTION_STATUSES = new Set(["published", "draft"]);

const FILE_SUFFIX = ".council-action.json";

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
  pnpm db:council-actions:import
  pnpm db:council-actions:import --dry-run
  pnpm db:council-actions:import docs/ishigaki_council_actions/sample.council-action.json

Options:
  --dry-run    Validate and resolve bills without writing to Supabase
  --help       Show this message
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    dryRun: false,
    files: [],
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) continue;

    if (arg === "--dry-run") {
      options.dryRun = true;
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

  const entries = await fs.readdir(DEFAULT_ACTIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(FILE_SUFFIX))
    .map((entry) => path.join(DEFAULT_ACTIONS_DIR, entry.name))
    .sort();
}

// -------------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------------

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

function assertDateString(value, fieldName) {
  assertString(value, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} は YYYY-MM-DD 形式の日付である必要があります。`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${fieldName} は有効な日付である必要があります。`);
  }
}

function validateDocument(doc) {
  assertString(doc.slug, "slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc.slug)) {
    throw new Error("slug はケバブケース（小文字英数字とハイフン）である必要があります。");
  }

  assertString(doc.kind, "kind");
  if (!COUNCIL_ACTION_KINDS.has(doc.kind)) {
    throw new Error(
      `kind は ${[...COUNCIL_ACTION_KINDS].join(", ")} のいずれかである必要があります。`
    );
  }

  assertString(doc.title, "title");
  assertDateString(doc.action_date, "action_date");
  assertString(doc.destination_name, "destination_name");
  assertNullableString(doc.destination_role, "destination_role");
  assertNullableString(doc.destination_body, "destination_body");
  assertString(doc.description, "description");
  assertNullableString(doc.official_url, "official_url");
  assertNullableString(doc.source_url, "source_url");
  assertNullableString(doc.image_url, "image_url");

  assertString(doc.status, "status");
  if (!COUNCIL_ACTION_STATUSES.has(doc.status)) {
    throw new Error("status は published または draft である必要があります。");
  }

  if (!Array.isArray(doc.related_bill_names)) {
    throw new Error("related_bill_names は配列である必要があります。");
  }

  for (const [i, name] of doc.related_bill_names.entries()) {
    assertString(name, `related_bill_names[${i}]`);
  }
}

// -------------------------------------------------------------------------
// Bill resolution（完全一致のみ。fuzzy matching 禁止）
// -------------------------------------------------------------------------

async function resolveBillNames(supabase, billNames) {
  const resolved = [];
  const unmatched = [];

  for (const billName of billNames) {
    const { data, error } = await supabase
      .from("bills")
      .select("id, name")
      .eq("name", billName)
      .maybeSingle();

    if (error) {
      throw new Error(
        `bills 照合に失敗しました (${billName}): ${error.message}`
      );
    }

    if (!data) {
      unmatched.push(billName);
      continue;
    }

    resolved.push({ billName, billId: data.id });
  }

  return { resolved, unmatched };
}

// -------------------------------------------------------------------------
// Upsert council_action
// -------------------------------------------------------------------------

async function upsertCouncilAction(supabase, doc, dryRun) {
  const payload = {
    slug: doc.slug,
    kind: doc.kind,
    title: doc.title,
    action_date: doc.action_date,
    destination_name: doc.destination_name,
    destination_role: doc.destination_role ?? null,
    destination_body: doc.destination_body ?? null,
    description: doc.description,
    official_url: doc.official_url ?? null,
    source_url: doc.source_url ?? null,
    image_url: doc.image_url ?? null,
    status: doc.status,
  };

  if (dryRun) {
    const { data, error } = await supabase
      .from("council_actions")
      .select("id, slug")
      .eq("slug", doc.slug)
      .maybeSingle();

    if (error) {
      throw new Error(`council_actions 参照に失敗しました: ${error.message}`);
    }

    return data ?? { id: `(dry-run:${doc.slug})`, slug: doc.slug };
  }

  const { data, error } = await supabase
    .from("council_actions")
    .upsert(payload, { onConflict: "slug" })
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(`council_actions upsert に失敗しました: ${error.message}`);
  }

  return data;
}

// -------------------------------------------------------------------------
// Replace council_action_bills（全削除 → 再挿入）
// -------------------------------------------------------------------------

async function replaceCouncilActionBills(
  supabase,
  councilActionId,
  resolvedBills,
  dryRun
) {
  const payload = resolvedBills.map(({ billId }) => ({
    council_action_id: councilActionId,
    bill_id: billId,
  }));

  if (dryRun) {
    return payload.length;
  }

  const { error: deleteError } = await supabase
    .from("council_action_bills")
    .delete()
    .eq("council_action_id", councilActionId);

  if (deleteError) {
    throw new Error(
      `council_action_bills 削除に失敗しました: ${deleteError.message}`
    );
  }

  if (payload.length === 0) {
    return 0;
  }

  const { error: insertError } = await supabase
    .from("council_action_bills")
    .insert(payload);

  if (insertError) {
    throw new Error(
      `council_action_bills 追加に失敗しました: ${insertError.message}`
    );
  }

  return payload.length;
}

// -------------------------------------------------------------------------
// Main import flow（1ファイル）
// -------------------------------------------------------------------------

async function importFile(supabase, filePath, dryRun) {
  const raw = await fs.readFile(filePath, "utf8");
  const doc = JSON.parse(raw);
  validateDocument(doc);

  const { resolved, unmatched } = await resolveBillNames(
    supabase,
    doc.related_bill_names
  );

  const record = await upsertCouncilAction(supabase, doc, dryRun);

  const billsCount = await replaceCouncilActionBills(
    supabase,
    record.id,
    resolved,
    dryRun
  );

  return {
    filePath,
    slug: doc.slug,
    dryRun,
    billsCount,
    unmatched,
  };
}

// -------------------------------------------------------------------------
// Entry point
// -------------------------------------------------------------------------

async function main() {
  const { dryRun, files } = parseArgs(process.argv.slice(2));
  const inputFiles = await resolveInputFiles(files);

  if (inputFiles.length === 0) {
    throw new Error(
      `import 対象の ${FILE_SUFFIX} ファイルが見つかりません。`
    );
  }

  const supabase = createAdminClient();
  const results = [];

  for (const filePath of inputFiles) {
    console.log(`\n[council-actions-import] Processing ${filePath}`);
    const result = await importFile(supabase, filePath, dryRun);
    results.push(result);

    console.log(
      `[council-actions-import] ${result.slug}: council_action_bills=${result.billsCount}${dryRun ? " (dry-run)" : ""}`
    );

    for (const billName of result.unmatched) {
      console.warn(
        `[council-actions-import] ⚠ unmatched bill: "${billName}"`
      );
      console.warn(
        `  → bills.name と完全一致する議案が見つかりませんでした。fuzzy matching は使用しません。`
      );
      console.warn(
        `  → JSON の related_bill_names を bills テーブルの name カラムに合わせて修正してください。`
      );
    }
  }

  console.log(
    `\n[council-actions-import] Completed ${results.length} file(s)${dryRun ? " in dry-run mode" : ""}.`
  );
}

main().catch((error) => {
  console.error(`[council-actions-import] ${error.message}`);
  process.exit(1);
});
