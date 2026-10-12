#!/usr/bin/env node
// 本番 DB migration（.github/workflows/deploy.yml）の安全確認。Issue #202。
//
// 本番 migration は人間が workflow_dispatch で明示的に起動したときだけ実行する。
// この script は次を確かめ、1 つでも外れたら non-zero で止まる（fail closed）。
//
//   preflight      secret を使う前: 起動方法・ref・SHA・入力の形式・対象 migration が
//                  この commit に存在すること
//   check-project  secret の project ref が、起動者が指定した ref と一致すること
//                  （値は表示しない）
//   check-pending  `supabase migration list --linked` の出力を厳密に読み、
//                  未適用の migration が起動者の指定と完全に一致すること
//   check-applied  適用後に同じ出力を読み、未適用が 0 件になったこと
//
// CLI の出力は既知の形（Supabase CLI v2.106.0 の表）だけを受け付ける。
// 解釈できない行が 1 行でもあれば止まる。曖昧な出力から適用を判断しない。
//
// 依存なし（Node の標準ライブラリだけ）。GitHub Actions の runner でそのまま動く。

import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class GuardError extends Error {}

const VERSION_RE = /^\d{14}$/;
const SHA_RE = /^[0-9a-f]{40}$/;
// Supabase の project ref は小文字英字 20 文字。
const PROJECT_REF_RE = /^[a-z]{20}$/;
const MIGRATION_FILE_RE = /^(\d{14})_[A-Za-z0-9_.-]+\.sql$/;

// 表の前後に出る、内容を持たない既知の行だけを許す。
const NOISE_PATTERNS = [
  /^$/,
  /^Initialising login role\.\.\.$/,
  /^Connecting to remote database\.\.\.$/,
  /^A new version of Supabase CLI is available: v[\d.]+ \(currently installed v[\d.]+\)$/,
  /^We recommend updating regularly for new features and bug fixes: https:\/\/supabase\.com\/\S*$/,
];
const HEADER_RE = /^Local\s*\|\s*Remote\s*\|\s*Time \(UTC\)$/;
const SEPARATOR_RE = /^-+\|-+\|-+$/;
const ROW_RE =
  /^(\d{14})?\s*\|\s*(\d{14})?\s*\|\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$/;

/**
 * 表の 1 行を正規化する。v2.106.0 の実際の出力（CI のログ）は両端に `|` の無い形
 * （`Local | Remote | Time (UTC)`）だが、Markdown の表の形（`|Local|Remote|Time (UTC)|`）
 * で出る版もありうる。両端の `|` が **両方** あるときだけ 1 組外し、その後は同じ
 * 厳密な正規表現で判定する（片側だけの `|` は外さないので、解釈できずに止まる）。
 */
function normalizeTableLine(rawLine) {
  const line = rawLine.trim();
  if (line.length >= 2 && line.startsWith("|") && line.endsWith("|")) {
    return line.slice(1, -1).trim();
  }
  return line;
}

/** 入力の migration 指定を読む。"none" か、14 桁の version のカンマ区切り。 */
export function parseExpectedMigrations(raw) {
  const text = (raw ?? "").trim();
  if (text === "") {
    throw new GuardError(
      "expected_pending_migrations が空です。適用する version か none を指定してください。"
    );
  }
  if (text === "none") {
    return [];
  }
  const items = text.split(",").map((s) => s.trim());
  for (const v of items) {
    if (!VERSION_RE.test(v)) {
      throw new GuardError(
        `expected_pending_migrations に 14 桁の version でない値があります: ${JSON.stringify(v)}`
      );
    }
  }
  if (new Set(items).size !== items.length) {
    throw new GuardError(
      "expected_pending_migrations に同じ version が重複しています。"
    );
  }
  return [...items].sort();
}

/** この commit にある migration file の version 一覧（昇順）。 */
export function localMigrationVersions(dir) {
  const versions = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".sql")) {
      continue;
    }
    const m = MIGRATION_FILE_RE.exec(name);
    if (!m) {
      throw new GuardError(`migration file 名を解釈できません: ${name}`);
    }
    versions.push(m[1]);
  }
  if (new Set(versions).size !== versions.length) {
    throw new GuardError("同じ version の migration file が複数あります。");
  }
  return versions.sort();
}

