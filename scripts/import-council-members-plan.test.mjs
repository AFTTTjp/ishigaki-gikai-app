import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildImportPlan,
  executeImportPlan,
  formatPlanSummary,
} from "./import-council-members-plan.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = resolve(
  ROOT,
  "docs/ishigaki_council_members/ishigaki-council-members.2022-2030.json"
);
const loadDoc = () => JSON.parse(readFileSync(SOURCE_PATH, "utf-8"));

/** 「Phase 1 適用直後の DB」: 既存22人だけが members にいて、任期データは空 */
function legacyDbState(doc) {
  return {
    members: doc.persons
      .filter((p) => p.kind === "existing")
      .map((p) => ({ id: p.member_id, name: p.name })),
    councilTerms: [],
    memberTerms: [],
    memberAffiliations: [],
    memberAffiliationSnapshots: [],
  };
}

function fakeClient(initial) {
  const tables = {
    members: [...initial.members],
    council_terms: [],
    member_terms: [],
    member_affiliations: [],
    member_affiliation_snapshots: [],
  };
  const calls = [];
  return {
    tables,
    calls,
    from(table) {
      return {
        async insert(rows) {
          calls.push({ op: "insert", table, rows });
          for (const row of rows) {
            tables[table].push(
              table === "council_terms" || table === "member_terms"
                ? { id: `${table}-${tables[table].length + 1}`, ...row }
                : row
            );
          }
          return { error: null };
        },
        async select() {
          calls.push({ op: "select", table });
          return { data: tables[table], error: null };
        },
      };
    },
  };
}

describe("buildImportPlan (offline)", () => {
  it("DB照合なしでは人物27 / 旧23 + 新22 = 45 の member_terms / 議会任期2 を計画し、所属DB行は 0", () => {
    const doc = loadDoc();
    const plan = buildImportPlan(doc, null);
    expect(plan.mode).toBe("offline");
    expect(plan.errors).toEqual([]);
    expect(plan.members.insert).toHaveLength(5);
    expect(plan.members.unverified).toHaveLength(22);
    expect(plan.councilTerms.insert).toHaveLength(2);
    expect(plan.memberTerms.insert).toHaveLength(45);
    expect(plan.affiliations).toMatchObject({
      candidateTotal: 22,
      holdCount: 22,
    });
    expect(plan.affiliations.readyInsert).toHaveLength(0);
  });

  it("offline の計画は実行できない", async () => {
    const plan = buildImportPlan(loadDoc(), null);
    await expect(executeImportPlan(plan, fakeClient(legacyDbState(loadDoc())))).rejects.toThrow(
      "offline"
    );
  });
});

