import { describe, expect, it } from "vitest";
import {
  PRODUCTION_SUPABASE_HOST,
  validateBackfillExecutionPlan,
} from "./member-term-vote-backfill-execution.mjs";

const url = `https://${PRODUCTION_SUPABASE_HOST}`;

function plan(updates = 308, alreadySet = 0, unresolved = []) {
  return {
    updates: Array.from({ length: updates }, () => ({})),
    alreadySet: Array.from({ length: alreadySet }, () => ({})),
    unresolved,
  };
}

describe("validateBackfillExecutionPlan", () => {
  it("reviewed 308 votes with unresolved 0 passes", () => {
    expect(
      validateBackfillExecutionPlan({
        supabaseUrl: url,
        voteCount: 308,
        plan: plan(),
        expectedTotal: 308,
      })
    ).toEqual([]);
  });

  it("partial rerun is allowed when total remains 308", () => {
    expect(
      validateBackfillExecutionPlan({
        supabaseUrl: url,
        voteCount: 308,
        plan: plan(100, 208),
        expectedTotal: 308,
      })
    ).toEqual([]);
  });

  it("blocks a different Supabase project", () => {
    expect(
      validateBackfillExecutionPlan({
        supabaseUrl: "https://wrong.supabase.co",
        voteCount: 308,
        plan: plan(),
        expectedTotal: 308,
      })
    ).toContainEqual(expect.stringContaining("Production host mismatch"));
  });

  it("blocks unresolved or changed vote counts", () => {
    const errors = validateBackfillExecutionPlan({
      supabaseUrl: url,
      voteCount: 309,
      plan: plan(308, 0, [{ reason: "x" }]),
      expectedTotal: 308,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("vote count changed"),
        expect.stringContaining("unresolved must be 0"),
      ])
    );
  });
});
