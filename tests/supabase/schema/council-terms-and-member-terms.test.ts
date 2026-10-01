import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  adminClient,
  cleanupTestBill,
  createTestBill,
  getAnonClient,
} from "../utils";

/**
 * council_terms / member_terms / member_affiliations と
 * bill_member_votes.member_term_id の制約・権限を検証する。
 * 実データと衝突しないよう、任期は 2900 年代の架空の日付を使う。
 */

let yearCounter = 2900;
function nextTermDates() {
  const year = yearCounter++;
  return { start_date: `${year}-01-01`, end_date: `${year}-12-31` };
}

const created = {
  billIds: [] as string[],
  memberIds: [] as string[],
  councilTermIds: [] as string[],
};

async function createCouncilTerm() {
  const { data, error } = await adminClient
    .from("council_terms")
    .insert(nextTermDates())
    .select()
    .single();
  if (error || !data)
    throw new Error(`council_term 作成失敗: ${error?.message}`);
  created.councilTermIds.push(data.id);
  return data;
}

async function createMember(name = "テスト議員") {
  const { data, error } = await adminClient
    .from("members")
    .insert({ id: randomUUID(), name })
    .select()
    .single();
  if (error || !data) throw new Error(`member 作成失敗: ${error?.message}`);
  created.memberIds.push(data.id);
  return data;
}

async function createMemberTerm(councilTermId: string, memberId: string) {
  const { data, error } = await adminClient
    .from("member_terms")
    .insert({
      council_term_id: councilTermId,
      member_id: memberId,
      start_date: "2900-01-01",
    })
    .select()
    .single();
  if (error || !data)
    throw new Error(`member_term 作成失敗: ${error?.message}`);
  return data;
}

async function createBill() {
  const bill = await createTestBill();
  created.billIds.push(bill.id);
  return bill;
}

afterEach(async () => {
  // FK の依存順（票 → 議員任期 → 会議任期・議員）に削除する
  for (const billId of created.billIds) {
    await adminClient.from("bill_member_votes").delete().eq("bill_id", billId);
    await cleanupTestBill(billId);
  }
  for (const memberId of created.memberIds) {
    await adminClient.from("member_terms").delete().eq("member_id", memberId);
  }
  for (const termId of created.councilTermIds) {
    await adminClient.from("council_terms").delete().eq("id", termId);
  }
  for (const memberId of created.memberIds) {
    await adminClient.from("members").delete().eq("id", memberId);
  }
  created.billIds = [];
  created.memberIds = [];
  created.councilTermIds = [];
});

describe("council_terms", () => {
  it("start_date <= end_date なら作成できる（同日も可）", async () => {
    const { error } = await adminClient
      .from("council_terms")
      .insert({ start_date: "2990-05-05", end_date: "2990-05-05" });
    expect(error).toBeNull();
    await adminClient
      .from("council_terms")
      .delete()
      .eq("start_date", "2990-05-05");
  });

  it("start_date > end_date は CHECK 違反になる", async () => {
    const { error } = await adminClient
      .from("council_terms")
      .insert({ start_date: "2991-01-02", end_date: "2991-01-01" });
    expect(error?.code).toBe("23514");
  });

  it("同じ start_date の任期は重複できない", async () => {
    const term = await createCouncilTerm();
    const { error } = await adminClient
      .from("council_terms")
      .insert({ start_date: term.start_date, end_date: "2999-12-31" });
    expect(error?.code).toBe("23505");
  });
});

