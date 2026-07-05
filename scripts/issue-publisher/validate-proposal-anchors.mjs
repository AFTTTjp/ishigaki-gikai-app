#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadUtteranceIndex, resolveAnchor } from "./resolve-anchor.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const REVIEW_ONLY_SOURCE_TYPES = new Set([
  "review_draft",
  "issue_review_packet",
  "issue_editorial_decisions",
  "session_editorial_map",
  "editorial_note",
  "issue_graph",
]);

const PUBLICATION_STATUSES = new Set([
  "not_published",
  "approved_for_export",
  "rejected",
]);

const CLAIM_TYPES = new Set(["attributed_speech", "fact"]);

const PROPOSAL_TYPES = new Set([
  "discussion_point",
  "timeline_event",
  "topic_update",
  "related_bill",
  "related_question",
  "bill_enrichment",
]);

const EVIDENCE_SOURCE_TYPES = new Set([
  "general_question_minutes",
  "official_minutes",
  "bill_text",
  "council_action",
  "review_draft",
  "issue_review_packet",
  "issue_editorial_decisions",
  "session_editorial_map",
  "editorial_note",
  "issue_graph",
]);

const EVIDENCE_ROLES = new Set(["primary", "secondary"]);
const EVIDENCE_MODES = new Set(["quote", "paraphrase"]);
const REVIEW_STATUSES = new Set(["pending", "approved", "edited", "rejected"]);
const EXPORT_READINESS = new Set([
  "not_ready",
  "ready_for_export",
  "blocked",
]);
const EXPORT_TARGETS = new Set([
  "topic_json",
  "bill_json",
  "general_question_json",
  "none",
]);
const CANDIDATE_V2_ROLES = new Set([
  "questioner",
  "executive",
  "chair",
  "unknown",
]);