describe("buildImportPlan (online)", () => {
  it("Phase 1 直後の DB に対して members 5件 / 議会任期2 / member_terms 45 を追加する", () => {
    const doc = loadDoc();
    const plan = buildImportPlan(doc, legacyDbState(doc));
    expect(plan.errors).toEqual([]);
    expect(plan.members.verified).toHaveLength(22);
    expect(plan.members.insert.map((m) => m.name).sort()).toEqual(
      ["﨑山 英輔", "大浜 雅史", "徳村 政倫", "田村 博孝", "砥板 芳行"].sort()
    );
    expect(plan.memberTerms.insert).toHaveLength(45);
    expect(formatPlanSummary(plan)).toContain("hold(DB行にならない) 22");
  });

  it("追加する members 行は (id, name, name_kana, address) だけで、legacy列と birth_date を含まない", () => {
    const doc = loadDoc();
    const plan = buildImportPlan(doc, legacyDbState(doc));
    for (const row of plan.members.insert) {
      expect(Object.keys(row).sort()).toEqual(["address", "id", "name", "name_kana"]);
    }
    const tamura = plan.members.insert.find((m) => m.name === "田村 博孝");
    expect(tamura).toMatchObject({ name_kana: "たむら ひろたか", address: "平得" });
    const toita = plan.members.insert.find((m) => m.name === "砥板 芳行");
    expect(toita).toMatchObject({ name_kana: null, address: null });
  });

  it("既存人物が DB に無い / 氏名が違う場合はエラー（名前で探し直さない）", () => {
    const doc = loadDoc();
    const missing = legacyDbState(doc);
    missing.members.pop();
    expect(buildImportPlan(doc, missing).errors.join()).toContain("not found in DB");

    const renamed = legacyDbState(doc);
    renamed.members[0].name = "別人 太郎";
    expect(buildImportPlan(doc, renamed).errors.join()).toContain("differs from source");
  });

  it("新規人物と同名の別IDが DB にいる場合は二重登録せずエラー", () => {
    const doc = loadDoc();
    const db = legacyDbState(doc);
    db.members.push({ id: "11111111-1111-4111-8111-111111111111", name: "田村 博孝" });
    const plan = buildImportPlan(doc, db);
    expect(plan.errors.join()).toContain("name collision");
    expect(plan.members.insert.map((m) => m.name)).not.toContain("田村 博孝");
  });

  it("2回目の計画は何も追加しない（idempotent）", async () => {
    const doc = loadDoc();
    const client = fakeClient(legacyDbState(doc));
    await executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), client);

    const second = buildImportPlan(doc, {
      members: client.tables.members,
      councilTerms: client.tables.council_terms,
      memberTerms: client.tables.member_terms,
      memberAffiliations: client.tables.member_affiliations,
      memberAffiliationSnapshots: client.tables.member_affiliation_snapshots,
    });
    expect(second.errors).toEqual([]);
    expect(second.members.insert).toHaveLength(0);
    expect(second.councilTerms.insert).toHaveLength(0);
    expect(second.memberTerms.insert).toHaveLength(0);
    expect(second.memberTerms.unchanged).toHaveLength(45);
  });

  it("既に存在する新人・砥板の行で name_kana / address が JSON と違う場合はエラー（成功扱いにしない）", async () => {
    const doc = loadDoc();
    const client = fakeClient(legacyDbState(doc));
    await executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), client);
    const dbState = () => ({
      members: client.tables.members,
      councilTerms: client.tables.council_terms,
      memberTerms: client.tables.member_terms,
      memberAffiliations: [],
      memberAffiliationSnapshots: client.tables.member_affiliation_snapshots,
    });
    expect(buildImportPlan(doc, dbState()).errors).toEqual([]);

    const tamura = client.tables.members.find((m) => m.name === "田村 博孝");
    tamura.address = "石垣市字平得";
    expect(buildImportPlan(doc, dbState()).errors.join()).toContain(
      "DB address differs from source"
    );
    tamura.address = "平得";

    client.tables.members.find((m) => m.name === "砥板 芳行").name_kana =
      "とのいた";
    expect(buildImportPlan(doc, dbState()).errors.join()).toContain(
      "DB name_kana differs from source"
    );
  });

  it("DB の既存行と値が違う場合は上書きせずエラー", async () => {
    const doc = loadDoc();
    const client = fakeClient(legacyDbState(doc));
    await executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), client);
    client.tables.member_terms[0].seat_number = 3;
    const plan = buildImportPlan(doc, {
      members: client.tables.members,
      councilTerms: client.tables.council_terms,
      memberTerms: client.tables.member_terms,
      memberAffiliations: [],
      memberAffiliationSnapshots: client.tables.member_affiliation_snapshots,
    });
    expect(plan.errors.join()).toContain("create-only importer does not overwrite");
  });
});