describe("member_terms", () => {
  it("members / council_terms に紐づく行を作成できる（seat・当選回数は NULL 可）", async () => {
    const term = await createCouncilTerm();
    const member = await createMember();
    const memberTerm = await createMemberTerm(term.id, member.id);
    expect(memberTerm.seat_number).toBeNull();
    expect(memberTerm.election_count).toBeNull();
    expect(memberTerm.end_date).toBeNull();
  });

  it("同一人物・同一議会任期の重複は拒否される", async () => {
    const term = await createCouncilTerm();
    const member = await createMember();
    await createMemberTerm(term.id, member.id);
    const { error } = await adminClient.from("member_terms").insert({
      council_term_id: term.id,
      member_id: member.id,
      start_date: "2900-01-01",
    });
    expect(error?.code).toBe("23505");
  });

  it("同一人物でも別の議会任期なら作成できる（再選）", async () => {
    const term1 = await createCouncilTerm();
    const term2 = await createCouncilTerm();
    const member = await createMember();
    await createMemberTerm(term1.id, member.id);
    const { error } = await adminClient.from("member_terms").insert({
      council_term_id: term2.id,
      member_id: member.id,
      start_date: "2901-01-01",
    });
    expect(error).toBeNull();
  });

  it("存在しない member_id / council_term_id は FK 違反になる", async () => {
    const term = await createCouncilTerm();
    const member = await createMember();

    const badMember = await adminClient.from("member_terms").insert({
      council_term_id: term.id,
      member_id: randomUUID(),
      start_date: "2900-01-01",
    });
    expect(badMember.error?.code).toBe("23503");

    const badTerm = await adminClient.from("member_terms").insert({
      council_term_id: randomUUID(),
      member_id: member.id,
      start_date: "2900-01-01",
    });
    expect(badTerm.error?.code).toBe("23503");
  });

  it("seat_number / election_count が 1 未満、end_date < start_date は CHECK 違反", async () => {
    const term = await createCouncilTerm();
    const member = await createMember();
    const base = {
      council_term_id: term.id,
      member_id: member.id,
      start_date: "2900-06-01",
    };

    const seat = await adminClient
      .from("member_terms")
      .insert({ ...base, seat_number: 0 });
    expect(seat.error?.code).toBe("23514");

    const count = await adminClient
      .from("member_terms")
      .insert({ ...base, election_count: 0 });
    expect(count.error?.code).toBe("23514");

    const range = await adminClient
      .from("member_terms")
      .insert({ ...base, end_date: "2900-05-31" });
    expect(range.error?.code).toBe("23514");
  });

  it("member_terms を持つ members は削除できない（退任者を守る）", async () => {
    const term = await createCouncilTerm();
    const member = await createMember();
    await createMemberTerm(term.id, member.id);
    const { error } = await adminClient
      .from("members")
      .delete()
      .eq("id", member.id);
    expect(error?.code).toBe("23503");
  });
});

describe("member_affiliations", () => {
  async function createAffiliationTarget() {
    const term = await createCouncilTerm();
    const member = await createMember();
    return createMemberTerm(term.id, member.id);
  }

  it("valid_from <= valid_to（または valid_to が NULL）なら作成できる", async () => {
    const memberTerm = await createAffiliationTarget();
    const { error } = await adminClient.from("member_affiliations").insert([
      {
        member_term_id: memberTerm.id,
        party: "無所属",
        party_group: "テスト会派A",
        valid_from: "2900-01-01",
        valid_to: "2900-06-30",
      },
      {
        member_term_id: memberTerm.id,
        party: "無所属",
        party_group: "テスト会派B",
        valid_from: "2900-07-01",
      },
    ]);
    expect(error).toBeNull();
  });

  it("valid_from > valid_to は CHECK 違反になる", async () => {
    const memberTerm = await createAffiliationTarget();
    const { error } = await adminClient.from("member_affiliations").insert({
      member_term_id: memberTerm.id,
      valid_from: "2900-02-01",
      valid_to: "2900-01-31",
    });
    expect(error?.code).toBe("23514");
  });

  it("同じ member_term_id と valid_from の重複は拒否される", async () => {
    const memberTerm = await createAffiliationTarget();
    const row = { member_term_id: memberTerm.id, valid_from: "2900-01-01" };
    await adminClient.from("member_affiliations").insert(row);
    const { error } = await adminClient.from("member_affiliations").insert(row);
    expect(error?.code).toBe("23505");
  });

  it("member_term を削除すると所属履歴も一緒に削除される", async () => {
    const memberTerm = await createAffiliationTarget();
    await adminClient.from("member_affiliations").insert({
      member_term_id: memberTerm.id,
      valid_from: "2900-01-01",
    });
    await adminClient.from("member_terms").delete().eq("id", memberTerm.id);
    const { data } = await adminClient
      .from("member_affiliations")
      .select("id")
      .eq("member_term_id", memberTerm.id);
    expect(data).toEqual([]);
  });
});