/** secret を使う前の確認。成功時は対象の migration 一覧を返す。 */
export function preflight(env, migrationsDir) {
  if (env.GITHUB_EVENT_NAME !== "workflow_dispatch") {
    throw new GuardError(
      `本番 migration は workflow_dispatch でだけ実行できます（起動: ${env.GITHUB_EVENT_NAME}）。`
    );
  }
  if (env.GITHUB_REF !== "refs/heads/main") {
    throw new GuardError(
      `本番 migration は main からだけ実行できます（ref: ${env.GITHUB_REF}）。`
    );
  }
  const expectedSha = (env.EXPECTED_SHA ?? "").trim();
  if (!SHA_RE.test(expectedSha)) {
    throw new GuardError(
      "expected_sha は 40 桁の commit SHA（小文字）で指定してください。"
    );
  }
  if (env.GITHUB_SHA !== expectedSha) {
    throw new GuardError(
      `実行中の commit（${env.GITHUB_SHA}）が expected_sha（${expectedSha}）と違います。` +
        "レビュー済みの commit を指定し直してください。"
    );
  }
  const projectRef = (env.EXPECTED_PROJECT_REF ?? "").trim();
  if (!PROJECT_REF_RE.test(projectRef)) {
    throw new GuardError(
      "expected_project_ref は Supabase の project ref（小文字英字 20 文字）で指定してください。"
    );
  }
  const expected = parseExpectedMigrations(env.EXPECTED_PENDING_MIGRATIONS);
  const local = new Set(localMigrationVersions(migrationsDir));
  const missing = expected.filter((v) => !local.has(v));
  if (missing.length > 0) {
    throw new GuardError(
      `指定された migration がこの commit にありません: ${missing.join(", ")}`
    );
  }
  return expected;
}

/** secret の project ref と、起動者が指定した ref が一致するか。値は返さない。 */
export function checkProject(env) {
  const actual = (env.SUPABASE_PROJECT_REF ?? "").trim();
  const expected = (env.EXPECTED_PROJECT_REF ?? "").trim();
  if (!PROJECT_REF_RE.test(actual)) {
    throw new GuardError(
      "production の project ref（secret）が未設定か、形式が想定と違います。"
    );
  }
  if (actual !== expected) {
    throw new GuardError(
      "production の project ref（secret）が expected_project_ref と一致しません。対象 project を確認してください。"
    );
  }
}

/**
 * `supabase migration list --linked` の出力を厳密に読む。
 * 返り値: [{ local, remote }]（どちらも version 文字列か null）
 */
export function parseMigrationList(output) {
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  const rows = [];
  let state = "before";
  for (const rawLine of lines) {
    const line = normalizeTableLine(rawLine);
    if (state === "before") {
      if (HEADER_RE.test(line)) {
        state = "separator";
        continue;
      }
      if (NOISE_PATTERNS.some((re) => re.test(line))) {
        continue;
      }
      throw new GuardError(
        `migration list の出力に想定外の行があります: ${JSON.stringify(line)}`
      );
    }
    if (state === "separator") {
      if (!SEPARATOR_RE.test(line)) {
        throw new GuardError("migration list の表の区切り行が想定と違います。");
      }
      state = "rows";
      continue;
    }
    if (state === "rows") {
      const m = ROW_RE.exec(line);
      if (m) {
        if (!m[1] && !m[2]) {
          throw new GuardError(
            "migration list に version の無い行があります。"
          );
        }
        rows.push({ local: m[1] ?? null, remote: m[2] ?? null });
        continue;
      }
      if (line === "") {
        state = "after";
        continue;
      }
      throw new GuardError(
        `migration list の表に解釈できない行があります: ${JSON.stringify(line)}`
      );
    }
    // after
    if (HEADER_RE.test(line) || ROW_RE.test(line)) {
      throw new GuardError("migration list の表が 2 つ以上あります。");
    }
    if (!NOISE_PATTERNS.some((re) => re.test(line))) {
      throw new GuardError(
        `migration list の出力に想定外の行があります: ${JSON.stringify(line)}`
      );
    }
  }
  if (state === "before" || state === "separator") {
    throw new GuardError("migration list の表が見つかりません。");
  }
  if (rows.length === 0) {
    throw new GuardError("migration list の表に行がありません。");
  }
  return rows;
}