function isCliEntry() {
  return path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDateTimeString(value) {
  return isNonEmptyString(value) && !Number.isNaN(new Date(value).getTime());
}

function isValidDateString(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateAnchorIdArray(value, fieldPath, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({
      code: "INVALID_CANDIDATE_V2_ANCHOR_IDS",
      message: `${fieldPath} must be a non-empty array of anchor ids`,
    });
    return false;
  }

  if (value.some((entry) => !isNonEmptyString(entry))) {
    errors.push({
      code: "INVALID_CANDIDATE_V2_ANCHOR_IDS",
      message: `${fieldPath} must contain only non-empty string anchor ids`,
    });
    return false;
  }

  return true;
}

function validateCandidateV2Shape(candidateV2) {
  const errors = [];

  if (
    !candidateV2 ||
    typeof candidateV2 !== "object" ||
    Array.isArray(candidateV2)
  ) {
    return [
      {
        code: "INVALID_CANDIDATE_V2_OBJECT",
        message: "proposal.candidate_v2 must be an object",
      },
    ];
  }

  const sourceScope = candidateV2.source_scope;
  if (!sourceScope || typeof sourceScope !== "object" || Array.isArray(sourceScope)) {
    errors.push({
      code: "INVALID_CANDIDATE_V2_SOURCE_SCOPE",
      message: "proposal.candidate_v2.source_scope must be an object",
    });
  } else {
    if (!isNonEmptyString(sourceScope.question_slug)) {
      errors.push({
        code: "INVALID_CANDIDATE_V2_SOURCE_SCOPE",
        message:
          "proposal.candidate_v2.source_scope.question_slug must be a non-empty string",
      });
    }

    if (!isValidDateString(sourceScope.question_date)) {
      errors.push({
        code: "INVALID_CANDIDATE_V2_SOURCE_SCOPE",
        message:
          "proposal.candidate_v2.source_scope.question_date must be a valid YYYY-MM-DD string",
      });
    }

    if (!Number.isInteger(sourceScope.item_number) || sourceScope.item_number < 1) {
      errors.push({
        code: "INVALID_CANDIDATE_V2_SOURCE_SCOPE",
        message:
          "proposal.candidate_v2.source_scope.item_number must be a positive integer",
      });
    }

    if (!isNonEmptyString(sourceScope.item_title)) {
      errors.push({
        code: "INVALID_CANDIDATE_V2_SOURCE_SCOPE",
        message:
          "proposal.candidate_v2.source_scope.item_title must be a non-empty string",
      });
    }
  }

  for (const fieldName of ["question", "city_answer"]) {
    const entry = candidateV2[fieldName];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push({
        code: "INVALID_CANDIDATE_V2_PART",
        message: `proposal.candidate_v2.${fieldName} must be an object`,
      });
      continue;
    }

    if (!isNonEmptyString(entry.summary)) {
      errors.push({
        code: "INVALID_CANDIDATE_V2_PART",
        message: `proposal.candidate_v2.${fieldName}.summary must be a non-empty string`,
      });
    }

    validateAnchorIdArray(
      entry.anchor_ids,
      `proposal.candidate_v2.${fieldName}.anchor_ids`,
      errors
    );

    if (
      !isNonEmptyString(entry.expected_speaker_role) ||
      !CANDIDATE_V2_ROLES.has(entry.expected_speaker_role)
    ) {
      errors.push({
        code: "INVALID_CANDIDATE_V2_ROLE",
        message: `proposal.candidate_v2.${fieldName}.expected_speaker_role must be one of: ${Array.from(
          CANDIDATE_V2_ROLES
        ).join(", ")}`,
      });
    }
  }

  if (!Array.isArray(candidateV2.confirmed_facts)) {
    errors.push({
      code: "INVALID_CANDIDATE_V2_CONFIRMED_FACTS",
      message: "proposal.candidate_v2.confirmed_facts must be an array",
    });
  } else {
    for (const [index, entry] of candidateV2.confirmed_facts.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push({
          code: "INVALID_CANDIDATE_V2_CONFIRMED_FACTS",
          message: `proposal.candidate_v2.confirmed_facts[${index}] must be an object`,
        });
        continue;
      }

      if (!isNonEmptyString(entry.statement)) {
        errors.push({
          code: "INVALID_CANDIDATE_V2_CONFIRMED_FACTS",
          message: `proposal.candidate_v2.confirmed_facts[${index}].statement must be a non-empty string`,
        });
      }
      validateAnchorIdArray(
        entry.anchor_ids,
        `proposal.candidate_v2.confirmed_facts[${index}].anchor_ids`,
        errors
      );
      if (!isNonEmptyString(entry.status)) {
        errors.push({
          code: "INVALID_CANDIDATE_V2_CONFIRMED_FACTS",
          message: `proposal.candidate_v2.confirmed_facts[${index}].status must be a non-empty string`,
        });
      }
      if (!isNonEmptyString(entry.public_use)) {
        errors.push({
          code: "INVALID_CANDIDATE_V2_CONFIRMED_FACTS",
          message: `proposal.candidate_v2.confirmed_facts[${index}].public_use must be a non-empty string`,
        });
      }
    }
  }

  if (!Array.isArray(candidateV2.unresolved_or_not_confirmed)) {
    errors.push({
      code: "INVALID_CANDIDATE_V2_UNRESOLVED",
      message:
        "proposal.candidate_v2.unresolved_or_not_confirmed must be an array",
    });
  } else {
    for (const [index, entry] of candidateV2.unresolved_or_not_confirmed.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push({
          code: "INVALID_CANDIDATE_V2_UNRESOLVED",
          message:
            `proposal.candidate_v2.unresolved_or_not_confirmed[${index}] must be an object`,
        });
        continue;
      }

      if (!isNonEmptyString(entry.statement)) {
        errors.push({
          code: "INVALID_CANDIDATE_V2_UNRESOLVED",
          message:
            `proposal.candidate_v2.unresolved_or_not_confirmed[${index}].statement must be a non-empty string`,
        });
      }
      if (!isNonEmptyString(entry.reason)) {
        errors.push({
          code: "INVALID_CANDIDATE_V2_UNRESOLVED",
          message:
            `proposal.candidate_v2.unresolved_or_not_confirmed[${index}].reason must be a non-empty string`,
        });
      }
      if (
        entry.anchor_ids !== undefined &&
        (!Array.isArray(entry.anchor_ids) ||
          entry.anchor_ids.some((value) => !isNonEmptyString(value)))
      ) {
        errors.push({
          code: "INVALID_CANDIDATE_V2_UNRESOLVED",
          message:
            `proposal.candidate_v2.unresolved_or_not_confirmed[${index}].anchor_ids must be an array of non-empty strings`,
        });
      }
    }
  }

  const reflection = candidateV2.recommended_reflection;
  if (!reflection || typeof reflection !== "object" || Array.isArray(reflection)) {
    errors.push({
      code: "INVALID_CANDIDATE_V2_RECOMMENDED_REFLECTION",
      message: "proposal.candidate_v2.recommended_reflection must be an object",
    });
  } else {
    for (const field of ["surface", "kind", "status_label", "safe_scope"]) {
      if (!isNonEmptyString(reflection[field])) {
        errors.push({
          code: "INVALID_CANDIDATE_V2_RECOMMENDED_REFLECTION",
          message:
            `proposal.candidate_v2.recommended_reflection.${field} must be a non-empty string`,
        });
      }
    }

    if (
      !reflection.target ||
      typeof reflection.target !== "object" ||
      Array.isArray(reflection.target)
    ) {
      errors.push({
        code: "INVALID_CANDIDATE_V2_RECOMMENDED_REFLECTION",
        message:
          "proposal.candidate_v2.recommended_reflection.target must be an object",
      });
    } else {
      for (const field of ["type", "slug"]) {
        if (!isNonEmptyString(reflection.target[field])) {
          errors.push({
            code: "INVALID_CANDIDATE_V2_RECOMMENDED_REFLECTION",
            message:
              `proposal.candidate_v2.recommended_reflection.target.${field} must be a non-empty string`,
          });
        }
      }
    }

    if (
      !Array.isArray(reflection.avoid) ||
      reflection.avoid.some((value) => !isNonEmptyString(value))
    ) {
      errors.push({
        code: "INVALID_CANDIDATE_V2_RECOMMENDED_REFLECTION",
        message:
          "proposal.candidate_v2.recommended_reflection.avoid must be an array of non-empty strings",
      });
    }
  }

  return errors;
}