describe("bill_member_votes.member_term_id", () => {
  async function insertVote(
    billId: string,
    memberId: string,
    memberTermId?: string | null
  ) {
    return adminClient.from("bill_member_votes").insert({
      bill_id: billId,
      member_id: memberId,
      seat_number: 1,
      vote_type: "for",
      ...(memberTermId === undefined ? {} : { member_term_id: memberTermId }),
    });
  }

  it("member_term_id なし（既存行と同じ形）で票を作成でき、NULL になる", async () => {
    const bill = await createBill();
    const member = await createMember();
    const { error } = await insertVote(bill.id, member.id);
    expect(error).toBeNull();

    const { data } = await adminClient
      .from("bill_member_votes")
      .select("member_term_id")
      .eq("bill_id", bill.id)
      .single();
    expect(data?.member_term_id).toBeNull();
  });

  it("member_id と member_term の人物が一致すれば作成できる", async () => {
    const bill = await createBill();
    const term = await createCouncilTerm();
    const member = await createMember();
    const memberTerm = await createMemberTerm(term.id, member.id);

    const { error } = await insertVote(bill.id, member.id, memberTerm.id);
    expect(error).toBeNull();
  });

  it("別人物の member_term_id を指定する INSERT は FK 違反になる", async () => {
    const bill = await createBill();
    const term = await createCouncilTerm();
    const memberA = await createMember("議員A");
    const memberB = await createMember("議員B");
    const termOfB = await createMemberTerm(term.id, memberB.id);

    const { error } = await insertVote(bill.id, memberA.id, termOfB.id);
    expect(error?.code).toBe("23503");
  });

  it("別人物の member_term_id に変更する UPDATE は FK 違反になる", async () => {
    const bill = await createBill();
    const term = await createCouncilTerm();
    const memberA = await createMember("議員A");
    const memberB = await createMember("議員B");
    const termOfA = await createMemberTerm(term.id, memberA.id);
    const termOfB = await createMemberTerm(term.id, memberB.id);
    await insertVote(bill.id, memberA.id, termOfA.id);

    const { error } = await adminClient
      .from("bill_member_votes")
      .update({ member_term_id: termOfB.id })
      .eq("bill_id", bill.id)
      .eq("member_id", memberA.id);
    expect(error?.code).toBe("23503");
  });

  it("member_id の変更で member_term_id と食い違う UPDATE も FK 違反になる", async () => {
    const bill = await createBill();
    const term = await createCouncilTerm();
    const memberA = await createMember("議員A");
    const memberB = await createMember("議員B");
    const termOfA = await createMemberTerm(term.id, memberA.id);
    await insertVote(bill.id, memberA.id, termOfA.id);

    const { error } = await adminClient
      .from("bill_member_votes")
      .update({ member_id: memberB.id })
      .eq("bill_id", bill.id)
      .eq("member_id", memberA.id);
    expect(error?.code).toBe("23503");
  });

  it("票から参照されている member_term は削除できない", async () => {
    const bill = await createBill();
    const term = await createCouncilTerm();
    const member = await createMember();
    const memberTerm = await createMemberTerm(term.id, member.id);
    await insertVote(bill.id, member.id, memberTerm.id);

    const { error } = await adminClient
      .from("member_terms")
      .delete()
      .eq("id", memberTerm.id);
    expect(error?.code).toBe("23503");
  });

  it("採決表示と同じ形の取得（members JOIN）が従来どおり動く", async () => {
    const bill = await createBill();
    const member = await createMember("取得確認議員");
    await insertVote(bill.id, member.id);

    const { data, error } = await adminClient
      .from("bill_member_votes")
      .select(
        "member_id, seat_number, vote_type, source_label, source_url, members!inner(id, name, party, party_group)"
      )
      .eq("bill_id", bill.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("既存 members の公開取得", () => {
  it("anon クライアントから members を従来どおり SELECT できる", async () => {
    const member = await createMember("公開取得確認議員");
    const { data, error } = await getAnonClient()
      .from("members")
      .select("id, name, party, party_group, election_count")
      .eq("id", member.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("新規3テーブルの RLS / 権限", () => {
  const tables = [
    "council_terms",
    "member_terms",
    "member_affiliations",
  ] as const;

  it("service_role から SELECT できる", async () => {
    for (const table of tables) {
      const { error } = await adminClient.from(table).select("id").limit(1);
      expect(error, table).toBeNull();
    }
  });

  it("anon から中身が読めない（データがあっても空かエラー）", async () => {
    const term = await createCouncilTerm();
    const member = await createMember();
    const memberTerm = await createMemberTerm(term.id, member.id);
    await adminClient.from("member_affiliations").insert({
      member_term_id: memberTerm.id,
      valid_from: "2900-01-01",
    });

    const anon = getAnonClient();
    for (const table of tables) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("anon から INSERT / UPDATE / DELETE できない", async () => {
    const term = await createCouncilTerm();
    const anon = getAnonClient();

    const insert = await anon
      .from("council_terms")
      .insert({ start_date: "2992-01-01", end_date: "2992-12-31" });
    expect(insert.error).not.toBeNull();

    await anon
      .from("council_terms")
      .update({ end_date: "2999-12-31" })
      .eq("id", term.id);
    await anon.from("council_terms").delete().eq("id", term.id);

    const { data } = await adminClient
      .from("council_terms")
      .select("end_date")
      .eq("id", term.id)
      .single();
    expect(data?.end_date).toBe(term.end_date);
  });
});
