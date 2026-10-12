import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkApplied,
  checkPending,
  checkProject,
  GuardError,
  localMigrationVersions,
  parseExpectedMigrations,
  parseMigrationList,
  pendingMigrations,
  preflight,
} from "./production-migration-guard.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const SHA = "a".repeat(40);
const REF = "abcdefghijklmnopqrst";

// Supabase CLI v2.106.0 の `migration list --linked` と同じ形（version は架空）。
const LIST_PENDING = [
  "Initialising login role...",
  "Connecting to remote database...",
  "",
  "  ",
  "   Local          | Remote         | Time (UTC)          ",
  "  ----------------|----------------|---------------------",
  "   20250101000000 | 20250101000000 | 2025-01-01 00:00:00 ",
  "   20250102000000 |                | 2025-01-02 00:00:00 ",
  "",
  "A new version of Supabase CLI is available: v2.119.0 (currently installed v2.106.0)",
  "We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli",
].join("\n");

const LIST_APPLIED = LIST_PENDING.replace(
  "   20250102000000 |                |",
  "   20250102000000 | 20250102000000 |"
);

let dir;

function migrationsDir(versions) {
  for (const v of versions) {
    writeFileSync(path.join(dir, `${v}_example_change.sql`), "-- example\n");
  }
  return dir;
}

function env(overrides = {}) {
  return {
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: SHA,
    EXPECTED_SHA: SHA,
    EXPECTED_PROJECT_REF: REF,
    EXPECTED_PENDING_MIGRATIONS: "20250102000000",
    ...overrides,
  };
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "migration-guard-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("parseExpectedMigrations", () => {
  it("none は空の一覧", () => {
    expect(parseExpectedMigrations("none")).toEqual([]);
  });

  it("カンマ区切りを昇順で返す", () => {
    expect(parseExpectedMigrations("20250102000000, 20250101000000")).toEqual([
      "20250101000000",
      "20250102000000",
    ]);
  });

  it.each([
    ["", "空"],
    ["  ", "空白だけ"],
    ["2025010200000", "13 桁"],
    ["20250102000000,abc", "形式違い"],
    ["20250102000000,20250102000000", "重複"],
    ["none,20250102000000", "none と version の混在"],
    ["20250102000000;20250103000000", "区切りがカンマでない"],
  ])("拒否する: %s（%s）", (raw) => {
    expect(() => parseExpectedMigrations(raw)).toThrow(GuardError);
  });
});

describe("localMigrationVersions", () => {
  it("migration file の version を昇順で返す", () => {
    migrationsDir(["20250102000000", "20250101000000"]);
    expect(localMigrationVersions(dir)).toEqual([
      "20250101000000",
      "20250102000000",
    ]);
  });

  it("名前を解釈できない .sql があれば止める", () => {
    writeFileSync(path.join(dir, "seed.sql"), "");
    expect(() => localMigrationVersions(dir)).toThrow(GuardError);
  });

  it("同じ version の file が 2 つあれば止める", () => {
    writeFileSync(path.join(dir, "20250101000000_a.sql"), "");
    writeFileSync(path.join(dir, "20250101000000_b.sql"), "");
    expect(() => localMigrationVersions(dir)).toThrow(GuardError);
  });

  it("リポジトリの実際の migration file をすべて解釈できる", () => {
    const versions = localMigrationVersions(
      path.join(REPO_ROOT, "supabase", "migrations")
    );
    expect(versions.length).toBeGreaterThan(0);
  });
});

describe("preflight（secret を使う前）", () => {
  it("main・一致する SHA・存在する migration なら通る", () => {
    migrationsDir(["20250101000000", "20250102000000"]);
    expect(preflight(env(), dir)).toEqual(["20250102000000"]);
  });

  it("none なら空の一覧で通る", () => {
    migrationsDir(["20250101000000"]);
    expect(
      preflight(env({ EXPECTED_PENDING_MIGRATIONS: "none" }), dir)
    ).toEqual([]);
  });

  it.each([
    [{ GITHUB_EVENT_NAME: "push" }, "push で起動"],
    [{ GITHUB_EVENT_NAME: "pull_request" }, "pull_request で起動"],
    [{ GITHUB_REF: "refs/heads/develop" }, "develop"],
    [{ GITHUB_REF: "refs/heads/feature" }, "main 以外の branch"],
    [{ GITHUB_REF: "refs/tags/v1" }, "tag"],
    [{ EXPECTED_SHA: "" }, "SHA の入力なし"],
    [{ EXPECTED_SHA: "abc123" }, "短い SHA"],
    [{ EXPECTED_SHA: "A".repeat(40) }, "大文字の SHA"],
    [{ EXPECTED_SHA: "b".repeat(40) }, "実行 commit と違う SHA"],
    [{ EXPECTED_PROJECT_REF: "" }, "project ref の入力なし"],
    [{ EXPECTED_PROJECT_REF: "abc" }, "project ref の形式違い"],
    [{ EXPECTED_PENDING_MIGRATIONS: "" }, "migration 指定なし"],
    [
      { EXPECTED_PENDING_MIGRATIONS: "20250109000000" },
      "この commit に無い migration",
    ],
  ])("止める: %o（%s）", (overrides) => {
    migrationsDir(["20250101000000", "20250102000000"]);
    expect(() => preflight(env(overrides), dir)).toThrow(GuardError);
  });
});