describe("executeImportPlan", () => {
  it("insert と select だけを使い、update / upsert / delete を呼ばない", async () => {
    const doc = loadDoc();
    const client = fakeClient(legacyDbState(doc));
    const result = await executeImportPlan(
      buildImportPlan(doc, legacyDbState(doc)),
      client
    );
    expect(result).toEqual({
      members: 5,
      councilTerms: 2,
      memberTerms: 45,
      affiliations: 0,
      snapshots: 22,
    });
    expect(client.calls.every((c) => ["insert", "select"].includes(c.op))).toBe(true);
    expect(client.tables.members).toHaveLength(27);
    expect(client.tables.member_terms).toHaveLength(45);
    expect(client.tables.member_affiliations).toHaveLength(0);
    expect(client.tables.member_affiliation_snapshots).toHaveLength(22);
  });

  it("insert の順序は members → council_terms → member_terms → snapshots（member_affiliations は ready 0 件のため無し）", async () => {
    const doc = loadDoc();
    const client = fakeClient(legacyDbState(doc));
    await executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), client);
    const insertOrder = client.calls
      .filter((c) => c.op === "insert")
      .map((c) => c.table);
    expect(insertOrder).toEqual([
      "members",
      "council_terms",
      "member_terms",
      "member_affiliation_snapshots",
    ]);
  });

  it("ready の所属がある場合の順序は …→ member_terms → member_affiliations → snapshots", async () => {
    const doc = loadDoc();
    Object.assign(doc.affiliation_entries[0], {
      status: "ready",
      effective_from: "2026-09-29",
      source_url: "https://example.com/evidence",
    });
    const client = fakeClient(legacyDbState(doc));
    await executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), client);
    expect(
      client.calls.filter((c) => c.op === "insert").map((c) => c.table)
    ).toEqual([
      "members",
      "council_terms",
      "member_terms",
      "member_affiliations",
      "member_affiliation_snapshots",
    ]);
  });

  it("既存 members 行には触れず、新規行に legacy列を入れない", async () => {
    const doc = loadDoc();
    const client = fakeClient(legacyDbState(doc));
    await executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), client);
    const memberInserts = client.calls.filter((c) => c.table === "members" && c.op === "insert");
    expect(memberInserts).toHaveLength(1);
    for (const row of memberInserts[0].rows) {
      for (const column of ["party", "party_group", "election_count", "birth_date"]) {
        expect(row).not.toHaveProperty(column);
      }
    }
  });

  it("member_terms は council_terms の id に解決される", async () => {
    const doc = loadDoc();
    const client = fakeClient(legacyDbState(doc));
    await executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), client);
    const councilIds = new Set(client.tables.council_terms.map((t) => t.id));
    expect(client.tables.member_terms.every((t) => councilIds.has(t.council_term_id))).toBe(true);
  });

  it("ready の所属だけが member_affiliations に入り、hold は入らない", async () => {
    const doc = loadDoc();
    const target = doc.affiliation_entries[0];
    Object.assign(target, {
      status: "ready",
      effective_from: "2026-09-29",
      source_url: "https://example.com/evidence",
    });
    const client = fakeClient(legacyDbState(doc));
    const result = await executeImportPlan(
      buildImportPlan(doc, legacyDbState(doc)),
      client
    );
    expect(result.affiliations).toBe(1);
    expect(client.tables.member_affiliations).toHaveLength(1);
    expect(client.tables.member_affiliations[0]).toMatchObject({
      valid_from: "2026-09-29",
      party: target.party,
      party_group: target.party_group,
    });
  });

  it("既存の議会任期と期間が重なる任期は、start_date が違っても拒否する", () => {
    const doc = loadDoc();
    const db = legacyDbState(doc);
    db.councilTerms.push({
      id: "ct-existing",
      start_date: "2026-10-01",
      end_date: "2030-09-30",
    });
    const plan = buildImportPlan(doc, db);
    expect(plan.errors.join()).toContain("overlaps an existing DB council term");
    expect(plan.councilTerms.insert.map((t) => t.start_date)).toEqual(["2022-09-28"]);
  });

  it("既存の所属と期間が重なる ready 所属は、valid_from が違っても拒否する", async () => {
    const doc = loadDoc();
    const target = doc.affiliation_entries[0];
    Object.assign(target, {
      status: "ready",
      effective_from: "2026-09-29",
      source_url: "https://example.com/evidence",
    });
    const client = fakeClient(legacyDbState(doc));
    await executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), client);
    expect(client.tables.member_affiliations).toHaveLength(1);

    // DB に 2026-09-29〜 継続中の所属がある member_term へ、別の valid_from(2027-01-01) を追加しようとする
    const later = loadDoc();
    Object.assign(later.affiliation_entries[0], {
      status: "ready",
      effective_from: "2027-01-01",
      source_url: "https://example.com/evidence2",
    });
    const memberTermIdOf = (memberId) =>
      client.tables.member_terms.find(
        (t) => t.member_id === memberId && t.start_date === "2026-09-28"
      ).id;
    const plan = buildImportPlan(later, {
      members: client.tables.members,
      councilTerms: client.tables.council_terms,
      memberTerms: client.tables.member_terms,
      memberAffiliationSnapshots: client.tables.member_affiliation_snapshots,
      memberAffiliations: client.tables.member_affiliations.map((a) => ({
        ...a,
        member_term_id: memberTermIdOf(target.member_id),
      })),
    });
    expect(plan.errors.join()).toContain("overlaps an existing DB affiliation");
    expect(plan.affiliations.readyInsert).toHaveLength(0);
  });

  it("エラーのある計画は実行しない", async () => {
    const doc = loadDoc();
    const db = legacyDbState(doc);
    db.members.pop();
    const plan = buildImportPlan(doc, db);
    const client = fakeClient(db);
    await expect(executeImportPlan(plan, client)).rejects.toThrow("refusing");
    expect(client.calls).toHaveLength(0);
  });
});

