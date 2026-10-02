import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectCouncilMembersErrors,
  isRealIsoDate,
  splitAffiliationEntries,
  validateCouncilMembersDocument,
} from "./import-council-members-validation.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = resolve(
  ROOT,
  "docs/ishigaki_council_members/ishigaki-council-members.2022-2030.json"
);
const LEGACY_SQL_PATH = resolve(ROOT, "docs/20260407_members_本番反映SQL.sql");

const loadDoc = () => JSON.parse(readFileSync(SOURCE_PATH, "utf-8"));

function errorsAfter(mutate) {
  const doc = loadDoc();
  mutate(doc);
  return collectCouncilMembersErrors(doc);
}

const OLD_KEY = "2022-2026";
const NEW_KEY = "2026-2030";

describe("正本JSON（実データ）", () => {
  const doc = loadDoc();

  it("検証を通る", () => {
    expect(collectCouncilMembersErrors(doc)).toEqual([]);
    expect(() => validateCouncilMembersDocument(doc)).not.toThrow();
  });

  it("人物27 / 旧任期23 / 新任期22 / 所属スナップショット22", () => {
    const kinds = (kind) => doc.persons.filter((p) => p.kind === kind).length;
    expect(doc.persons).toHaveLength(27);
    expect(kinds("existing")).toBe(22);
    expect(kinds("newcomer")).toBe(4);
    expect(kinds("historical")).toBe(1);
    expect(doc.member_terms.filter((t) => t.council_term_key === OLD_KEY)).toHaveLength(23);
    expect(doc.member_terms.filter((t) => t.council_term_key === NEW_KEY)).toHaveLength(22);
    expect(doc.affiliation_entries).toHaveLength(22);
  });

  it("所属はすべて hold で、DB行（ready）は 0 件", () => {
    const { ready, hold } = splitAffiliationEntries(doc);
    expect(ready).toHaveLength(0);
    expect(hold).toHaveLength(22);
    expect(doc.affiliation_entries.every((e) => e.effective_from === null)).toBe(true);
  });

  it("既存22人のIDと氏名が legacy の本番反映SQLと一致する（照合ではなく完全一致の整合確認）", () => {
    const sql = readFileSync(LEGACY_SQL_PATH, "utf-8");
    const legacy = new Map(
      [...sql.matchAll(/\('([0-9a-f-]{36})', '([^']+)'/g)].map((m) => [m[1], m[2]])
    );
    const existing = doc.persons.filter((p) => p.kind === "existing");
    expect(legacy.size).toBe(22);
    expect(existing).toHaveLength(22);
    for (const person of existing) {
      expect(legacy.get(person.member_id), person.name).toBe(person.name);
    }
  });

  it("新任期に残らない4人は新任期の member_term を持たない", () => {
    const retiredNames = ["石川 勇作", "田盛 英伸", "仲嶺 忠師", "宮良 操"];
    const retiredIds = doc.persons
      .filter((p) => retiredNames.includes(p.name))
      .map((p) => p.member_id);
    expect(retiredIds).toHaveLength(4);
    const newTermMembers = new Set(
      doc.member_terms
        .filter((t) => t.council_term_key === NEW_KEY)
        .map((t) => t.member_id)
    );
    for (const id of retiredIds) expect(newTermMembers.has(id)).toBe(false);
    // 再選18人 + 新人4人 = 22
    const reelected = doc.persons.filter(
      (p) => p.kind === "existing" && newTermMembers.has(p.member_id)
    );
    expect(reelected).toHaveLength(18);
  });

  it("途中交代: 砥板芳行は 2025-07-29 まで、新里裕樹は 2025-08-17 から", () => {
    const byName = (name) => doc.persons.find((p) => p.name === name).member_id;
    const termOf = (name) =>
      doc.member_terms.find(
        (t) => t.council_term_key === OLD_KEY && t.member_id === byName(name)
      );
    expect(termOf("砥板 芳行")).toMatchObject({ end_date: "2025-07-29" });
    expect(termOf("新里 裕樹")).toMatchObject({
      start_date: "2025-08-17",
      end_date: null,
    });
  });

  it("旧任期の seat_number / election_count は一次資料が無いため全て NULL で hold 宣言されている", () => {
    for (const term of doc.member_terms.filter((t) => t.council_term_key === OLD_KEY)) {
      expect(term.seat_number).toBeNull();
      expect(term.election_count).toBeNull();
      expect(term.holds).toEqual(["seat_number", "election_count"]);
    }
  });

  it("新人の birth_date は持たず、生年は birth_year_label（証跡）としてのみ保持する", () => {
    for (const person of doc.persons.filter((p) => p.kind === "newcomer")) {
      expect(person).not.toHaveProperty("birth_date");
      expect(person.birth_year_label).toMatch(/^(昭和|平成)\d+年$/);
    }
  });

  it("source_discrepancies は井上美智子の会派（日本共産党を採用）の1件だけ", () => {
    expect(doc.source_discrepancies).toHaveLength(1);
    const idOf = (name) => doc.persons.find((p) => p.name === name).member_id;
    const [inoue] = doc.source_discrepancies;
    expect(inoue).toMatchObject({
      member_id: idOf("井上 美智子"),
      field: "party_group",
      resolved_value: "日本共産党",
    });
    expect(inoue.observations.map((o) => o.value)).toEqual(["無会派", "日本共産党"]);
    const entry = doc.affiliation_entries.find((e) => e.member_id === idOf("井上 美智子"));
    expect(entry).toMatchObject({ party: "日本共産党", party_group: "日本共産党" });
  });

  it('明示的な「無会派」は公式名簿に会派として明記された田村博孝・大浜雅史・大道夏代の3人だけ', () => {
    const nameOf = (id) => doc.persons.find((p) => p.member_id === id).name;
    const explicit = doc.affiliation_entries
      .filter((e) => e.party_group === "無会派")
      .map((e) => nameOf(e.member_id))
      .sort();
    expect(explicit).toEqual(["大浜 雅史", "大道 夏代", "田村 博孝"].sort());
    for (const entry of doc.affiliation_entries.filter((e) => e.party_group === "無会派")) {
      expect(entry.party_group_basis).toBeTruthy();
      expect(entry.caucus_formed_on).toBeNull();
    }
  });

  it("後上里厚司・箕底用一は会派不明(null)のまま hold で、観測日も持たない", () => {
    for (const name of ["後上里 厚司", "箕底 用一"]) {
      const id = doc.persons.find((p) => p.name === name).member_id;
      const entry = doc.affiliation_entries.find((e) => e.member_id === id);
      expect(entry.party_group).toBeNull();
      expect(entry.party_group_observed_on).toBeNull();
      expect(entry.party_group_basis).toContain("無会派とは断定せず");
      expect(entry.status).toBe("hold");
    }
  });

  it("公明石垣の結成日は 2026-09-29", () => {
    const komei = doc.affiliation_entries.filter((e) => e.party_group === "公明石垣");
    expect(komei).toHaveLength(2);
    for (const entry of komei) expect(entry.caucus_formed_on).toBe("2026-09-29");
  });

  it("2022-2026 の議会任期は 7037 の通知を直接 source にし、補選通知は新里の member_term の source", () => {
    const sourceIdOf = (url) => doc.sources.find((s) => s.url.endsWith(url)).id;
    const old = doc.council_terms.find((t) => t.start_date === "2022-09-28");
    expect(old.source_ids).toEqual([sourceIdOf("kouhoujyouhoukoukai/7037.html")]);
    const shinzato = doc.persons.find((p) => p.name === "新里 裕樹").member_id;
    const term = doc.member_terms.find(
      (t) => t.council_term_key === "2022-2026" && t.member_id === shinzato
    );
    expect(term.source_ids).toEqual([sourceIdOf("kouhoujyouhoukoukai/11368.html")]);
  });

  it("公式出典3ページ（辞職許可・補選・2022年選挙）は2026-10-02に原本確認済みで、更新日が記録されている", () => {
    const expected = {
      "11269.html": "2025-07-29",
      "11368.html": "2025-08-20",
      "7037.html": "2022-09-28",
    };
    for (const [url, updatedOn] of Object.entries(expected)) {
      const source = doc.sources.find((s) => s.url.endsWith(url));
      expect(source.retrieved_on, url).toBe("2026-10-02");
      expect(source.page_updated_on, url).toBe(updatedOn);
      expect(source.verification_note, url).toContain("公式原本を2026-10-02に直接確認済み");
      expect(source.verification_note, url).not.toMatch(/404|未確認|独立レビュー|保存版/);
    }
  });

  it("Production gate は blocked", () => {
    expect(doc.production_import_gate.status).toBe("blocked");
  });
});

describe("isRealIsoDate", () => {
  it("実在する日付のみ true", () => {
    expect(isRealIsoDate("2028-02-29")).toBe(true);
    expect(isRealIsoDate("2029-02-29")).toBe(false);
    expect(isRealIsoDate("2030-13-01")).toBe(false);
    expect(isRealIsoDate("2030/01/01")).toBe(false);
    expect(isRealIsoDate(null)).toBe(false);
  });
});

describe("fail-closed 検証", () => {
  const hasError = (errors, fragment) =>
    expect(errors.some((e) => e.includes(fragment)), errors.join("\n")).toBe(true);

  it("document / schema_version / 未知キー", () => {
    expect(collectCouncilMembersErrors(null)).not.toEqual([]);
    hasError(errorsAfter((d) => (d.schema_version = "x")), "schema_version");
    hasError(errorsAfter((d) => (d.extra = 1)), 'unknown key "extra"');
  });

  it("member_id の重複", () => {
    hasError(
      errorsAfter((d) => (d.persons[1].member_id = d.persons[0].member_id)),
      "duplicate member_id"
    );
  });

  it("member_id が UUID でない（名前などから生成しない）", () => {
    hasError(
      errorsAfter((d) => (d.persons[0].member_id = "石垣 達也")),
      "explicit lowercase UUID"
    );
  });

  it("member_term が未知の member_id を指す", () => {
    hasError(
      errorsAfter((d) => (d.member_terms[0].member_id = "00000000-0000-4000-8000-000000000000")),
      "unknown member_id"
    );
  });

  it("名前で参照する行（member_id なし）は拒否される", () => {
    hasError(
      errorsAfter((d) => {
        delete d.member_terms[0].member_id;
        d.member_terms[0].member_name = "石垣 達也";
      }),
      'unknown key "member_name"'
    );
  });

  it("member_term が未知の council term を指す", () => {
    hasError(
      errorsAfter((d) => (d.member_terms[0].council_term_key = "2030-2034")),
      "unknown council term"
    );
  });

  it("同じ議会任期に同一人物の member_term が重複", () => {
    hasError(
      errorsAfter((d) => d.member_terms.push({ ...d.member_terms[0] })),
      "duplicate member_term"
    );
  });

  it("member_term の期間が議会任期の外", () => {
    hasError(
      errorsAfter((d) => (d.member_terms[0].start_date = "2022-09-27")),
      "outside council term"
    );
    hasError(
      errorsAfter((d) => {
        const t = d.member_terms.find((x) => x.end_date);
        t.end_date = "2026-09-28";
      }),
      "outside council term"
    );
  });

  it("start_date > end_date", () => {
    hasError(
      errorsAfter((d) => {
        const t = d.member_terms.find((x) => x.end_date);
        t.end_date = "2022-09-01";
      }),
      "start_date must be <= end_date"
    );
  });

  it("議会任期の重複 / 期間逆転", () => {
    hasError(
      errorsAfter((d) => (d.council_terms[0].end_date = "2026-09-28")),
      "overlap"
    );
    hasError(
      errorsAfter((d) => (d.council_terms[0].end_date = "2022-09-01")),
      "start_date must be <= end_date"
    );
  });

  it("完全性: 人物数・member_terms 数・議会任期", () => {
    hasError(errorsAfter((d) => d.persons.pop()), "expected 27 persons");
    hasError(errorsAfter((d) => d.member_terms.pop()), "expected 22 for council term 2026-09-28");
    hasError(
      errorsAfter((d) => d.member_terms.splice(0, 1)),
      "expected 23 for council term 2022-09-28"
    );
    hasError(errorsAfter((d) => d.council_terms.pop()), "expected 2 terms");
  });

  it("完全性: 現任期の席番号は 1..22 を過不足なく埋める", () => {
    hasError(
      errorsAfter((d) => {
        const terms = d.member_terms.filter((t) => t.council_term_key === NEW_KEY);
        terms[1].seat_number = terms[0].seat_number;
      }),
      "exactly 1..22"
    );
    hasError(
      errorsAfter((d) => {
        d.member_terms.find((t) => t.council_term_key === NEW_KEY).seat_number = 23;
      }),
      "exactly 1..22"
    );
  });

  it("旧任期の同時在職者が議席数22を超えない", () => {
    hasError(
      errorsAfter((d) => {
        // 砥板の辞職日を任期末まで延ばすと、補選就任後に23人が同時在職になる
        d.member_terms.find((t) => t.end_date === "2025-07-29").end_date = null;
      }),
      "capacity 22"
    );
  });

  it("NULL の項目は holds で宣言が必要", () => {
    hasError(
      errorsAfter((d) => {
        d.member_terms[0].holds = [];
      }),
      "null must be declared in holds"
    );
  });

  it("出典が必要な行に source がない / 未知の source", () => {
    hasError(
      errorsAfter((d) => {
        d.member_terms.find((t) => t.end_date === "2025-07-29").source_ids = [];
      }),
      "at least one source is required"
    );
    hasError(
      errorsAfter((d) => (d.council_terms[0].source_ids = ["unknown-source"])),
      "unknown source id"
    );
  });

  it("source の URL が無い / https でない", () => {
    hasError(errorsAfter((d) => delete d.sources[0].url), "must be an https URL");
    hasError(
      errorsAfter((d) => (d.sources[0].url = "http://example.com")),
      "must be an https URL"
    );
  });

  it("existing 人物は legacy_source 必須で、プロフィールを書き直せない", () => {
    hasError(
      errorsAfter((d) => delete d.persons[0].legacy_source),
      "legacy_source"
    );
    hasError(
      errorsAfter((d) => (d.persons[0].address = "石垣市字大浜")),
      "do not restate"
    );
  });

  it("birth_date は persons に書けない（合成禁止）", () => {
    hasError(
      errorsAfter((d) => {
        const n = d.persons.find((p) => p.kind === "newcomer");
        n.birth_date = "1968-01-01";
      }),
      'unknown key "birth_date"'
    );
  });

  it("newcomer は kana / address / birth_year_label が必須", () => {
    hasError(
      errorsAfter((d) => {
        delete d.persons.find((p) => p.kind === "newcomer").address;
      }),
      "address: required for newcomers"
    );
  });

  it("所属: effective_from が無い ready は拒否（observed_on / caucus_formed_on で代用しない）", () => {
    hasError(
      errorsAfter((d) => {
        const e = d.affiliation_entries[0];
        e.status = "ready";
        e.source_url = "https://example.com/x";
        // effective_from は null のまま。observed_on と caucus_formed_on は値があっても代用されない
      }),
      "requires a confirmed effective_from"
    );
  });

  it("所属: 無会派は照合の根拠（party_group_basis）なしでは書けない", () => {
    hasError(
      errorsAfter((d) => {
        const e = d.affiliation_entries.find((x) => x.party_group === "無会派");
        delete e.party_group_basis;
      }),
      "party_group_basis"
    );
  });

  it("所属: 会派不明(null)も根拠なしでは書けず、観測日を持てない", () => {
    hasError(
      errorsAfter((d) => {
        const e = d.affiliation_entries.find((x) => x.party_group === null);
        delete e.party_group_basis;
      }),
      "party_group_basis"
    );
    hasError(
      errorsAfter((d) => {
        const e = d.affiliation_entries.find((x) => x.party_group === null);
        e.party_group_observed_on = "2026-09-30";
      }),
      "party_group_observed_on: must be null"
    );
  });

  it("source_discrepancies: 各項目の必須項目を fail-closed で検証する", () => {
    const first = (d) => d.source_discrepancies[0];
    hasError(errorsAfter((d) => delete first(d).member_id), "unknown member_id");
    hasError(errorsAfter((d) => (first(d).member_id = "00000000-0000-4000-8000-000000000000")), "unknown member_id");
    for (const field of ["field", "resolved_value", "resolution"]) {
      hasError(errorsAfter((d) => delete first(d)[field]), `${field}: required`);
    }
    hasError(errorsAfter((d) => (first(d).observations = [first(d).observations[0]])), "at least 2 observations");
    hasError(errorsAfter((d) => delete first(d).observations), "at least 2 observations");
    hasError(errorsAfter((d) => (first(d).observations[0].source_id = "unknown")), "unknown source id");
    hasError(errorsAfter((d) => delete first(d).observations[0].value), "value: required");
    hasError(errorsAfter((d) => (first(d).observations[0].extra = 1)), 'unknown key "extra"');
  });

  it("所属: hold には理由が必須", () => {
    hasError(
      errorsAfter((d) => delete d.affiliation_entries[0].hold_reason),
      "hold_reason: required"
    );
  });

  it("所属: ready の期間重複を拒否する", () => {
    hasError(
      errorsAfter((d) => {
        const base = d.affiliation_entries[0];
        const ready = (from, to) => ({
          ...base,
          status: "ready",
          effective_from: from,
          effective_to: to,
          source_url: "https://example.com/x",
        });
        d.affiliation_entries.splice(0, 1, ready("2026-09-28", null), ready("2026-10-05", null));
      }),
      "overlapping ready periods"
    );
  });

  it("所属: ready の期間が member_term の在職期間の外なら拒否", () => {
    const ready = (e, from, to) => ({
      ...e,
      status: "ready",
      effective_from: from,
      effective_to: to,
      source_url: "https://example.com/x",
    });
    hasError(
      errorsAfter((d) => {
        d.affiliation_entries[0] = ready(d.affiliation_entries[0], "2026-09-27", null);
      }),
      "effective_from: outside the member term period"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_entries[0] = ready(d.affiliation_entries[0], "2026-09-28", "2030-09-28");
      }),
      "effective_to: outside the member term period"
    );
    // 在職期間内なら通る
    expect(
      errorsAfter((d) => {
        d.affiliation_entries[0] = ready(d.affiliation_entries[0], "2026-09-29", "2030-09-27");
      })
    ).toEqual([]);
  });

  it("source_discrepancies / holds は必須（省略できない）", () => {
    hasError(errorsAfter((d) => delete d.source_discrepancies), "source_discrepancies: must be an array");
    hasError(errorsAfter((d) => delete d.holds), "holds: must be an array");
  });

  it("所属: member_term が無い議員への所属は拒否", () => {
    hasError(
      errorsAfter((d) => {
        const retired = d.persons.find((p) => p.name === "石川 勇作").member_id;
        d.affiliation_entries[0].member_id = retired;
      }),
      "no member_term"
    );
  });
});