describe("checkProject", () => {
  it("secret と入力が一致すれば通る（値は返さない）", () => {
    expect(
      checkProject({ SUPABASE_PROJECT_REF: REF, EXPECTED_PROJECT_REF: REF })
    ).toBeUndefined();
  });

  it.each([
    [{ SUPABASE_PROJECT_REF: "", EXPECTED_PROJECT_REF: REF }, "secret が空"],
    [
      {
        SUPABASE_PROJECT_REF: "zyxwvutsrqponmlkjihg",
        EXPECTED_PROJECT_REF: REF,
      },
      "別の project",
    ],
    [
      { SUPABASE_PROJECT_REF: "not-a-ref", EXPECTED_PROJECT_REF: REF },
      "形式違い",
    ],
  ])("止める: %s", (e) => {
    expect(() => checkProject(e)).toThrow(GuardError);
  });

  it("エラー文に project ref の値を出さない", () => {
    try {
      checkProject({
        SUPABASE_PROJECT_REF: "zyxwvutsrqponmlkjihg",
        EXPECTED_PROJECT_REF: REF,
      });
    } catch (err) {
      expect(err.message).not.toContain("zyxwvutsrqponmlkjihg");
      expect(err.message).not.toContain(REF);
    }
  });
});

describe("parseMigrationList（CLI 出力の厳密な読み取り）", () => {
  it("既知の形を読める", () => {
    expect(parseMigrationList(LIST_PENDING)).toEqual([
      { local: "20250101000000", remote: "20250101000000" },
      { local: "20250102000000", remote: null },
    ]);
  });

  it("両端に | の付いた Markdown 形の表も同じ厳密さで読める", () => {
    const md = [
      "Connecting to remote database...",
      "",
      "|Local|Remote|Time (UTC)|",
      "|-|-|-|",
      "|20250101000000|20250101000000|2025-01-01 00:00:00|",
      "|20250102000000||2025-01-02 00:00:00|",
      "",
    ].join("\n");
    expect(parseMigrationList(md)).toEqual([
      { local: "20250101000000", remote: "20250101000000" },
      { local: "20250102000000", remote: null },
    ]);
  });

  it.each([
    [
      "|Local|Remote|Time (UTC)\n|-|-|-|\n|20250101000000|20250101000000|2025-01-01 00:00:00|\n",
      "見出しの右端だけ | が無い",
    ],
    [
      "|Local|Remote|Time (UTC)|\n|-|-|-|\n|20250101000000|20250101000000|2025-01-01 00:00:00\n",
      "行の右端だけ | が無い",
    ],
    [
      "|Local|Remote|Time (UTC)|\n|-|-|-|\n||20250101000000|20250101000000|2025-01-01 00:00:00||\n",
      "| が二重",
    ],
  ])("Markdown 形でも崩れていれば止める: %s（%s）", (output) => {
    expect(() => parseMigrationList(output)).toThrow(GuardError);
  });

  it("CRLF でも読める", () => {
    expect(
      parseMigrationList(LIST_PENDING.replace(/\n/g, "\r\n"))
    ).toHaveLength(2);
  });

  it.each([
    ["", "空"],
    ["Connecting to remote database...\n", "表が無い"],
    [
      LIST_PENDING.replace("Initialising login role...", "WARN: something odd"),
      "表の前に想定外の行",
    ],
    [
      LIST_PENDING.replace(
        "  ----------------|----------------|---------------------",
        "  ===="
      ),
      "区切り行が違う",
    ],
    [
      LIST_PENDING.replace(
        "   20250101000000 | 20250101000000 | 2025-01-01 00:00:00 ",
        "   20250101000000 | 2025010100000x | 2025-01-01 00:00:00 "
      ),
      "表の中に解釈できない行",
    ],
    [
      LIST_PENDING.replace(
        "A new version",
        "Error: connection reset. A new version"
      ),
      "表の後に想定外の行",
    ],
    [`${LIST_PENDING}\n   Local | Remote | Time (UTC)\n`, "表が 2 つ"],
    [
      "   Local          | Remote         | Time (UTC)\n  ---|---|---\n",
      "行が 0 件",
    ],
    [
      "   Local          | Remote         | Time (UTC)\n  ---|---|---\n                |                | 2025-01-01 00:00:00\n",
      "version の無い行",
    ],
  ])("止める: %s", (output) => {
    expect(() => parseMigrationList(output)).toThrow(GuardError);
  });
});