describe("観測スナップショット（member_affiliation_snapshots）の計画と実行", () => {
  const dbStateOf = (client) => ({
    members: client.tables.members,
    councilTerms: client.tables.council_terms,
    memberTerms: client.tables.member_terms,
    memberAffiliations: client.tables.member_affiliations,
    memberAffiliationSnapshots: client.tables.member_affiliation_snapshots,
  });
  const importedClient = async (doc) => {
    const client = fakeClient(legacyDbState(doc));
    await executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), client);
    return client;
  };

  it("空の DB（Phase 1 直後）では 22 件を追加予定にする", () => {
    const doc = loadDoc();
    const plan = buildImportPlan(doc, legacyDbState(doc));
    expect(plan.errors).toEqual([]);
    expect(plan.snapshots.sourceTotal).toBe(22);
    expect(plan.snapshots.insert).toHaveLength(22);
    expect(plan.snapshots.unchanged).toHaveLength(0);
    expect(formatPlanSummary(plan)).toContain(
      "member_affiliation_snapshots（観測スナップショット）: ソース 22 / 追加予定 22 / 変更なし 0"
    );
    expect(formatPlanSummary(plan)).toContain(
      "member_affiliations（所属履歴候補）: 候補 22 / ready(DB行になる) 0 / hold(DB行にならない) 22"
    );
  });

  it("offline でも 22 件を追加予定にする（DB照合なし）", () => {
    const plan = buildImportPlan(loadDoc(), null);
    expect(plan.snapshots.insert).toHaveLength(22);
  });

  it("出典 id は root sources の URL に解決され、source id は DB 行に入らない", async () => {
    const doc = loadDoc();
    const roster = doc.sources.find((x) => x.id === "official-roster-20260930").url;
    const caucus = doc.sources.find((x) => x.id === "official-caucus-20260930").url;
    const client = await importedClient(doc);
    const rows = client.tables.member_affiliation_snapshots;
    expect(rows).toHaveLength(22);

    const nameOf = (termId) =>
      doc.persons.find(
        (p) => p.member_id === client.tables.member_terms.find((t) => t.id === termId).member_id
      ).name;
    const byName = (name) => rows.find((r) => nameOf(r.member_term_id) === name);

    // 会派ページ由来の会派
    expect(byName("長山 家康")).toMatchObject({
      party_source_url: roster,
      party_group: "自由民主石垣",
      party_group_source_url: caucus,
      party_group_observed_on: "2026-09-29",
    });
    // 議員名簿が明記した「無会派」
    expect(byName("田村 博孝")).toMatchObject({
      party_group: "無会派",
      party_group_source_url: roster,
      party_group_observed_on: "2026-09-30",
    });
    // 会派不明（null）は出典も基準日も持たない
    expect(byName("後上里 厚司")).toMatchObject({
      party_group: null,
      party_group_source_url: null,
      party_group_observed_on: null,
    });
    for (const row of rows) {
      expect(row.observed_on).toBe("2026-10-02");
      expect(Object.keys(row).sort()).toEqual(
        [
          "member_term_id",
          "observed_on",
          "party",
          "party_group",
          "party_group_observed_on",
          "party_group_source_url",
          "party_observed_on",
          "party_source_url",
        ].sort()
      );
    }
  });

  it("既存の snapshot が全て同じ値なら unchanged 22 で、何も追加しない（idempotent）", async () => {
    const doc = loadDoc();
    const client = await importedClient(doc);
    const plan = buildImportPlan(doc, dbStateOf(client));
    expect(plan.errors).toEqual([]);
    expect(plan.snapshots.unchanged).toHaveLength(22);
    expect(plan.snapshots.insert).toHaveLength(0);
  });

  it("同じ (member_term, observed_on) で1項目でも違えばエラーにし、UPDATE で直さない", async () => {
    const doc = loadDoc();
    for (const [field, value] of [
      ["party", "別の政党"],
      ["party_group", "別の会派"],
      ["party_observed_on", "2026-10-01"],
      ["party_group_observed_on", "2026-10-01"],
      ["party_source_url", "https://example.com/other"],
      ["party_group_source_url", "https://example.com/other"],
    ]) {
      const client = await importedClient(doc);
      // 会派・会派の基準日・出典を持つ行（自由民主石垣の議員）を書き換える
      const target = client.tables.member_affiliation_snapshots.find(
        (r) => r.party_group === "自由民主石垣"
      );
      target[field] = value;
      const plan = buildImportPlan(doc, dbStateOf(client));
      expect(plan.errors.join(), field).toContain(
        `DB ${field} differs from source (append-only`
      );
      expect(plan.snapshots.insert, field).toHaveLength(0);
    }
  });

  it("同じ member_term で observed_on が違う既存 snapshot があっても、新しい observed_on は追加される（append）", async () => {
    const doc = loadDoc();
    const client = await importedClient(doc);
    for (const row of client.tables.member_affiliation_snapshots) {
      row.observed_on = "2026-09-30";
    }
    const plan = buildImportPlan(doc, dbStateOf(client));
    expect(plan.errors).toEqual([]);
    expect(plan.snapshots.insert).toHaveLength(22);
    expect(plan.snapshots.unchanged).toHaveLength(0);
  });

  it("member_term が解決できない snapshot は実行時に失敗する", async () => {
    const doc = loadDoc();
    const plan = buildImportPlan(doc, legacyDbState(doc));
    plan.snapshots.insert.push({
      ...plan.snapshots.insert[0],
      member_id: "00000000-0000-4000-8000-000000000000",
    });
    const client = fakeClient(legacyDbState(doc));
    await expect(executeImportPlan(plan, client)).rejects.toThrow(
      "member_term not found"
    );
    // snapshot は member_terms の後に処理されるため、解決失敗時に snapshot は1件も入らない
    expect(client.tables.member_affiliation_snapshots).toHaveLength(0);
  });

  it("snapshot の insert が失敗したらエラーを表面化する", async () => {
    const doc = loadDoc();
    const base = fakeClient(legacyDbState(doc));
    const failing = {
      from(table) {
        if (table !== "member_affiliation_snapshots") return base.from(table);
        return {
          insert: async () => ({ error: { message: "boom" } }),
          select: async () => ({ data: [], error: null }),
        };
      },
    };
    await expect(
      executeImportPlan(buildImportPlan(doc, legacyDbState(doc)), failing)
    ).rejects.toThrow("member_affiliation_snapshots insert failed: boom");
  });

  it("snapshot から member_affiliations（履歴）の行は作られない", async () => {
    const doc = loadDoc();
    const client = await importedClient(doc);
    expect(client.tables.member_affiliations).toHaveLength(0);
    expect(client.tables.member_affiliation_snapshots).toHaveLength(22);
  });
});

