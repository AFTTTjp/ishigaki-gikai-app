import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { adminClient, getAnonClient } from "../utils";

/**
 * member_affiliation_snapshots の制約・権限・append-only 方針を検証する。
 * 実データと衝突しないよう、任期は 2800 年代の架空の日付を使う。
 * snapshot 単体には DELETE 権限が無いため、後始末は親の member_terms を削除して
 * ON DELETE CASCADE で行う。
 */

let yearCounter = 2800;

const created = {
  memberIds: [] as string[],
  councilTermIds: [] as string[],
};

async function createMemberTerm() {
  const year = yearCounter++;
  const { data: councilTerm, error: councilError } = await adminClient
    .from("council_terms")
    .insert({ start_date: `${year}-01-01`, end_date: `${year}-12-31` })
    .select()
    .single();
  if (councilError || !councilTerm)
    throw new Error(`council_term 作成失敗: ${councilError?.message}`);
  created.councilTermIds.push(councilTerm.id);

  const { data: member, error: memberError } = await adminClient
    .from("members")
    .insert({ id: randomUUID(), name: "スナップショット検証議員" })
    .select()
    .single();
  if (memberError || !member)
    throw new Error(`member 作成失敗: ${memberError?.message}`);
  created.memberIds.push(member.id);

  const { data: memberTerm, error: termError } = await adminClient
    .from("member_terms")
    .insert({
      council_term_id: councilTerm.id,
      member_id: member.id,
      start_date: `${year}-01-01`,
    })
    .select()
    .single();
  if (termError || !memberTerm)
    throw new Error(`member_term 作成失敗: ${termError?.message}`);
  return memberTerm;
}

const validSnapshot = (memberTermId: string, observedOn = "2800-10-02") => ({
  member_term_id: memberTermId,
  party: "無所属",
  party_group: "テスト会派",
  party_observed_on: "2800-09-30",
  party_group_observed_on: "2800-09-29",
  party_source_url: "https://example.com/roster",
  party_group_source_url: "https://example.com/caucus",
  observed_on: observedOn,
});

afterEach(async () => {
  // snapshot は member_terms の削除で CASCADE 削除される
  for (const memberId of created.memberIds) {
    await adminClient.from("member_terms").delete().eq("member_id", memberId);
  }
  for (const termId of created.councilTermIds) {
    await adminClient.from("council_terms").delete().eq("id", termId);
  }
  for (const memberId of created.memberIds) {
    await adminClient.from("members").delete().eq("id", memberId);
  }
  created.memberIds = [];
  created.councilTermIds = [];
});