function collectCandidateV2AnchorChecks(index, candidateV2) {
  const errors = [];
  const warnings = [];

  if (!candidateV2 || typeof candidateV2 !== "object" || Array.isArray(candidateV2)) {
    return { errors, warnings };
  }

  const anchorGroups = [
    {
      fieldPath: "proposal.candidate_v2.question",
      expectedRole: candidateV2.question?.expected_speaker_role ?? null,
      anchorIds: candidateV2.question?.anchor_ids ?? [],
    },
    {
      fieldPath: "proposal.candidate_v2.city_answer",
      expectedRole: candidateV2.city_answer?.expected_speaker_role ?? null,
      anchorIds: candidateV2.city_answer?.anchor_ids ?? [],
    },
  ];

  for (const [indexEntry, entry] of (candidateV2.confirmed_facts ?? []).entries()) {
    anchorGroups.push({
      fieldPath: `proposal.candidate_v2.confirmed_facts[${indexEntry}]`,
      expectedRole: null,
      anchorIds: entry?.anchor_ids ?? [],
    });
  }

  for (const [indexEntry, entry] of (
    candidateV2.unresolved_or_not_confirmed ?? []
  ).entries()) {
    anchorGroups.push({
      fieldPath: `proposal.candidate_v2.unresolved_or_not_confirmed[${indexEntry}]`,
      expectedRole: null,
      anchorIds: entry?.anchor_ids ?? [],
    });
  }

  for (const group of anchorGroups) {
    if (!Array.isArray(group.anchorIds)) {
      continue;
    }

    for (const anchorId of group.anchorIds) {
      if (!isNonEmptyString(anchorId)) {
        continue;
      }

      const resolved = resolveAnchor(index, anchorId);
      if (!resolved.ok) {
        errors.push({
          code: "CANDIDATE_V2_ANCHOR_NOT_FOUND",
          message: `${group.fieldPath}.anchor_ids includes an unresolved anchor: ${anchorId}`,
        });
        continue;
      }

      const actualRole = resolved.utterance?.speaker_role_hint ?? "unknown";
      if (
        group.expectedRole &&
        actualRole !== "unknown" &&
        actualRole !== group.expectedRole
      ) {
        warnings.push({
          code: "CANDIDATE_V2_ROLE_MISMATCH",
          message:
            `${group.fieldPath} expected speaker role ${group.expectedRole} but anchor ${anchorId} resolved to ${actualRole}`,
          anchor: anchorId,
          expected_role: group.expectedRole,
          actual_role: actualRole,
        });
      }
    }
  }

  return { errors, warnings };
}