describe("CLI (scripts/import-council-members.mjs)", () => {
  const script = resolve(ROOT, "scripts/import-council-members.mjs");
  const run = (args, env = {}) =>
    spawnSync("node", [script, ...args], {
      encoding: "utf-8",
      env: { PATH: process.env.PATH, ...env },
    });

  it("既定は offline dry-run で、書き込みなしに正常終了する", () => {
    const result = run([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("DRY RUN 完了（書き込みなし）");
    expect(result.stdout).toContain("ready 0 / hold 22");
    expect(result.stdout).toContain("Production gate: blocked");
  });

  it("DB接続情報なしの --execute は拒否される", () => {
    const result = run(["--execute"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SUPABASE_URL");
  });

  const remote = {
    SUPABASE_URL: "https://example-project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "dummy",
  };

  it("リモートへの --execute は --prod が無ければ拒否される（接続前に停止）", () => {
    const result = run(["--execute"], remote);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--prod");
  });

  it("--prod があっても gate=blocked の間は拒否される（接続前に停止）", () => {
    const result = run(["--execute", "--prod", "--confirm-ui-compat-deployed"], remote);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("production_import_gate=blocked");
  });

  it("localhost を含むだけのリモートホストは local 扱いにならない（--prod 必須のまま）", () => {
    const result = run(["--execute"], {
      SUPABASE_URL: "https://localhost.example.com",
      SUPABASE_SERVICE_ROLE_KEY: "dummy",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--prod");
  });

  it("不正な JSON は検証エラーで停止する", () => {
    expect(() =>
      execFileSync("node", [script, "--input", "package.json"], {
        encoding: "utf-8",
        stdio: "pipe",
        env: { PATH: process.env.PATH },
      })
    ).toThrow();
  });
});