describe("pendingMigrations / checkPending", () => {
  const local = ["20250101000000", "20250102000000"];

  it("未適用が指定と一致すれば apply = true", () => {
    expect(
      checkPending(parseMigrationList(LIST_PENDING), local, ["20250102000000"])
    ).toBe(true);
  });

  it("未適用が無く指定も none なら apply = false", () => {
    expect(checkPending(parseMigrationList(LIST_APPLIED), local, [])).toBe(
      false
    );
  });

  it("指定が none なのに未適用があれば止める（予定外の migration の混在）", () => {
    expect(() =>
      checkPending(parseMigrationList(LIST_PENDING), local, [])
    ).toThrow(GuardError);
  });

  it("未適用より指定が多ければ止める", () => {
    expect(() =>
      checkPending(parseMigrationList(LIST_APPLIED), local, ["20250102000000"])
    ).toThrow(GuardError);
  });

  it("本番にだけある migration（drift）は止める", () => {
    const rows = [
      { local: "20250101000000", remote: "20250101000000" },
      { local: null, remote: "20250105000000" },
    ];
    expect(() => pendingMigrations(rows, ["20250101000000"])).toThrow(/drift/);
  });

  it("Local と Remote が食い違う行は止める", () => {
    const rows = [{ local: "20250101000000", remote: "20250102000000" }];
    expect(() => pendingMigrations(rows, ["20250101000000"])).toThrow(
      GuardError
    );
  });

  it("list の Local 列と commit の file が一致しなければ止める", () => {
    expect(() =>
      pendingMigrations(parseMigrationList(LIST_PENDING), ["20250101000000"])
    ).toThrow(GuardError);
    expect(() =>
      pendingMigrations(parseMigrationList(LIST_PENDING), [
        ...local,
        "20250103000000",
      ])
    ).toThrow(GuardError);
  });
});

describe("checkApplied（適用後の read-back）", () => {
  const local = ["20250101000000", "20250102000000"];

  it("未適用 0 件で指定が本番にあれば通る", () => {
    expect(() =>
      checkApplied(parseMigrationList(LIST_APPLIED), local, ["20250102000000"])
    ).not.toThrow();
  });

  it("未適用が残っていれば止める", () => {
    expect(() =>
      checkApplied(parseMigrationList(LIST_PENDING), local, ["20250102000000"])
    ).toThrow(GuardError);
  });
});

// ---------------------------------------------------------------------------
// workflow 自体の静的な確認（YAML parser に依存しない行単位の検査）

const WORKFLOW = readFileSync(
  path.join(REPO_ROOT, ".github", "workflows", "deploy.yml"),
  "utf8"
);
const lines = WORKFLOW.split("\n");

function topLevelBlock(name) {
  const start = lines.indexOf(`${name}:`);
  if (start < 0) return [];
  const out = [];
  for (const l of lines.slice(start + 1)) {
    if (/^\S/.test(l)) break;
    out.push(l);
  }
  return out.filter((l) => l.trim() !== "");
}

function steps() {
  // "      - name: ..." から次の同じ深さの "- " までを 1 step とする。
  const result = [];
  let current = null;
  let job = null;
  for (const l of lines) {
    const jobMatch = /^ {2}([A-Za-z0-9_-]+):$/.exec(l);
    if (jobMatch && lines.indexOf("jobs:") < lines.indexOf(l)) {
      job = jobMatch[1];
    }
    if (/^ {6}- /.test(l)) {
      current = { job, text: l };
      result.push(current);
    } else if (current && (/^ {7,}\S/.test(l) || l.trim() === "")) {
      current.text += `\n${l}`;
    } else if (current && /^ {0,5}\S/.test(l)) {
      current = null;
    }
  }
  return result;
}

