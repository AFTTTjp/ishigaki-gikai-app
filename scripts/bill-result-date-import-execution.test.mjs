import { describe, expect, it } from "vitest";
import {
  PRODUCTION_SUPABASE_HOST,
  validateBillResultDateExecutionPlan,
} from "./bill-result-date-import-execution.mjs";

const url = `https://${PRODUCTION_SUPABASE_HOST}`;

function artifact({
  count = 17,
  session = "ishigaki-r8-dai4-teireikai",
  resultDate = "2026-06-24",
} = {}) {
  return {
    session: { slug: session },
    bills: Array.from({ length: count }, () => ({
      result_date: resultDate,
    })),
  };
}

function plan({ updates = 17, alreadySet = 0, unresolved = [] } = {}) {
  const make = (count, offset = 0) =>
    Array.from({ length: count }, (_, index) => {
      const itemIndex = offset + index;
      return {
        bill_id: `bill-${itemIndex}`,
        bill_name: `議案第${itemIndex + 1}号 テスト`,
        result_date: "2026-06-24",
        match_mode:
          itemIndex < 4
            ? "exact_after_bracket_width_normalization"
            : "exact",
      };
    });

  return {
    updates: make(updates),
    alreadySet: make(alreadySet, updates),
    unresolved,
  };
}

const baseArgs = {
  supabaseUrl: url,
  artifact: artifact(),
  plan: plan(),
  expectedTotal: 17,
  expectedSession: "ishigaki-r8-dai4-teireikai",
  expectedResultDate: "2026-06-24",
};

describe("validateBillResultDateExecutionPlan", () => {
  it("reviewed 17 bills with unresolved 0 passes", () => {
    expect(validateBillResultDateExecutionPlan(baseArgs)).toEqual([]);
  });

  it("partial rerun is allowed when total remains 17", () => {
    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        plan: plan({ updates: 5, alreadySet: 12 }),
      })
    ).toEqual([]);
  });

  it("blocks a different Supabase project", () => {
    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        supabaseUrl: "https://wrong.supabase.co",
      })
    ).toContainEqual(expect.stringContaining("Production host mismatch"));
  });

  it("blocks changed session, count, date, or unresolved rows", () => {
    const errors = validateBillResultDateExecutionPlan({
      ...baseArgs,
      artifact: artifact({
        count: 16,
        session: "wrong-session",
        resultDate: "2026-06-23",
      }),
      plan: plan({ updates: 16, unresolved: [{ reason: "x" }] }),
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("session changed"),
        expect.stringContaining("artifact bill count changed"),
        expect.stringContaining("artifact result_date changed"),
        expect.stringContaining("unresolved must be 0"),
        expect.stringContaining("resolved total changed"),
      ])
    );
  });

  it("blocks duplicate bill ids in the resolved plan", () => {
    const changedPlan = plan();
    changedPlan.updates[1].bill_id = changedPlan.updates[0].bill_id;

    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        plan: changedPlan,
      })
    ).toContainEqual(expect.stringContaining("bill_id values must be unique"));
  });

  it("blocks a future unreviewed match mode", () => {
    const changedPlan = plan();
    changedPlan.updates[0].match_mode = "fuzzy";

    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        plan: changedPlan,
      })
    ).toContainEqual(expect.stringContaining("unexpected match_mode"));
  });

  it("blocks a planned date outside the reviewed date", () => {
    const changedPlan = plan();
    changedPlan.updates[0].result_date = "2026-06-23";

    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        plan: changedPlan,
      })
    ).toContainEqual(expect.stringContaining("planned result_date changed"));
  });
});