function validateProposalSchemaShape(proposal) {
  const errors = [];

  if (proposal?.schema_version !== "issue-publisher-proposal.v0") {
    errors.push({
      code: "INVALID_SCHEMA_VERSION",
      message:
        "proposal.schema_version must be issue-publisher-proposal.v0",
    });
  }

  for (const field of [
    "proposal_id",
    "proposal_kind",
    "issue_id",
    "issue_title",
    "diet_session_slug",
  ]) {
    if (!isNonEmptyString(proposal?.[field])) {
      errors.push({
        code: "MISSING_REQUIRED_FIELD",
        message: `proposal.${field} must be a non-empty string`,
      });
    }
  }

  if (!PUBLICATION_STATUSES.has(proposal?.publication_status)) {
    errors.push({
      code: "INVALID_PUBLICATION_STATUS",
      message: `proposal.publication_status must be one of: ${Array.from(
        PUBLICATION_STATUSES
      ).join(", ")}`,
    });
  }

  if (!CLAIM_TYPES.has(proposal?.claim_type)) {
    errors.push({
      code: "INVALID_CLAIM_TYPE",
      message: `proposal.claim_type must be one of: ${Array.from(
        CLAIM_TYPES
      ).join(", ")}`,
    });
  }

  if (!PROPOSAL_TYPES.has(proposal?.proposal_type)) {
    errors.push({
      code: "INVALID_PROPOSAL_TYPE",
      message: `proposal.proposal_type must be one of: ${Array.from(
        PROPOSAL_TYPES
      ).join(", ")}`,
    });
  }

  if (
    !proposal?.public_draft ||
    typeof proposal.public_draft !== "object" ||
    Array.isArray(proposal.public_draft)
  ) {
    errors.push({
      code: "MISSING_PUBLIC_DRAFT",
      message: "proposal.public_draft must be an object",
    });
  } else {
    for (const field of ["summary_easy", "summary_detailed"]) {
      if (!isNonEmptyString(proposal.public_draft[field])) {
        errors.push({
          code: "MISSING_PUBLIC_DRAFT_FIELD",
          message: `proposal.public_draft.${field} must be a non-empty string`,
        });
      }
    }
  }

  if (!Array.isArray(proposal?.evidence) || proposal.evidence.length === 0) {
    errors.push({
      code: "MISSING_EVIDENCE",
      message: "proposal.evidence must contain at least one entry",
    });
  } else {
    for (const [index, entry] of proposal.evidence.entries()) {
      if (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry)
      ) {
        errors.push({
          code: "INVALID_EVIDENCE_ENTRY",
          message: `proposal.evidence[${index}] must be an object`,
        });
        continue;
      }

      if (!EVIDENCE_SOURCE_TYPES.has(entry.source_type)) {
        errors.push({
          code: "INVALID_EVIDENCE_SOURCE_TYPE",
          message: `proposal.evidence[${index}].source_type must be one of: ${Array.from(
            EVIDENCE_SOURCE_TYPES
          ).join(", ")}`,
        });
      }

      if (!isNonEmptyString(entry.anchor)) {
        errors.push({
          code: "MISSING_ANCHOR",
          message: `proposal.evidence[${index}].anchor must be a non-empty string`,
        });
      }

      if (!EVIDENCE_ROLES.has(entry.evidence_role)) {
        errors.push({
          code: "INVALID_EVIDENCE_ROLE",
          message: `proposal.evidence[${index}].evidence_role must be one of: ${Array.from(
            EVIDENCE_ROLES
          ).join(", ")}`,
        });
      }

      if (!EVIDENCE_MODES.has(entry.mode)) {
        errors.push({
          code: "INVALID_EVIDENCE_MODE",
          message: `proposal.evidence[${index}].mode must be one of: ${Array.from(
            EVIDENCE_MODES
          ).join(", ")}`,
        });
      }
    }
  }

  if (
    !proposal?.links ||
    typeof proposal.links !== "object" ||
    Array.isArray(proposal.links)
  ) {
    errors.push({
      code: "MISSING_LINKS",
      message: "proposal.links must be an object",
    });
  } else {
    for (const field of ["related_bill_ids", "related_question_slugs"]) {
      if (!Array.isArray(proposal.links[field])) {
        errors.push({
          code: "INVALID_LINKS_FIELD",
          message: `proposal.links.${field} must be an array`,
        });
      }
    }
  }

  if (
    !proposal?.review ||
    typeof proposal.review !== "object" ||
    Array.isArray(proposal.review)
  ) {
    errors.push({
      code: "MISSING_REVIEW",
      message: "proposal.review must be an object",
    });
  } else {
    if (!REVIEW_STATUSES.has(proposal.review.status)) {
      errors.push({
        code: "INVALID_REVIEW_STATUS",
        message: `proposal.review.status must be one of: ${Array.from(
          REVIEW_STATUSES
        ).join(", ")}`,
      });
    }

    if (typeof proposal.review.needs_human_review !== "boolean") {
      errors.push({
        code: "INVALID_REVIEW_NEEDS_HUMAN_REVIEW",
        message: "proposal.review.needs_human_review must be a boolean",
      });
    }

    if (!Array.isArray(proposal.review.review_reason)) {
      errors.push({
        code: "INVALID_REVIEW_REASON",
        message: "proposal.review.review_reason must be an array",
      });
    }

    if (
      proposal.review.reviewer !== undefined &&
      !isNonEmptyString(proposal.review.reviewer)
    ) {
      errors.push({
        code: "INVALID_REVIEWER",
        message: "proposal.review.reviewer must be a non-empty string",
      });
    }

    if (
      proposal.review.reviewed_at !== undefined &&
      !isValidDateTimeString(proposal.review.reviewed_at)
    ) {
      errors.push({
        code: "INVALID_REVIEWED_AT",
        message: "proposal.review.reviewed_at must be a valid date-time string",
      });
    }

    if (
      proposal.review.approval_note !== undefined &&
      !isNonEmptyString(proposal.review.approval_note)
    ) {
      errors.push({
        code: "INVALID_APPROVAL_NOTE",
        message: "proposal.review.approval_note must be a non-empty string",
      });
    }

    if (
      proposal.review.export_readiness !== undefined &&
      !EXPORT_READINESS.has(proposal.review.export_readiness)
    ) {
      errors.push({
        code: "INVALID_EXPORT_READINESS",
        message: `proposal.review.export_readiness must be one of: ${Array.from(
          EXPORT_READINESS
        ).join(", ")}`,
      });
    }

    if (
      proposal.review.export_blockers !== undefined &&
      (!Array.isArray(proposal.review.export_blockers) ||
        proposal.review.export_blockers.some(
          (value) => !isNonEmptyString(value)
        ))
    ) {
      errors.push({
        code: "INVALID_EXPORT_BLOCKERS",
        message:
          "proposal.review.export_blockers must be an array of non-empty strings",
      });
    }

    if (
      proposal.review.export_readiness === "ready_for_export" &&
      Array.isArray(proposal.review.export_blockers) &&
      proposal.review.export_blockers.length > 0
    ) {
      errors.push({
        code: "READY_EXPORT_HAS_BLOCKERS",
        message:
          "proposal.review.export_blockers must be empty when proposal.review.export_readiness=ready_for_export",
      });
    }
  }

  if (proposal.export !== undefined) {
    if (
      !proposal.export ||
      typeof proposal.export !== "object" ||
      Array.isArray(proposal.export)
    ) {
      errors.push({
        code: "INVALID_EXPORT_OBJECT",
        message: "proposal.export must be an object",
      });
    } else {
      if (!EXPORT_TARGETS.has(proposal.export.target)) {
        errors.push({
          code: "INVALID_EXPORT_TARGET",
          message: `proposal.export.target must be one of: ${Array.from(
            EXPORT_TARGETS
          ).join(", ")}`,
        });
      }

      for (const field of [
        "target_slug",
        "source_proposal_id",
        "exported_by",
        "notes",
      ]) {
        if (
          proposal.export[field] !== undefined &&
          !isNonEmptyString(proposal.export[field])
        ) {
          errors.push({
            code: "INVALID_EXPORT_FIELD",
            message: `proposal.export.${field} must be a non-empty string`,
          });
        }
      }

      if (
        proposal.export.exported_at !== undefined &&
        !isValidDateTimeString(proposal.export.exported_at)
      ) {
        errors.push({
          code: "INVALID_EXPORTED_AT",
          message: "proposal.export.exported_at must be a valid date-time string",
        });
      }
    }
  }

  const isApprovedState =
    proposal?.publication_status === "approved_for_export" ||
    proposal?.review?.status === "approved";

  if (isApprovedState) {
    if (!isNonEmptyString(proposal?.review?.reviewer)) {
      errors.push({
        code: "MISSING_APPROVAL_REVIEWER",
        message:
          "Approved proposals must include proposal.review.reviewer",
      });
    }

    if (!isValidDateTimeString(proposal?.review?.reviewed_at)) {
      errors.push({
        code: "MISSING_APPROVAL_REVIEWED_AT",
        message:
          "Approved proposals must include proposal.review.reviewed_at as a valid date-time string",
      });
    }

    if (!isNonEmptyString(proposal?.review?.approval_note)) {
      errors.push({
        code: "MISSING_APPROVAL_NOTE",
        message:
          "Approved proposals must include proposal.review.approval_note",
      });
    }

    if (!EXPORT_READINESS.has(proposal?.review?.export_readiness)) {
      errors.push({
        code: "MISSING_EXPORT_READINESS",
        message:
          "Approved proposals must include proposal.review.export_readiness",
      });
    }
  }

  if (proposal?.publication_status === "approved_for_export") {
    if (proposal?.review?.status !== "approved") {
      errors.push({
        code: "APPROVED_EXPORT_REQUIRES_REVIEW_APPROVED",
        message:
          "proposal.publication_status=approved_for_export requires proposal.review.status=approved",
      });
    }

    if (proposal?.review?.needs_human_review !== false) {
      errors.push({
        code: "APPROVED_EXPORT_REQUIRES_COMPLETED_HUMAN_REVIEW",
        message:
          "proposal.publication_status=approved_for_export requires proposal.review.needs_human_review=false",
      });
    }

    if (proposal?.review?.export_readiness !== "ready_for_export") {
      errors.push({
        code: "APPROVED_EXPORT_REQUIRES_READY_STATE",
        message:
          "proposal.publication_status=approved_for_export requires proposal.review.export_readiness=ready_for_export",
      });
    }
  }

  return errors;
}