describe("deploy.yml（本番 migration workflow）", () => {
  it("起動は workflow_dispatch だけ（push / PR / schedule などでは起動しない）", () => {
    const on = topLevelBlock("on");
    const triggers = on.filter((l) => /^ {2}\S/.test(l)).map((l) => l.trim());
    expect(triggers).toEqual(["workflow_dispatch:"]);
    expect(WORKFLOW).not.toMatch(
      /^\s*(push|pull_request|pull_request_target|schedule|workflow_run|repository_dispatch):/m
    );
  });

  it("3 つの入力はすべて必須", () => {
    for (const name of [
      "expected_sha",
      "expected_project_ref",
      "expected_pending_migrations",
    ]) {
      const idx = lines.indexOf(`      ${name}:`);
      expect(idx, name).toBeGreaterThan(0);
      expect(lines.slice(idx, idx + 4).join("\n"), name).toContain(
        "required: true"
      );
    }
  });

  it("environment は production に固定（staging への分岐が無い）", () => {
    const envLines = lines.filter((l) => /^\s+environment:/.test(l));
    expect(envLines).toEqual(["    environment: production"]);
    expect(WORKFLOW).not.toContain("'staging'");
  });

  it("並行実行しない・実行中を取り消さない", () => {
    expect(topLevelBlock("concurrency").map((l) => l.trim())).toEqual([
      "group: production-db-migration",
      "cancel-in-progress: false",
    ]);
  });

  it("権限は contents: read だけ", () => {
    expect(topLevelBlock("permissions").map((l) => l.trim())).toEqual([
      "contents: read",
    ]);
  });

  it("入力を run の中へ直接埋め込まない（env 経由だけ）", () => {
    for (const s of steps()) {
      const run = s.text.split(/\n\s+env:\n/)[0];
      expect(run, s.text).not.toMatch(
        /\$\{\{\s*(inputs|github\.event\.inputs)\./
      );
    }
  });

  it("preflight job は secret を使わない", () => {
    const pre = steps().filter((s) => s.job === "preflight");
    expect(pre.length).toBeGreaterThan(0);
    for (const s of pre) {
      expect(s.text).not.toContain("secrets.");
    }
  });

  it("migrate job は preflight 成功が前提で、最初の secret より前に preflight を再実行する", () => {
    expect(WORKFLOW).toMatch(/migrate-production:\n {4}needs: preflight/);
    const mig = steps().filter((s) => s.job === "migrate-production");
    const firstSecret = mig.findIndex((s) => s.text.includes("secrets."));
    const guard = mig.findIndex((s) =>
      s.text.includes("production-migration-guard.mjs preflight")
    );
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(firstSecret).toBeGreaterThan(guard);
    const project = mig.findIndex((s) => s.text.includes("check-project"));
    const link = mig.findIndex((s) => s.text.includes("supabase link"));
    expect(project).toBeLessThan(link);
  });

  it("migration up は照合が一致したときだけ、照合の後で実行する", () => {
    const mig = steps().filter((s) => s.job === "migrate-production");
    const pending = mig.findIndex((s) => s.text.includes("check-pending"));
    const up = mig.findIndex((s) => s.text.includes("supabase migration up"));
    expect(pending).toBeGreaterThan(0);
    expect(up).toBeGreaterThan(pending);
    expect(mig[up].text).toContain("if: steps.pending.outputs.apply == 'true'");
    expect(WORKFLOW.match(/supabase migration up/g)).toHaveLength(1);
  });

  it("適用後に read-back を行う", () => {
    const mig = steps().filter((s) => s.job === "migrate-production");
    const up = mig.findIndex((s) => s.text.includes("supabase migration up"));
    const back = mig.findIndex((s) => s.text.includes("check-applied"));
    expect(back).toBeGreaterThan(up);
    // 適用が失敗しても状態確認（読み取りだけ）は行う
    expect(mig[back].text).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions の式をそのまま照合する
      "if: ${{ always() && steps.pending.outputs.apply == 'true' }}"
    );
    expect(mig[back].text).not.toContain("migration up");
  });

  it("checkout は実行 commit に固定し、認証情報を残さない", () => {
    const checkouts = steps().filter((s) =>
      s.text.includes("actions/checkout")
    );
    expect(checkouts).toHaveLength(2);
    for (const s of checkouts) {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions の式をそのまま照合する
      expect(s.text).toContain("ref: ${{ github.sha }}");
      expect(s.text).toContain("persist-credentials: false");
    }
  });

  it("本番 DB を変える別の命令（db push / reset / config push）を含まない", () => {
    expect(WORKFLOW).not.toMatch(
      /supabase (db push|db reset|config push|migration repair)/
    );
  });
});