describe("splitAffiliationEntries", () => {
  it("ready だけが valid_from 付きの DB 行になり、hold は行にならない", () => {
    const doc = loadDoc();
    const base = doc.affiliation_entries[0];
    doc.affiliation_entries = [
      {
        ...base,
        status: "ready",
        effective_from: "2026-09-29",
        effective_to: null,
        source_url: "https://example.com/evidence",
      },
      doc.affiliation_entries[1],
    ];
    const { ready, hold } = splitAffiliationEntries(doc);
    expect(hold).toHaveLength(1);
    expect(ready).toEqual([
      {
        council_term_key: NEW_KEY,
        member_id: base.member_id,
        party: base.party,
        party_group: base.party_group,
        valid_from: "2026-09-29",
        valid_to: null,
        source_url: "https://example.com/evidence",
      },
    ]);
    // 観測日・結成日は valid_from に使われない
    expect(JSON.stringify(ready)).not.toContain(base.party_observed_on);
  });
});

describe("正本JSON v2: affiliation_snapshots（観測スナップショット）", () => {
  const doc = loadDoc();
  const idOf = (name) => doc.persons.find((p) => p.name === name).member_id;
  const hasError = (errors, fragment) =>
    expect(
      errors.some((e) => e.includes(fragment)),
      errors.join("\n")
    ).toBe(true);
  const snapshotOf = (d, name) =>
    d.affiliation_snapshots.find((s) => s.member_id === idOf(name));

  it("schema_version は v2 で、v1 は v2 として解釈されず拒否される", () => {
    expect(doc.schema_version).toBe("council-members/v2");
    hasError(
      errorsAfter((d) => {
        d.schema_version = "council-members/v1";
      }),
      "schema_version"
    );
  });

  it("affiliation_snapshots は 22 件で、現任期の member_terms の member 集合と一致する（順序は無関係）", () => {
    expect(doc.affiliation_snapshots).toHaveLength(22);
    const snapshotIds = new Set(doc.affiliation_snapshots.map((s) => s.member_id));
    const termIds = new Set(
      doc.member_terms
        .filter((t) => t.council_term_key === NEW_KEY)
        .map((t) => t.member_id)
    );
    expect(snapshotIds).toEqual(termIds);
    // 並び順を変えても検証は通る
    expect(
      errorsAfter((d) => d.affiliation_snapshots.reverse())
    ).toEqual([]);
  });

  it("初回 snapshot の observed_on は 2026-10-02（正本を確認した基準日。所属開始日ではない）", () => {
    for (const snapshot of doc.affiliation_snapshots) {
      expect(snapshot.observed_on).toBe("2026-10-02");
    }
  });

  it("所属履歴候補 affiliation_entries は従来どおり ready 0 / hold 22 のまま", () => {
    const { ready, hold } = splitAffiliationEntries(doc);
    expect(doc.affiliation_entries).toHaveLength(22);
    expect(ready).toHaveLength(0);
    expect(hold).toHaveLength(22);
  });

  it("snapshot の party / party_group は affiliation_entries の確定値をそのまま使っている（再解釈していない）", () => {
    for (const entry of doc.affiliation_entries) {
      const snapshot = doc.affiliation_snapshots.find(
        (s) => s.member_id === entry.member_id
      );
      expect(snapshot.party, entry.member_id).toBe(entry.party);
      expect(snapshot.party_group, entry.member_id).toBe(entry.party_group);
      expect(snapshot.party_observed_on).toBe(entry.party_observed_on);
    }
  });

  it("現任期の snapshot は party が全員 非NULL。明示的な無会派は3人、会派不明(null)は2人（null を無会派に変換していない）", () => {
    expect(doc.affiliation_snapshots.every((s) => s.party !== null)).toBe(true);
    const nameOf = (id) => doc.persons.find((p) => p.member_id === id).name;
    expect(
      doc.affiliation_snapshots
        .filter((s) => s.party_group === "無会派")
        .map((s) => nameOf(s.member_id))
        .sort()
    ).toEqual(["大浜 雅史", "大道 夏代", "田村 博孝"].sort());
    expect(
      doc.affiliation_snapshots
        .filter((s) => s.party_group === null)
        .map((s) => nameOf(s.member_id))
        .sort()
    ).toEqual(["後上里 厚司", "箕底 用一"].sort());
    for (const s of doc.affiliation_snapshots.filter((x) => x.party_group === null)) {
      expect(s.party_group_observed_on).toBeNull();
      expect(s.party_group_source_id).toBeNull();
    }
  });

  it("source discrepancy（井上美智子）は変わらず、snapshot は会派ページの値（日本共産党）を使う", () => {
    expect(doc.source_discrepancies).toHaveLength(1);
    expect(snapshotOf(doc, "井上 美智子")).toMatchObject({
      party: "日本共産党",
      party_group: "日本共産党",
    });
  });

  it("件数: ちょうど 22 件でなければ拒否（不足・過剰・重複）", () => {
    hasError(errorsAfter((d) => d.affiliation_snapshots.pop()), "expected 22 snapshots");
    hasError(errorsAfter((d) => d.affiliation_snapshots.pop()), "has no snapshot");
    hasError(
      errorsAfter((d) => d.affiliation_snapshots.push({ ...d.affiliation_snapshots[0] })),
      "duplicate snapshot"
    );
    hasError(
      errorsAfter((d) => d.affiliation_snapshots.push({ ...d.affiliation_snapshots[0] })),
      "expected 22 snapshots"
    );
  });

  it("未知の member / 未知の議会任期 / 現任期の member_term が無い人物の snapshot は拒否", () => {
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].member_id = "00000000-0000-4000-8000-000000000000";
      }),
      "unknown member_id"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].council_term_key = "2030-2034";
      }),
      "unknown council term"
    );
    // 退任者（新任期の member_term が無い）の snapshot
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].member_id = idOf("石川 勇作");
      }),
      "no member_term"
    );
  });

  it("未知のキー・キーの欠落は拒否（typo を黙って無視しない）", () => {
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party_grup = "typo";
      }),
      'unknown key "party_grup"'
    );
    hasError(
      errorsAfter((d) => {
        delete d.affiliation_snapshots[0].party_group;
      }),
      "party_group: required (use null for no value)"
    );
    hasError(
      errorsAfter((d) => {
        delete d.affiliation_snapshots[0].party_group_source_id;
      }),
      "party_group_source_id: required (use null for no value)"
    );
  });

  it("observed_on: 実在しない日付 / member_term 開始前 / 実効終了後 / 議会任期の外 は拒否", () => {
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].observed_on = "2026-13-45";
      }),
      "observed_on: must be a real YYYY-MM-DD date"
    );
    // 2026-09-27 は議会任期(2026-09-28〜)の外であり、member_term の開始前でもある
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].observed_on = "2026-09-27";
      }),
      "observed_on: outside council term"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].observed_on = "2026-09-27";
      }),
      "observed_on: outside the member term period"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].observed_on = "2030-09-28";
      }),
      "observed_on: outside council term"
    );
  });

  it("observed_on が member_term の実効終了日（end_date、無ければ議会任期の終了日）を過ぎている場合は拒否", () => {
    const errors = errorsAfter((d) => {
      const snapshot = d.affiliation_snapshots[0];
      const term = d.member_terms.find(
        (t) =>
          t.council_term_key === NEW_KEY && t.member_id === snapshot.member_id
      );
      term.end_date = "2026-10-01";
      snapshot.observed_on = "2026-10-02";
    });
    hasError(errors, "observed_on: outside the member term period");
    // 境界: 実効終了日と同じ日は許可される
    expect(
      errorsAfter((d) => {
        const snapshot = d.affiliation_snapshots[0];
        const term = d.member_terms.find(
          (t) =>
            t.council_term_key === NEW_KEY && t.member_id === snapshot.member_id
        );
        term.end_date = "2026-10-02";
      })
    ).toEqual([]);
  });

  it("補欠・途中就任の member_term より前の観測日は拒否（新里裕樹の旧任期の例）", () => {
    // 新里裕樹の旧任期（start 2025-08-17）に、就任前の observed_on の snapshot を足す
    const errors = errorsAfter((d) => {
      d.affiliation_snapshots.push({
        ...d.affiliation_snapshots[0],
        council_term_key: OLD_KEY,
        member_id: idOf("新里 裕樹"),
        observed_on: "2025-08-16",
        party_observed_on: "2025-08-16",
        party_group: null,
        party_group_observed_on: null,
        party_group_source_id: null,
      });
    });
    hasError(errors, "observed_on: outside the member term period");
  });

  it("party_observed_on / party_group_observed_on: observed_on より後、任期外、実在しない日付は拒否", () => {
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party_observed_on = "2026-10-03";
      }),
      "party_observed_on: must be on or before observed_on"
    );
    const withGroup = (d) =>
      d.affiliation_snapshots.find((s) => s.party_group_observed_on !== null);
    hasError(
      errorsAfter((d) => {
        withGroup(d).party_group_observed_on = "2026-10-03";
      }),
      "party_group_observed_on: must be on or before observed_on"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party_observed_on = "2026-09-27";
      }),
      "party_observed_on: outside council term"
    );
    hasError(
      errorsAfter((d) => {
        withGroup(d).party_group_observed_on = "2026-09-27";
      }),
      "party_group_observed_on: outside council term"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party_observed_on = "2026-02-30";
      }),
      "party_observed_on: must be a real YYYY-MM-DD date"
    );
  });

  it("出典 id: 未知 / 空文字 / 必須（値があるのに無い）は拒否", () => {
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party_source_id = "unknown-source";
      }),
      'unknown source id "unknown-source"'
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party_source_id = "";
      }),
      "party_source_id: required when party is set"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party_source_id = null;
      }),
      "party_source_id: required when party is set"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots.find((s) => s.party_group !== null).party_group_source_id = null;
      }),
      "party_group_source_id: required when party_group is set"
    );
  });

  it("出典 URL が https でない場合は拒否（source id を解決した URL を検証）", () => {
    const errors = errorsAfter((d) => {
      const sourceId = d.affiliation_snapshots[0].party_source_id;
      d.sources.find((s) => s.id === sourceId).url = "http://example.com/roster";
    });
    hasError(errors, "source URL must be https");
  });

  it("値があるのに基準日が無い（party / party_group）は拒否", () => {
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party_observed_on = null;
      }),
      "party_observed_on: must be a real YYYY-MM-DD date"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots.find((s) => s.party_group !== null).party_group_observed_on = null;
      }),
      "party_group_observed_on: must be a real YYYY-MM-DD date"
    );
  });

  it("値が null なのに基準日・出典 id が残っている場合は拒否", () => {
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party = null;
      }),
      "party_observed_on: must be null when party is null"
    );
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party = null;
      }),
      "party_source_id: must be null when party is null"
    );
    const nullGroup = (d) =>
      d.affiliation_snapshots.find((s) => s.party_group === null);
    hasError(
      errorsAfter((d) => {
        nullGroup(d).party_group_observed_on = "2026-09-29";
      }),
      "party_group_observed_on: must be null when party_group is null"
    );
    hasError(
      errorsAfter((d) => {
        nullGroup(d).party_group_source_id = "official-caucus-20260930";
      }),
      "party_group_source_id: must be null when party_group is null"
    );
  });

  it("party / party_group の空文字・空白だけ（全角空白を含む）は拒否", () => {
    for (const blank of ["", " ", "　", "\t\n"]) {
      hasError(
        errorsAfter((d) => {
          d.affiliation_snapshots[0].party = blank;
        }),
        "party: must be null or a non-blank string"
      );
      hasError(
        errorsAfter((d) => {
          d.affiliation_snapshots.find((s) => s.party_group !== null).party_group = blank;
        }),
        "party_group: must be null or a non-blank string"
      );
    }
  });

  it("同じ基準日の観測値が affiliation_entries と食い違う snapshot は拒否（確定値を再解釈しない）", () => {
    hasError(
      errorsAfter((d) => {
        d.affiliation_snapshots[0].party = "別の政党";
      }),
      "differs from affiliation_entries for the same party_observed_on"
    );
    hasError(
      errorsAfter((d) => {
        const target = d.affiliation_snapshots.find((s) => s.party_group === "自由民主石垣");
        target.party_group = "別の会派";
      }),
      "differs from affiliation_entries for the same party_group_observed_on"
    );
    // 会派不明(null)を「無会派」に変換することも、同じ観測(どちらも基準日 null)の食い違いとして拒否される
    hasError(
      errorsAfter((d) => {
        const target = d.affiliation_snapshots.find((s) => s.party_group === null);
        target.party_group = "無会派";
        target.party_group_observed_on = null;
        target.party_group_source_id = null;
      }),
      "party_group_source_id: required when party_group is set"
    );
  });

  it("出典 URL に空白を含む場合は拒否", () => {
    hasError(
      errorsAfter((d) => {
        d.sources[0].url = "https://example.com/a b";
      }),
      "must be an https URL"
    );
  });

  it("現任期の snapshot は party が null の行を許さない（Phase 3 の切替条件の前提）", () => {
    hasError(
      errorsAfter((d) => {
        const s = d.affiliation_snapshots[0];
        s.party = null;
        s.party_observed_on = null;
        s.party_source_id = null;
      }),
      "current term party must not be null"
    );
  });
});