function validateProposalAnchors(index, proposal) {
  const schemaErrors = validateProposalSchemaShape(proposal);
  const candidateV2Errors =
    proposal?.candidate_v2 !== undefined
      ? validateCandidateV2Shape(proposal.candidate_v2)
      : [];
  const errors = [...schemaErrors, ...candidateV2Errors];
  const warnings = [];
  const evidenceResults = [];

  const claimType = proposal.claim_type ?? "attributed_speech";
  const evidence = Array.isArray(proposal.evidence) ? proposal.evidence : null;

  let publishableEvidenceCount = 0;
  let transcriptEvidenceCount = 0;

  for (const entry of evidence ?? []) {
    if (!entry?.anchor) {
      evidenceResults.push({
        ok: false,
        anchor: null,
        error: {
          code: "MISSING_ANCHOR",
          message: "Evidence entry is missing anchor",
        },
      });
      continue;
    }

    if (entry.source_type && REVIEW_ONLY_SOURCE_TYPES.has(entry.source_type)) {
      errors.push({
        code: "REVIEW_ONLY_SOURCE",
        message: `Review-only source_type cannot be publishable evidence: ${entry.source_type}`,
      });
      evidenceResults.push({
        ok: false,
        anchor: entry.anchor,
        error: {
          code: "REVIEW_ONLY_SOURCE",
          message: `Review-only source_type cannot be publishable evidence: ${entry.source_type}`,
        },
      });
      continue;
    }

    const resolved = resolveAnchor(index, entry.anchor);
    evidenceResults.push(resolved);

    if (!resolved.ok) {
      errors.push(resolved.error);
      continue;
    }

    if (resolved.utterance.source_type === "general_question_minutes") {
      publishableEvidenceCount += 1;
      transcriptEvidenceCount += 1;
    }
  }

  if (publishableEvidenceCount === 0) {
    errors.push({
      code: "NO_PUBLISHABLE_EVIDENCE",
      message: "At least one publishable evidence anchor is required",
    });
  }

  if (claimType === "fact" && transcriptEvidenceCount > 0) {
    errors.push({
      code: "FACT_CLAIM_REQUIRES_OFFICIAL_EVIDENCE",
      message:
        "Transcript evidence can support attributed_speech but not fact claims by itself",
    });
  }

  const candidateV2AnchorChecks =
    proposal?.candidate_v2 !== undefined
      ? collectCandidateV2AnchorChecks(index, proposal.candidate_v2)
      : { errors: [], warnings: [] };

  errors.push(...candidateV2AnchorChecks.errors);
  warnings.push(...candidateV2AnchorChecks.warnings);

  return {
    ok: errors.length === 0,
    schema_ok: schemaErrors.length === 0,
    claim_type: claimType,
    publishable_evidence_count: publishableEvidenceCount,
    transcript_evidence_count: transcriptEvidenceCount,
    evidence_results: evidenceResults,
    errors,
    warnings,
  };
}

function main() {
  const [, , indexPathArg, proposalPathArg] = process.argv;
  if (!indexPathArg || !proposalPathArg) {
    console.error(
      "Usage: node scripts/issue-publisher/validate-proposal-anchors.mjs <index-json> <proposal-json>"
    );
    process.exitCode = 1;
    return;
  }

  const index = loadUtteranceIndex(resolve(indexPathArg));
  const proposal = loadJson(resolve(proposalPathArg));
  const result = validateProposalAnchors(index, proposal);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

if (isCliEntry()) {
  main();
}

export { REVIEW_ONLY_SOURCE_TYPES, validateProposalAnchors };
