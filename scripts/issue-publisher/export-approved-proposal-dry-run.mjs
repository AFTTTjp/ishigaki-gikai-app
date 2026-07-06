#!/usr/bin/env node

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path, { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadUtteranceIndex, resolveAnchor } from "./resolve-anchor.mjs";
import { validateProposalAnchors } from "./validate-proposal-anchors.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const DEFAULT_INDEX_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/utterance-index/r8-dai4-teireikai.utterances.json"
);
const TOPICS_DIR = resolve(ROOT, "docs/ishigaki_gikai_topics_dev_set");
const GENERAL_QUESTIONS_DIR = resolve(ROOT, "docs/general_questions");

function isCliEntry() {
  return path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function toRepoRelative(filePath) {
  return relative(ROOT, filePath).replaceAll(path.sep, "/");
}

function parseArgs(argv) {
  const args = {
    proposalPath: null,
    outPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--proposal" && next) {
      args.proposalPath = resolve(next);
      index += 1;
      continue;
    }

    if (current === "--out" && next) {
      args.outPath = resolve(next);
      index += 1;
    }
  }

  return args;
}

function buildTopicIndex() {
  const topicFiles = readdirSync(TOPICS_DIR)
    .filter((fileName) => fileName.endsWith(".topic.json"))
    .sort();

  return topicFiles.map((fileName) => {
    const filePath = resolve(TOPICS_DIR, fileName);
    const topic = loadJson(filePath);
    return {
      filePath,
      topic,
    };
  });
}

