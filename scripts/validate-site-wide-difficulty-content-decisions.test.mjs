import { describe, expect, it } from "vitest";
import { validateDifficultyContentDecisions } from "./validate-site-wide-difficulty-content-decisions.mjs";

function baseArtifact() {
  const topic = {
    decision_id: "topic-1",
    decision: "approve_with_revision",
    proposed_content_hard: "詳しい説明",
    quality_checks: { unsupported_inference: false },
  };
  const gq = Array.from({ length: 87 }, (_, index) => ({
    decision_id: "gq-" + index,
    decision: "hold_insufficient_source",
    existing_completed_overlap: false,
    hold_reason: "source hold",
    quality_checks: { unsupported_inference: false },
  }));
  const missing = Array.from({ length: 6 }, (_, index) => ({
    decision_id: "missing-" + index,
    decision: "hold_insufficient_source",
    reviewer_note: "source hold",
    quality_checks: { unsupported_inference: false },
  }));
  const identical = Array.from({ length: 6 }, (_, index) => ({
    decision_id: "identical-" + index,
    decision: "hold_insufficient_source",
    revision_recommendation: "source hold",
    quality_checks: { unsupported_inference: false },
  }));
  return {
    schema_version: "site-wide-difficulty-content-decisions.v1",
    review_status: "reviewer_only",
    summary: { approve_total: 2, hold_total: 99, reject_total: 0 },
    decisions: {
      topics: [topic, { ...topic, decision_id: "topic-2" }],
      general_questions: gq,
      bills_missing_content: missing,
      bills_identical_content_quality: identical,
    },
  };
}

describe("validateDifficultyContentDecisions", () => {
  it("accepts the expected target counts", () => {
    const result = validateDifficultyContentDecisions(baseArtifact());
    expect(result.errors).toEqual([]);
    expect(result.stats).toMatchObject({
      topics_reviewed: 2,
      general_questions_reviewed: 87,
      bills_missing_reviewed: 6,
      bills_identical_reviewed: 6,
    });
  });

  it("blocks duplicate decision IDs", () => {
    const artifact = baseArtifact();
    artifact.decisions.topics[1].decision_id = "topic-1";
    const result = validateDifficultyContentDecisions(artifact);
    expect(result.errors.some((error) => error.includes("Duplicate decision_id"))).toBe(true);
  });

  it("blocks source IDs in proposed public content", () => {
    const artifact = baseArtifact();
    artifact.decisions.topics[0].proposed_content_hard = "source_id を表示しない";
    const result = validateDifficultyContentDecisions(artifact);
    expect(result.errors.some((error) => error.includes("meta/source-id"))).toBe(true);
  });
});
