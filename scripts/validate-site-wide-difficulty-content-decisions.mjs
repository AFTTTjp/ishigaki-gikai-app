#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";

const DEFAULT_FILE = "docs/difficulty-content-decisions/r8-dai4-site-wide-difficulty-content-decisions.json";
const PUBLIC_CONTENT_FIELDS = ["proposed_normal_description", "proposed_detailed_description", "proposed_content_hard", "proposed_normal", "proposed_hard"];
const SOURCE_ID_PATTERNS = [/source[_ -]?id/i, /utterance[_ -]?id/i, /reviewer/i, /candidate[_ -]?id/i, /decision[_ -]?id/i];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function flattenDecisions(decisions) {
  return [
    ...decisions.topics,
    ...decisions.general_questions,
    ...decisions.bills_missing_content,
    ...decisions.bills_identical_content_quality,
  ];
}

function getPublicStrings(decision) {
  const values = [];
  for (const field of PUBLIC_CONTENT_FIELDS) {
    const value = decision[field];
    if (typeof value === "string") values.push([field, value]);
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        if (typeof nested === "string") values.push([field + "." + key, nested]);
      }
    }
  }
  return values;
}

export function validateDifficultyContentDecisions(artifact) {
  const errors = [];
  const warnings = [];
  if (artifact.schema_version !== "site-wide-difficulty-content-decisions.v1") {
    errors.push("Unexpected schema_version");
  }
  if (artifact.review_status !== "reviewer_only") {
    errors.push("Artifact must remain reviewer_only");
  }
  const { summary, decisions } = artifact;
  const flat = flattenDecisions(decisions);
  const ids = new Set();
  for (const decision of flat) {
    if (ids.has(decision.decision_id)) {
      errors.push("Duplicate decision_id: " + decision.decision_id);
    }
    ids.add(decision.decision_id);
    for (const [field, value] of getPublicStrings(decision)) {
      for (const pattern of SOURCE_ID_PATTERNS) {
        if (pattern.test(value)) {
          errors.push("Public candidate field " + decision.decision_id + "." + field + " contains meta/source-id text");
        }
      }
    }
    if (decision.quality_checks?.unsupported_inference) {
      errors.push("Unsupported inference flagged: " + decision.decision_id);
    }
    if (decision.quality_checks?.answer_content_contamination) {
      errors.push("Answer-content contamination flagged: " + decision.decision_id);
    }
  }
  if (decisions.topics.length !== 2) errors.push("Topics target must be 2");
  if (decisions.general_questions.length !== 87) errors.push("General Questions target must be 87");
  if (decisions.bills_missing_content.length !== 6) errors.push("Bills missing-content target must be 6");
  if (decisions.bills_identical_content_quality.length !== 6) errors.push("Bills identical-content target must be 6");
  const gqCompletedOverlap = decisions.general_questions.filter((decision) => decision.existing_completed_overlap).length;
  if (gqCompletedOverlap !== 0) errors.push("Existing completed GQ overlap must be 0");
  const approveTotal = flat.filter((decision) => decision.decision?.startsWith("approve")).length;
  const holdTotal = flat.filter((decision) => decision.decision?.startsWith("hold")).length;
  const rejectTotal = flat.filter((decision) => decision.decision?.startsWith("reject")).length;
  if (approveTotal !== summary.approve_total) errors.push("approve_total mismatch");
  if (holdTotal !== summary.hold_total) errors.push("hold_total mismatch");
  if (rejectTotal !== summary.reject_total) errors.push("reject_total mismatch");
  for (const decision of flat.filter((entry) => entry.decision?.startsWith("approve"))) {
    const hasAnyProposal = getPublicStrings(decision).some(([, value]) => hasText(value));
    if (!hasAnyProposal) errors.push("Approved decision has no proposed content: " + decision.decision_id);
  }
  for (const decision of flat.filter((entry) => entry.decision?.startsWith("hold"))) {
    if (!hasText(decision.hold_reason) && !hasText(decision.revision_recommendation) && !hasText(decision.reviewer_note)) {
      warnings.push("Hold decision should explain reason: " + decision.decision_id);
    }
  }
  return {
    errors,
    warnings,
    stats: {
      topics_reviewed: decisions.topics.length,
      general_questions_reviewed: decisions.general_questions.length,
      bills_missing_reviewed: decisions.bills_missing_content.length,
      bills_identical_reviewed: decisions.bills_identical_content_quality.length,
      approve_total: approveTotal,
      hold_total: holdTotal,
      reject_total: rejectTotal,
    },
  };
}

if (process.argv[1]?.endsWith("validate-site-wide-difficulty-content-decisions.mjs")) {
  const file = process.argv[2] ?? DEFAULT_FILE;
  const artifact = JSON.parse(fs.readFileSync(file, "utf8"));
  const result = validateDifficultyContentDecisions(artifact);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.errors.length > 0 ? 1 : 0);
}