function loadGeneralQuestionsFile(dietSessionSlug) {
  const exactFilePath = resolve(
    GENERAL_QUESTIONS_DIR,
    `${dietSessionSlug}.general-questions.json`
  );

  try {
    return {
      filePath: exactFilePath,
      data: loadJson(exactFilePath),
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const candidateFiles = readdirSync(GENERAL_QUESTIONS_DIR)
    .filter((fileName) => fileName.endsWith(".general-questions.json"))
    .sort();

  const matches = [];

  for (const fileName of candidateFiles) {
    const filePath = resolve(GENERAL_QUESTIONS_DIR, fileName);
    const data = loadJson(filePath);
    if (data?.diet_session_slug === dietSessionSlug) {
      matches.push({
        filePath,
        data,
      });
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    const matchFiles = matches.map(({ filePath }) => toRepoRelative(filePath));
    throw new Error(
      `Multiple general questions JSON files found for diet_session_slug=${dietSessionSlug}: ${matchFiles.join(", ")}`
    );
  }

  throw new Error(
    `General questions JSON not found for diet_session_slug=${dietSessionSlug}`
  );
}

function createBlock(code, message, reviewerAction) {
  return {
    code,
    message,
    reviewer_action: reviewerAction,
  };
}

function createBlockedResolution({
  surface,
  targetId,
  targetFile,
  resolvedBy,
  resolutionNote,
}) {
  return {
    status: "blocked",
    surface,
    surface_label: surface === "general_question" ? "General Question" : surface === "topic" ? "Topic" : "Unresolved",
    target_id: targetId,
    target_file: targetFile,
    target_label: null,
    target_title: null,
    resolved_by: resolvedBy,
    resolution_note: resolutionNote,
  };
}

function summarizeRole(role) {
  return role ?? "unknown";
}

function buildAnchorRoleSummary(index, proposal) {
  const summary = {
    proposal_evidence: [],
    candidate_v2: null,
  };

  for (const entry of proposal.evidence ?? []) {
    const resolved = resolveAnchor(index, entry.anchor);
    summary.proposal_evidence.push({
      anchor: entry.anchor,
      source_type: entry.source_type,
      resolved: resolved.ok,
      speaker_role_hint: resolved.ok
        ? summarizeRole(resolved.utterance.speaker_role_hint)
        : null,
      speech_kind: resolved.ok ? resolved.utterance.speech_kind ?? null : null,
      question_slug: resolved.ok ? resolved.utterance.question_slug ?? null : null,
      item_number_candidate: resolved.ok
        ? resolved.utterance.item_number_candidate ?? null
        : null,
      item_title_candidate: resolved.ok
        ? resolved.utterance.item_title_candidate ?? null
        : null,
    });
  }

  if (!proposal.candidate_v2) {
    return summary;
  }

  function summarizeGroup(anchorIds, expectedRole) {
    const anchors = [];

    for (const anchorId of anchorIds ?? []) {
      const resolved = resolveAnchor(index, anchorId);
      anchors.push({
        anchor: anchorId,
        resolved: resolved.ok,
        expected_speaker_role: expectedRole,
        actual_speaker_role: resolved.ok
          ? summarizeRole(resolved.utterance.speaker_role_hint)
          : null,
        speech_kind: resolved.ok ? resolved.utterance.speech_kind ?? null : null,
        question_slug: resolved.ok ? resolved.utterance.question_slug ?? null : null,
        item_number_candidate: resolved.ok
          ? resolved.utterance.item_number_candidate ?? null
          : null,
        item_title_candidate: resolved.ok
          ? resolved.utterance.item_title_candidate ?? null
          : null,
        role_match:
          resolved.ok &&
          resolved.utterance.speaker_role_hint !== "unknown" &&
          expectedRole
            ? resolved.utterance.speaker_role_hint === expectedRole
            : null,
      });
    }

    return anchors;
  }

  summary.candidate_v2 = {
    source_scope: proposal.candidate_v2.source_scope,
    question: summarizeGroup(
      proposal.candidate_v2.question?.anchor_ids,
      proposal.candidate_v2.question?.expected_speaker_role ?? null
    ),
    city_answer: summarizeGroup(
      proposal.candidate_v2.city_answer?.anchor_ids,
      proposal.candidate_v2.city_answer?.expected_speaker_role ?? null
    ),
    confirmed_facts: (proposal.candidate_v2.confirmed_facts ?? []).map((entry) => ({
      statement: entry.statement,
      anchors: summarizeGroup(entry.anchor_ids, null),
    })),
    unresolved_or_not_confirmed: (
      proposal.candidate_v2.unresolved_or_not_confirmed ?? []
    ).map((entry) => ({
      statement: entry.statement,
      reason: entry.reason,
      anchors: summarizeGroup(entry.anchor_ids ?? [], null),
    })),
  };

  return summary;
}

function resolveTarget(proposal) {
  const blocks = [];
  const exportTarget = proposal.export?.target;
  const targetSlug = proposal.export?.target_slug;

  if (!exportTarget || exportTarget === "none") {
    blocks.push(
      createBlock(
        "MISSING_EXPLICIT_EXPORT_TARGET",
        "Dry-run export requires proposal.export.target and exact target metadata. No public target is inferred from proposal links.",
        "Set proposal.export.target and an exact proposal.export.target_slug before rerunning the dry-run export."
      )
    );
    return {
      targetResolution: createBlockedResolution({
        surface: "unresolved",
        targetId: null,
        targetFile: null,
        resolvedBy: "blocked_no_explicit_target",
        resolutionNote:
          "Dry-run export stopped before any public write because no exact export target was provided.",
      }),
      blocks,
    };
  }

  if (!targetSlug || typeof targetSlug !== "string" || targetSlug.trim() === "") {
    blocks.push(
      createBlock(
        "MISSING_EXPLICIT_TARGET_SLUG",
        "Dry-run export requires proposal.export.target_slug for exact target resolution.",
        "Add proposal.export.target_slug with the exact public target slug, then rerun the dry-run export."
      )
    );
    return {
      targetResolution: createBlockedResolution({
        surface: "unresolved",
        targetId: null,
        targetFile: null,
        resolvedBy: "blocked_missing_target_slug",
        resolutionNote:
          "Dry-run export stopped before any public write because the exact target slug is missing.",
      }),
      blocks,
    };
  }

  if (exportTarget === "topic_json") {
    const matches = buildTopicIndex().filter(
      ({ topic }) => topic.topic_slug === targetSlug
    );

    if (matches.length !== 1) {
      blocks.push(
        createBlock(
          "TOPIC_TARGET_NOT_FOUND",
          `Exact topic target not found for proposal.export.target_slug=${targetSlug}.`,
          "Check proposal.export.target_slug against docs/ishigaki_gikai_topics_dev_set/*.topic.json and rerun the dry-run export."
        )
      );
      return {
        targetResolution: createBlockedResolution({
          surface: "topic",
          targetId: targetSlug,
          targetFile: null,
          resolvedBy: "blocked_target_not_found",
          resolutionNote:
            "The proposal named a topic target, but no exact topic slug match was found in the public topic JSON set.",
        }),
        blocks,
      };
    }

    return {
      targetResolution: {
        status: "resolved",
        surface: "topic",
        surface_label: "Topic",
        target_id: matches[0].topic.topic_slug,
        target_file: toRepoRelative(matches[0].filePath),
        target_label: matches[0].topic.topic_title,
        target_title: matches[0].topic.topic_title,
        resolved_by: "explicit_proposal_field",
        resolution_note:
          "Exact topic target resolved from proposal.export.target and proposal.export.target_slug.",
      },
      blocks,
    };
  }

  if (exportTarget === "general_question_json") {
    const { filePath, data } = loadGeneralQuestionsFile(proposal.diet_session_slug);
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const match = questions.find((question) => question.slug === targetSlug);

    if (!match) {
      blocks.push(
        createBlock(
          "GENERAL_QUESTION_TARGET_NOT_FOUND",
          `Exact general question target not found for proposal.export.target_slug=${targetSlug}.`,
          "Check proposal.export.target_slug against docs/general_questions/*.general-questions.json and rerun the dry-run export."
        )
      );
      return {
        targetResolution: createBlockedResolution({
          surface: "general_question",
          targetId: targetSlug,
          targetFile: toRepoRelative(filePath),
          resolvedBy: "blocked_target_not_found",
          resolutionNote:
            "The proposal named a general question target, but no exact question slug match was found in the public general question JSON.",
        }),
        blocks,
      };
    }

    const targetLabel = `${match.member_name_raw} 一般質問`;
    return {
      targetResolution: {
        status: "resolved",
        surface: "general_question",
        surface_label: "General Question",
        target_id: match.slug,
        target_file: toRepoRelative(filePath),
        target_label: targetLabel,
        target_title: targetLabel,
        resolved_by: "explicit_proposal_field",
        resolution_note:
          "Exact general question target resolved from proposal.export.target and proposal.export.target_slug.",
      },
      blocks,
    };
  }

  if (exportTarget === "bill_json") {
    blocks.push(
      createBlock(
        "BILL_JSON_TARGET_UNAVAILABLE",
        "The repo does not contain a public bill JSON target that can be resolved by exact file/slug matching. Bill dry-run export remains blocked.",
        "Do not infer a bill target. Keep this proposal blocked until an exact public bill JSON target exists in the repo."
      )
    );
    return {
      targetResolution: createBlockedResolution({
        surface: "bill",
        targetId: targetSlug,
        targetFile: null,
        resolvedBy: "blocked_unsupported_surface",
        resolutionNote:
          "Bill export stays fail-closed because the repo does not yet have an exact public bill JSON target to resolve against.",
      }),
      blocks,
    };
  }

  blocks.push(
    createBlock(
      "UNSUPPORTED_EXPORT_TARGET",
      `Unsupported proposal.export.target=${exportTarget}.`,
      "Use a supported exact export target or keep the proposal blocked until a supported surface is defined."
    )
  );
  return {
    targetResolution: createBlockedResolution({
      surface: "unresolved",
      targetId: targetSlug,
      targetFile: null,
      resolvedBy: "blocked_unsupported_surface",
      resolutionNote:
        "Dry-run export stopped before any public write because the requested export surface is not supported.",
    }),
    blocks,
  };
}

function buildWouldWrite(proposal, targetResolution) {
  if (targetResolution.status !== "resolved") {
    return [];
  }

  return [
    {
      operation: "review_candidate_only",
      target_file: targetResolution.target_file,
      target_field: "review_only_not_public_json",
      content_preview: {
        surface: targetResolution.surface,
        surface_label: targetResolution.surface_label,
        target_id: targetResolution.target_id,
        target_label: targetResolution.target_label,
        source_proposal_id: proposal.proposal_id,
        proposal_type: proposal.proposal_type,
        claim_type: proposal.claim_type,
        issue_id: proposal.issue_id,
        issue_title: proposal.issue_title,
        summary_easy: proposal.public_draft.summary_easy,
        summary_detailed: proposal.public_draft.summary_detailed,
        related_question_slugs: proposal.links.related_question_slugs,
        related_bill_ids: proposal.links.related_bill_ids,
      },
    },
  ];
}

function buildEvidenceSummary(index, proposal) {
  const anchors = [];

  for (const entry of proposal.evidence) {
    const resolved = resolveAnchor(index, entry.anchor);
    if (!resolved.ok) {
      anchors.push({
        anchor: entry.anchor,
        source_type: entry.source_type,
        resolved: false,
        error_code: resolved.error.code,
      });
      continue;
    }

    anchors.push({
      anchor: entry.anchor,
      source_type: entry.source_type,
      evidence_role: entry.evidence_role,
      mode: entry.mode,
      resolved: true,
      resolved_by: resolved.resolved_by,
      utterance_id: resolved.utterance.utterance_id,
      question_slug: resolved.source_locator.question_slug,
      line_start: resolved.source_locator.line_start,
      line_end: resolved.source_locator.line_end,
      source_minutes_file: resolved.source_locator.source_minutes_file,
      speaker_hint: resolved.utterance.speaker_hint ?? null,
      speaker_role_hint: resolved.utterance.speaker_role_hint ?? null,
      speech_kind: resolved.utterance.speech_kind ?? null,
      item_number_candidate: resolved.utterance.item_number_candidate ?? null,
      item_title_candidate: resolved.utterance.item_title_candidate ?? null,
    });
  }

  return {
    anchors,
    claims: [
      {
        claim_type: proposal.claim_type,
        proposal_type: proposal.proposal_type,
        summary_easy: proposal.public_draft.summary_easy,
        summary_detailed: proposal.public_draft.summary_detailed,
      },
    ],
  };
}

function buildStructuredCandidateV2(proposal) {
  if (!proposal.candidate_v2) {
    return null;
  }

  return proposal.candidate_v2;
}

function buildApprovalState(proposal) {
  return {
    is_approved:
      proposal.review?.status === "approved" &&
      proposal.publication_status === "approved_for_export",
    review_status: proposal.review?.status ?? null,
    publication_status: proposal.publication_status,
    export_readiness: proposal.review?.export_readiness ?? null,
    needs_human_review: proposal.review?.needs_human_review ?? null,
    reviewer: proposal.review?.reviewer ?? null,
    reviewed_at: proposal.review?.reviewed_at ?? null,
    approval_note: proposal.review?.approval_note ?? null,
    export_blockers: Array.isArray(proposal.review?.export_blockers)
      ? proposal.review.export_blockers
      : [],
  };
}

function buildApplicationStatus() {
  return {
    applied: false,
    public_json_written: false,
    db_written: false,
    revalidation_needed: false,
    note: "Review-only dry-run. No public source-of-truth JSON was modified.",
  };
}

function buildReviewerGuidance(targetResolution, blocks) {
  if (targetResolution.status === "resolved") {
    return {
      ready_for_editor_review: true,
      next_step:
        "Compare content_preview, approval metadata, and evidence_summary before any manual public JSON editing in a later phase.",
      note: "Resolved dry-run artifacts are still review-only and must not be treated as applied public content.",
    };
  }

  return {
    ready_for_editor_review: false,
    next_step:
      blocks[0]?.reviewer_action ??
      "Resolve the blocking issue before considering any manual public JSON editing.",
    note: "Blocked dry-run artifacts stop before any public write and should remain unapplied until all blockers are resolved.",
  };
}

function buildCandidateV2ReviewWarnings(validationWarnings) {
  const warnings = [];

  for (const entry of validationWarnings ?? []) {
    if (entry?.code === "CANDIDATE_V2_QUESTION_ROLE_UNRESOLVED") {
      warnings.push({
        code: entry.code,
        severity: "warning",
        field_path: entry.field_path ?? "proposal.candidate_v2.question",
        summary:
          "Question anchor resolved, but speaker role could not be confirmed as questioner.",
        anchors: entry.anchor ? [entry.anchor] : [],
        reviewer_action:
          "Confirm whether this anchor is acceptable as the question-side reference before public reflection.",
      });
      continue;
    }

    if (entry?.code === "CANDIDATE_V2_ROLE_MISMATCH") {
      warnings.push({
        code: entry.code,
        severity: "warning",
        field_path: entry.field_path ?? "proposal.candidate_v2",
        summary: `Anchor role resolved to ${entry.actual_role ?? "unknown"} instead of expected ${entry.expected_role ?? "unknown"}.`,
        anchors: entry.anchor ? [entry.anchor] : [],
        reviewer_action:
          "Confirm whether this anchor is assigned to the correct question or answer section before public reflection.",
      });
    }
  }

  return warnings;
}

function uniqueNonNull(values) {
  return Array.from(
    new Set(
      (values ?? []).filter(
        (value) => value !== null && value !== undefined && value !== ""
      )
    )
  );
}

function buildRoleObservation(anchors, expectedRole = null) {
  const anchorList = Array.isArray(anchors) ? anchors : [];
  const resolvedAnchors = anchorList.filter((entry) => entry?.resolved === true);
  const actualRoles = uniqueNonNull(
    resolvedAnchors.map((entry) => entry.actual_speaker_role)
  );
  const speechKinds = uniqueNonNull(
    resolvedAnchors.map((entry) => entry.speech_kind)
  );

  let roleStatus = null;
  if (expectedRole) {
    if (anchorList.some((entry) => entry?.role_match === false)) {
      roleStatus = "mismatch";
    } else if (
      resolvedAnchors.some((entry) => entry.actual_speaker_role === "unknown")
    ) {
      roleStatus = "unresolved";
    } else if (
      resolvedAnchors.length > 0 &&
      resolvedAnchors.every((entry) => entry.role_match === true)
    ) {
      roleStatus = "confirmed";
    } else if (anchorList.length === 0) {
      roleStatus = "no_anchors";
    } else {
      roleStatus = "review_needed";
    }
  }

  return {
    resolved_anchor_count: resolvedAnchors.length,
    unresolved_anchor_count: anchorList.length - resolvedAnchors.length,
    actual_speaker_roles: actualRoles,
    speech_kinds: speechKinds,
    role_status: roleStatus,
  };
}

function summarizeCandidateV2Entry(entry, anchors, expectedRole = null) {
  return {
    summary: entry?.summary ?? null,
    anchor_ids: Array.isArray(entry?.anchor_ids) ? entry.anchor_ids : [],
    anchor_count: Array.isArray(entry?.anchor_ids) ? entry.anchor_ids.length : 0,
    expected_speaker_role: expectedRole,
    role_observation: buildRoleObservation(anchors, expectedRole),
  };
}

function summarizeCandidateV2EvidenceItem(entry, anchors) {
  return {
    statement: entry?.statement ?? null,
    status: entry?.status ?? null,
    public_use: entry?.public_use ?? null,
    reason: entry?.reason ?? null,
    anchor_ids: Array.isArray(entry?.anchor_ids) ? entry.anchor_ids : [],
    anchor_count: Array.isArray(entry?.anchor_ids) ? entry.anchor_ids.length : 0,
    anchor_observation: buildRoleObservation(anchors, null),
  };
}

function buildCandidateV2ReflectionNotes(context, warnings) {
  if (!context) {
    return [];
  }

  const notes = [];

  if (warnings.some((entry) => entry?.code === "CANDIDATE_V2_QUESTION_ROLE_UNRESOLVED")) {
    notes.push({
      code: "QUESTION_ROLE_UNRESOLVED",
      severity: "warning",
      summary:
        "Question-side anchor is present, but reviewer should confirm that it is acceptable as the question reference because speaker role metadata is unresolved.",
      related_warning_codes: ["CANDIDATE_V2_QUESTION_ROLE_UNRESOLVED"],
    });
  }

  if (context.city_answer?.role_observation?.role_status === "confirmed") {
    notes.push({
      code: "CITY_ANSWER_ROLE_CONFIRMED",
      severity: "info",
      summary:
        "City answer anchors resolved as executive answer utterances in the current utterance metadata.",
      anchor_count: context.city_answer.anchor_count,
    });
  }

  return notes;
}

function buildCandidateV2ReflectionContext(proposal, anchorRoleSummary, warnings) {
  if (!proposal.candidate_v2 || !anchorRoleSummary?.candidate_v2) {
    return null;
  }

  const candidate = proposal.candidate_v2;
  const summary = anchorRoleSummary.candidate_v2;

  const context = {
    source_scope: candidate.source_scope ?? null,
    question: summarizeCandidateV2Entry(
      candidate.question,
      summary.question,
      candidate.question?.expected_speaker_role ?? null
    ),
    city_answer: summarizeCandidateV2Entry(
      candidate.city_answer,
      summary.city_answer,
      candidate.city_answer?.expected_speaker_role ?? null
    ),
    confirmed_facts: (candidate.confirmed_facts ?? []).map((entry, index) =>
      summarizeCandidateV2EvidenceItem(
        entry,
        summary.confirmed_facts?.[index]?.anchors ?? []
      )
    ),
    unresolved_or_not_confirmed: (
      candidate.unresolved_or_not_confirmed ?? []
    ).map((entry, index) =>
      summarizeCandidateV2EvidenceItem(
        entry,
        summary.unresolved_or_not_confirmed?.[index]?.anchors ?? []
      )
    ),
    recommended_reflection: candidate.recommended_reflection ?? null,
  };

  context.review_notes = buildCandidateV2ReflectionNotes(context, warnings);
  return context;
}

function buildDryRunArtifact(proposalPath, proposal, index) {
  const validationResult = validateProposalAnchors(index, proposal);
  if (!validationResult.ok) {
    const error = new Error(
      `Proposal must pass Issue Publisher validation before dry-run export: ${validationResult.errors
        .map((entry) => entry.code)
        .join(", ")}`
    );
    error.validationResult = validationResult;
    throw error;
  }

  if (proposal.publication_status !== "approved_for_export") {
    throw new Error(
      "Dry-run export requires proposal.publication_status=approved_for_export"
    );
  }

  const resolution = resolveTarget(proposal);
  const candidateV2ReviewWarnings = buildCandidateV2ReviewWarnings(
    validationResult.warnings
  );
  const anchorRoleSummary = buildAnchorRoleSummary(index, proposal);
  return {
    schema_version: "issue-publisher-export-dry-run.v1",
    dry_run: true,
    proposal: {
      id: proposal.proposal_id,
      title: proposal.issue_title,
      source_path: toRepoRelative(proposalPath),
      proposal_kind: proposal.proposal_kind,
      publication_status: proposal.publication_status,
    },
    approval_state: buildApprovalState(proposal),
    application_status: buildApplicationStatus(),
    target_resolution: resolution.targetResolution,
    reviewer_guidance: buildReviewerGuidance(
      resolution.targetResolution,
      resolution.blocks
    ),
    candidate_v2_review_warnings: candidateV2ReviewWarnings,
    would_write: buildWouldWrite(proposal, resolution.targetResolution),
    evidence_summary: buildEvidenceSummary(index, proposal),
    anchor_role_summary: anchorRoleSummary,
    structured_candidate_v2: buildStructuredCandidateV2(proposal),
    candidate_v2_reflection_context: buildCandidateV2ReflectionContext(
      proposal,
      anchorRoleSummary,
      candidateV2ReviewWarnings
    ),
    blocks: resolution.blocks,
  };
}

function exportApprovedProposalDryRun({ proposalPath, outPath, indexPath = DEFAULT_INDEX_PATH }) {
  const proposal = loadJson(proposalPath);
  const index = loadUtteranceIndex(indexPath);
  const artifact = buildDryRunArtifact(proposalPath, proposal, index);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

function main() {
  const { proposalPath, outPath } = parseArgs(process.argv.slice(2));
  if (!proposalPath || !outPath) {
    console.error(
      "Usage: node scripts/issue-publisher/export-approved-proposal-dry-run.mjs --proposal <proposal-json-path> --out <output-json-path>"
    );
    process.exitCode = 1;
    return;
  }

  const artifact = exportApprovedProposalDryRun({ proposalPath, outPath });
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
}

if (isCliEntry()) {
  main();
}

export { buildDryRunArtifact, exportApprovedProposalDryRun, resolveTarget };
