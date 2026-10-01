import { describe, expect, it } from "vitest";
import {
  planMemberTermVoteBackfill,
  UNRESOLVED_REASONS,
} from "./plan-member-term-vote-backfill.mjs";

const base = {
  councilTerms: [
    { id: "ct-old", end_date: "2026-09-27" },
    { id: "ct-new", end_date: "2030-09-27" },
  ],
  dietSessions: [
    { id: "s-r8-3", start_date: "2026-02-23", end_date: "2026-03-09" },
    { id: "s-border", start_date: "2025-08-01", end_date: "2025-08-30" },
    { id: "s-after", start_date: "2026-12-01", end_date: "2026-12-20" },
  ],
  bills: [
    { id: "b1", diet_session_id: "s-r8-3" },
    { id: "b-nosession", diet_session_id: null },
    { id: "b-missing-session", diet_session_id: "s-unknown" },
    { id: "b-border", diet_session_id: "s-border" },
    { id: "b-after", diet_session_id: "s-after" },
  ],
  memberTerms: [
    { id: "mt-a-old", member_id: "A", council_term_id: "ct-old", start_date: "2022-09-28", end_date: null },
    { id: "mt-a-new", member_id: "A", council_term_id: "ct-new", start_date: "2026-09-28", end_date: null },
    // 途中就任（2025-08-17）: 会期 2025-08-01〜08-30 は境界を跨ぐ
    { id: "mt-b-old", member_id: "B", council_term_id: "ct-old", start_date: "2025-08-17", end_date: null },
  ],
};

const vote = (bill_id, member_id, member_term_id = null) => ({
  bill_id,
  member_id,
  member_term_id,
});

const plan = (votes) => planMemberTermVoteBackfill({ ...base, votes });

describe("planMemberTermVoteBackfill", () => {
  it("会期全体が1つの member_term に収まる票は更新候補になる", () => {
    const result = plan([vote("b1", "A")]);
    expect(result.updates).toEqual([
      { bill_id: "b1", member_id: "A", member_term_id: "mt-a-old" },
    ]);
    expect(result.unresolved).toEqual([]);
  });

  it("任期が複数ある議員でも、会期の日付で正しい任期に解決される", () => {
    const result = plan([vote("b-after", "A")]);
    expect(result.updates[0].member_term_id).toBe("mt-a-new");
  });

  it("既に正しい member_term_id が入っている票は alreadySet", () => {
    const result = plan([vote("b1", "A", "mt-a-old")]);
    expect(result.alreadySet).toHaveLength(1);
    expect(result.updates).toHaveLength(0);
  });

  it("既存の member_term_id が計画と違う票は上書きせず unresolved", () => {
    const result = plan([vote("b1", "A", "mt-a-new")]);
    expect(result.unresolved[0].reason).toBe(UNRESOLVED_REASONS.existingMismatch);
    expect(result.updates).toHaveLength(0);
  });

  it("bill が無い / diet_session_id が無い / 会期が無い票は unresolved", () => {
    const result = plan([
      vote("b-unknown", "A"),
      vote("b-nosession", "A"),
      vote("b-missing-session", "A"),
    ]);
    expect(result.unresolved.map((u) => u.reason)).toEqual([
      UNRESOLVED_REASONS.billNotFound,
      UNRESOLVED_REASONS.noDietSession,
      UNRESOLVED_REASONS.dietSessionNotFound,
    ]);
    expect(result.updates).toHaveLength(0);
  });

  it("該当する member_term が 0 件なら unresolved（任期外の会期 / member_term 未登録）", () => {
    const result = plan([vote("b-after", "B"), vote("b1", "UNKNOWN")]);
    expect(result.unresolved.map((u) => u.reason)).toEqual([
      UNRESOLVED_REASONS.noMemberTerm,
      UNRESOLVED_REASONS.noMemberTerm,
    ]);
  });

  it("会期が member_term の境界を跨ぐ票は unresolved", () => {
    const result = plan([vote("b-border", "B")]);
    expect(result.unresolved[0].reason).toBe(UNRESOLVED_REASONS.spansBoundary);
  });

  it("複数の member_term が会期と重なる場合は unresolved（どれか選ばない）", () => {
    const result = planMemberTermVoteBackfill({
      ...base,
      dietSessions: [{ id: "s-wide", start_date: "2026-09-01", end_date: "2026-10-31" }],
      bills: [{ id: "b-wide", diet_session_id: "s-wide" }],
      votes: [vote("b-wide", "A")],
    });
    expect(result.unresolved[0].reason).toBe(UNRESOLVED_REASONS.multipleMemberTerms);
    expect(result.updates).toHaveLength(0);
  });

  it("入力を変更しない", () => {
    const votes = [vote("b1", "A")];
    const snapshot = JSON.stringify(votes);
    plan(votes);
    expect(JSON.stringify(votes)).toBe(snapshot);
  });
});