describe("member_affiliation_snapshots: 作成と制約", () => {
  it("政党・会派・各資料の基準日・出典URLつきで作成できる", async () => {
    const term = await createMemberTerm();
    const { data, error } = await adminClient
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(term.id))
      .select()
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      party: "無所属",
      party_group: "テスト会派",
      party_observed_on: "2800-09-30",
      party_group_observed_on: "2800-09-29",
      observed_on: "2800-10-02",
    });
  });

  it("party_group が NULL（会派不明）でも作成できる", async () => {
    const term = await createMemberTerm();
    const { error } = await adminClient
      .from("member_affiliation_snapshots")
      .insert({
        ...validSnapshot(term.id),
        party_group: null,
        party_group_observed_on: null,
        party_group_source_url: null,
      });
    expect(error).toBeNull();
  });

  it("party が NULL でも、根拠を持たない行として作成できる", async () => {
    const term = await createMemberTerm();
    const { error } = await adminClient
      .from("member_affiliation_snapshots")
      .insert({
        member_term_id: term.id,
        observed_on: "2800-10-02",
      });
    expect(error).toBeNull();
  });

  it("存在しない member_term_id は FK 違反になる", async () => {
    const { error } = await adminClient
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(randomUUID()));
    expect(error?.code).toBe("23503");
  });

  it("同じ (member_term_id, observed_on) は重複できない", async () => {
    const term = await createMemberTerm();
    await adminClient
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(term.id));
    const { error } = await adminClient
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(term.id));
    expect(error?.code).toBe("23505");
  });

  it("同じ member_term に、別の observed_on の snapshot を複数追加できる", async () => {
    const term = await createMemberTerm();
    const { error } = await adminClient
      .from("member_affiliation_snapshots")
      .insert([
        validSnapshot(term.id, "2800-10-02"),
        {
          ...validSnapshot(term.id, "2801-04-01"),
          party_group: "別の会派",
        },
      ]);
    expect(error).toBeNull();

    const { data } = await adminClient
      .from("member_affiliation_snapshots")
      .select("observed_on, party_group")
      .eq("member_term_id", term.id)
      .order("observed_on", { ascending: false });
    expect(data?.map((row) => row.observed_on)).toEqual([
      "2801-04-01",
      "2800-10-02",
    ]);
    expect(data?.[0].party_group).toBe("別の会派");
  });

  it("party / party_group の空文字・空白だけは CHECK 違反になる", async () => {
    const term = await createMemberTerm();
    for (const override of [
      { party: "" },
      { party: "   " },
      { party_group: "" },
      { party_group: "  " },
    ]) {
      const { error } = await adminClient
        .from("member_affiliation_snapshots")
        .insert({ ...validSnapshot(term.id), ...override });
      expect(error?.code, JSON.stringify(override)).toBe("23514");
    }
  });

  it("party があるのに基準日または出典URLが無い場合は CHECK 違反になる", async () => {
    const term = await createMemberTerm();
    for (const override of [
      { party_observed_on: null },
      { party_source_url: null },
    ]) {
      const { error } = await adminClient
        .from("member_affiliation_snapshots")
        .insert({ ...validSnapshot(term.id), ...override });
      expect(error?.code, JSON.stringify(override)).toBe("23514");
    }
  });

  it("party_group があるのに基準日または出典URLが無い場合は CHECK 違反になる", async () => {
    const term = await createMemberTerm();
    for (const override of [
      { party_group_observed_on: null },
      { party_group_source_url: null },
    ]) {
      const { error } = await adminClient
        .from("member_affiliation_snapshots")
        .insert({ ...validSnapshot(term.id), ...override });
      expect(error?.code, JSON.stringify(override)).toBe("23514");
    }
  });

  it("observed_on が各資料の基準日より前の場合は CHECK 違反になる", async () => {
    const term = await createMemberTerm();
    const { error } = await adminClient
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(term.id, "2800-09-29"));
    expect(error?.code).toBe("23514");
  });
});

describe("member_affiliation_snapshots: 削除の挙動", () => {
  it("親の member_term を削除すると snapshot も削除される（後始末の経路）", async () => {
    const term = await createMemberTerm();
    await adminClient
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(term.id));
    const { error } = await adminClient
      .from("member_terms")
      .delete()
      .eq("id", term.id);
    expect(error).toBeNull();
    const { data } = await adminClient
      .from("member_affiliation_snapshots")
      .select("id")
      .eq("member_term_id", term.id);
    expect(data).toEqual([]);
  });
});

describe("member_affiliation_snapshots: RLS / 権限（append-only）", () => {
  it("service_role は SELECT / INSERT できる", async () => {
    const term = await createMemberTerm();
    const insert = await adminClient
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(term.id));
    expect(insert.error).toBeNull();
    const select = await adminClient
      .from("member_affiliation_snapshots")
      .select("id")
      .eq("member_term_id", term.id);
    expect(select.error).toBeNull();
    expect(select.data).toHaveLength(1);
  });

  it("service_role でも UPDATE / DELETE は権限エラーになり、行は変わらない", async () => {
    const term = await createMemberTerm();
    await adminClient
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(term.id));

    const update = await adminClient
      .from("member_affiliation_snapshots")
      .update({ party: "書き換え" })
      .eq("member_term_id", term.id);
    expect(update.error?.code).toBe("42501");

    const remove = await adminClient
      .from("member_affiliation_snapshots")
      .delete()
      .eq("member_term_id", term.id);
    expect(remove.error?.code).toBe("42501");

    const { data } = await adminClient
      .from("member_affiliation_snapshots")
      .select("party")
      .eq("member_term_id", term.id)
      .single();
    expect(data?.party).toBe("無所属");
  });

  it("anon からは SELECT も INSERT もできない（データがあっても読めない）", async () => {
    const term = await createMemberTerm();
    await adminClient
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(term.id));

    const anon = getAnonClient();
    const { data } = await anon
      .from("member_affiliation_snapshots")
      .select("*");
    expect(data ?? []).toEqual([]);

    const insert = await anon
      .from("member_affiliation_snapshots")
      .insert(validSnapshot(term.id, "2800-11-01"));
    expect(insert.error).not.toBeNull();
  });
});