/** 表と、この commit の migration file から、未適用の version を求める。 */
export function pendingMigrations(rows, localVersions) {
  const local = new Set(localVersions);
  const listedLocal = new Set();
  const pending = [];
  for (const { local: l, remote: r } of rows) {
    if (l && r && l !== r) {
      throw new GuardError(
        `migration list の Local と Remote が食い違う行があります: ${l} / ${r}`
      );
    }
    if (!l && r) {
      throw new GuardError(
        `本番にだけある migration があります（この commit に無い）: ${r}。drift なので止めます。`
      );
    }
    if (listedLocal.has(l)) {
      throw new GuardError(
        `migration list に同じ version が重複しています: ${l}`
      );
    }
    listedLocal.add(l);
    if (!r) {
      pending.push(l);
    }
  }
  const notListed = [...local].filter((v) => !listedLocal.has(v));
  const unknown = [...listedLocal].filter((v) => !local.has(v));
  if (notListed.length > 0 || unknown.length > 0) {
    throw new GuardError(
      "migration list の Local 列が、この commit の migration file と一致しません" +
        `（list に無い: ${notListed.join(", ") || "なし"} / file に無い: ${unknown.join(", ") || "なし"}）。`
    );
  }
  return pending.sort();
}

/** 未適用の一覧が起動者の指定と完全に一致するか。適用が必要かを返す。 */
export function checkPending(rows, localVersions, expected) {
  const pending = pendingMigrations(rows, localVersions);
  const same =
    pending.length === expected.length &&
    pending.every((v, i) => v === expected[i]);
  if (!same) {
    throw new GuardError(
      `未適用の migration が指定と一致しません（本番の未適用: ${pending.join(", ") || "なし"} / 指定: ${expected.join(", ") || "none"}）。何も適用せずに止めます。`
    );
  }
  return pending.length > 0;
}

/** 適用後: 未適用が 0 件で、指定した version が本番に入ったこと。 */
export function checkApplied(rows, localVersions, expected) {
  const pending = pendingMigrations(rows, localVersions);
  if (pending.length > 0) {
    throw new GuardError(
      `適用後も未適用の migration が残っています: ${pending.join(", ")}。再実行せず、人が状況を確認してください。`
    );
  }
  const remote = new Set(rows.map((r) => r.remote).filter(Boolean));
  const absent = expected.filter((v) => !remote.has(v));
  if (absent.length > 0) {
    throw new GuardError(
      `指定した migration が本番に見当たりません: ${absent.join(", ")}`
    );
  }
}

function main(argv, env) {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
  );
  const migrationsDir = path.join(repoRoot, "supabase", "migrations");
  const [command, listFile] = argv;
  if (command === "preflight") {
    const expected = preflight(env, migrationsDir);
    console.log(
      `preflight OK: main @ ${env.GITHUB_SHA} / 適用予定: ${expected.join(", ") || "none"}`
    );
    return;
  }
  if (command === "check-project") {
    checkProject(env);
    console.log("project ref OK（値は表示しない）");
    return;
  }
  if (command === "check-pending" || command === "check-applied") {
    if (!listFile) {
      throw new GuardError(
        `${command} には migration list の出力 file が必要です。`
      );
    }
    const rows = parseMigrationList(readFileSync(listFile, "utf8"));
    const local = localMigrationVersions(migrationsDir);
    const expected = parseExpectedMigrations(env.EXPECTED_PENDING_MIGRATIONS);
    if (command === "check-pending") {
      const apply = checkPending(rows, local, expected);
      console.log(
        apply
          ? `未適用 ${expected.length} 件が指定と一致: ${expected.join(", ")}`
          : "未適用の migration はありません（指定: none）。適用は行いません。"
      );
      if (env.GITHUB_OUTPUT) {
        appendFileSync(
          env.GITHUB_OUTPUT,
          `apply=${apply ? "true" : "false"}\n`
        );
      }
      return;
    }
    checkApplied(rows, local, expected);
    console.log("read-back OK: 未適用の migration は 0 件。");
    return;
  }
  throw new GuardError(
    "使い方: production-migration-guard.mjs preflight | check-project | check-pending <file> | check-applied <file>"
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    main(process.argv.slice(2), process.env);
  } catch (err) {
    if (err instanceof GuardError) {
      console.error(`::error::STOP: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}
