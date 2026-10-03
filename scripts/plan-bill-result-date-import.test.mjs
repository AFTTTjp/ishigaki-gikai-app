import { describe, expect, it } from "vitest";
import {
  normalizeBillNameForExactMatch,
  planBillResultDateImport,
  validateVoteResultsArtifact,
} from "./plan-bill-result-date-import.mjs";

function artifact(overrides = {}) {
  return {
    schema: "vote-results/review-v1",
    session: {
      slug: "session-1",
      name: "test",
      closed_on: "2099-06-30",
    },
    bills: [
      {
        bill_number: "議案第1号",
        bill_name: "テスト条例",
        result_date: "2099-06-24",
        confidence: "high",
        needs_review: false,
        source_ref: {
          source_kind: "official_html",
          url: "https://example.com/source",
          locator: "議案第1号 / 6月24日 / 可決",
        },
      },
    ],
    ...overrides,
  };
}

const dietSessions = [
  {
    id: "session-id-1",
    slug: "session-1",
    start_date: "2099-06-01",
    end_date: "2099-06-30",
  },
];

function bill(overrides = {}) {
  return {
    id: "bill-id-1",
    name: "議案第1号 テスト条例",
    diet_session_id: "session-id-1",
    document_type: "bill",
    result_date: null,
    ...overrides,
  };
}

describe("validateVoteResultsArtifact", () => {
  it("review済みの一次資料付きbillを受け入れる", () => {
    const result = validateVoteResultsArtifact(artifact());
    expect(result.session_slug).toBe("session-1");
    expect(result.targets).toEqual([
      expect.objectContaining({
        expected_db_name: "議案第1号 テスト条例",
        result_date: "2099-06-24",
      }),
    ]);
  });

  it("review未完了・invalid date・重複bill numberを拒否する", () => {
    const needsReview = artifact();
    needsReview.bills[0].needs_review = true;
    expect(() => validateVoteResultsArtifact(needsReview)).toThrow(
      "needs_review must be false"
    );

    const invalidDate = artifact();
    invalidDate.bills[0].result_date = "2099-02-30";
    expect(() => validateVoteResultsArtifact(invalidDate)).toThrow(
      "invalid result_date"
    );

    const duplicate = artifact();
    duplicate.bills.push({ ...duplicate.bills[0] });
    expect(() => validateVoteResultsArtifact(duplicate)).toThrow(
      "duplicate bill_number"
    );
  });
});

describe("normalizeBillNameForExactMatch", () => {
  it("角括弧の全角/半角だけを同一視する", () => {
    expect(
      normalizeBillNameForExactMatch(
        "議案第48号 財産の取得について［石垣市学習者用GIGA端末］"
      )
    ).toBe("議案第48号 財産の取得について[石垣市学習者用GIGA端末]");
  });

  it("空白や丸括弧など他の差異は正規化しない", () => {
    expect(
      normalizeBillNameForExactMatch("議案第1号  テスト（条例）")
    ).toBe("議案第1号  テスト（条例）");
  });
});

describe("planBillResultDateImport", () => {
  it("NULLのresult_dateだけupdate候補にする", () => {
    const plan = planBillResultDateImport({
      artifact: artifact(),
      dietSessions,
      bills: [bill()],
    });

    expect(plan).toEqual({
      updates: [
        expect.objectContaining({
          bill_id: "bill-id-1",
          result_date: "2099-06-24",
        }),
      ],
      alreadySet: [],
      unresolved: [],
    });
  });

  it("同じ日付が既に入っていればalreadySet", () => {
    const plan = planBillResultDateImport({
      artifact: artifact(),
      dietSessions,
      bills: [bill({ result_date: "2099-06-24" })],
    });

    expect(plan.updates).toHaveLength(0);
    expect(plan.alreadySet).toHaveLength(1);
    expect(plan.unresolved).toHaveLength(0);
  });

  it("角括弧の幅だけ違うDB名は限定正規化後の完全一致として解決する", () => {
    const doc = artifact();
    doc.bills[0].bill_name = "財産の取得について[テスト端末]";

    const plan = planBillResultDateImport({
      artifact: doc,
      dietSessions,
      bills: [
        bill({
          name: "議案第1号 財産の取得について［テスト端末］",
        }),
      ],
    });

    expect(plan.unresolved).toHaveLength(0);
    expect(plan.updates).toEqual([
      expect.objectContaining({
        match_mode: "exact_after_bracket_width_normalization",
      }),
    ]);
  });

  it("角括弧以外のタイトル違いはunresolved", () => {
    const plan = planBillResultDateImport({
      artifact: artifact(),
      dietSessions,
      bills: [bill({ name: "議案第1号 テスト条例（別名）" })],
    });

    expect(plan.unresolved).toEqual([
      expect.objectContaining({ reason: "bill_exact_match_not_found" }),
    ]);
  });

  it("既存の異なるresult_dateは上書きせずconflict", () => {
    const plan = planBillResultDateImport({
      artifact: artifact(),
      dietSessions,
      bills: [bill({ result_date: "2099-06-23" })],
    });

    expect(plan.updates).toHaveLength(0);
    expect(plan.unresolved).toEqual([
      expect.objectContaining({
        reason: "existing_result_date_conflict",
        db_result_date: "2099-06-23",
      }),
    ]);
  });

  it("会期外の日付はunresolved", () => {
    const doc = artifact();
    doc.bills[0].result_date = "2099-07-01";

    const plan = planBillResultDateImport({
      artifact: doc,
      dietSessions,
      bills: [bill()],
    });

    expect(plan.unresolved).toEqual([
      expect.objectContaining({ reason: "result_date_outside_session" }),
    ]);
  });

  it("対象sessionが無ければfail-closed", () => {
    const plan = planBillResultDateImport({
      artifact: artifact(),
      dietSessions: [],
      bills: [bill()],
    });

    expect(plan).toEqual({
      updates: [],
      alreadySet: [],
      unresolved: [
        {
          reason: "diet_session_not_found",
          session_slug: "session-1",
        },
      ],
    });
  });
});
