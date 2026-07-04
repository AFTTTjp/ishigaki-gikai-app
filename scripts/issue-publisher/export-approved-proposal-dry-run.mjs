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
  const filePath = resolve(
    GENERAL_QUESTIONS_DIR,
    `${dietSessionSlug}.general-questions.json`
  );
  return {
    filePath,
    data: loadJson(filePath),
  };
}

function resolveTarget(proposal) {
  const blocks = [];
  const exportTarget = proposal.export?.target;
  const targetSlug = proposal.export?.target_slug;

  if (!exportTarget || exportTarget === "none") {
    blocks.push({
      code: "MISSING_EXPLICIT_EXPORT_TARGET",
      message:
        "Dry-run export requires proposal.export.target and exact target metadata. No public target is inferred from proposal links.",
    });
    return {
      targetResolution: {
        status: "blocked",
        surface: "unresolved",
        target_id: null,
        target_file: null,
        resolved_by: "blocked_no_explicit_target",
      },
      blocks,
    };
  }

  if (!targetSlug || typeof targetSlug !== "string" || targetSlug.trim() === "") {
    blocks.push({
      code: "MISSING_EXPLICIT_TARGET_SLUG",
      message:
        "Dry-run export requires proposal.export.target_slug for exact target resolution.",
    });
    return {
      targetResolution: {
        status: "blocked",
        surface: "unresolved",
        target_id: null,
        target_file: null,
        resolved_by: "blocked_missing_target_slug",
      },
      blocks,
    };
  }

  if (exportTarget === "topic_json") {
    const matches = buildTopicIndex().filter(
      ({ topic }) => topic.topic_slug === targetSlug
    );

    if (matches.length !== 1) {
      blocks.push({
        code: "TOPIC_TARGET_NOT_FOUND",
        message: `Exact topic target not found for proposal.export.target_slug=${targetSlug}.`,
      });
      return {
        targetResolution: {
          status: "blocked",
          surface: "topic",
          target_id: targetSlug,
          target_file: null,
          resolved_by: "blocked_target_not_found",
        },
        blocks,
      };
    }

    return {
      targetResolution: {
        status: "resolved",
        surface: "topic",
        target_id: matches[0].topic.topic_slug,
        target_file: toRepoRelative(matches[0].filePath),
        resolved_by: "explicit_proposal_field",
      },
      blocks,
    };
  }

  if (exportTarget === "general_question_json") {
    const { filePath, data } = loadGeneralQuestionsFile(proposal.diet_session_slug);
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const match = questions.find((question) => question.slug === targetSlug);

    if (!match) {
      blocks.push({
        code: "GENERAL_QUESTION_TARGET_NOT_FOUND",
        message: `Exact general question target not found for proposal.export.target_slug=${targetSlug}.`,
      });
      return {
        targetResolution: {
          status: "blocked",
          surface: "general_question",
          target_id: targetSlug,
          target_file: toRepoRelative(filePath),
          resolved_by: "blocked_target_not_found",
        },
        blocks,
      };
    }

    return {
      targetResolution: {
        status: "resolved",
        surface: "general_question",
        target_id: match.slug,
        target_file: toRepoRelative(filePath),
        resolved_by: "explicit_proposal_field",
      },
      blocks,
    };
  }

  if (exportTarget === "bill_json") {
    blocks.push({
      code: "BILL_JSON_TARGET_UNAVAILABLE",
      message:
        "The repo does not contain a public bill JSON target that can be resolved by exact file/slug matching. Bill dry-run export remains blocked.",
    });
    return {
      targetResolution: {
        status: "blocked",
        surface: "bill",
        target_id: targetSlug,
        target_file: null,
        resolved_by: "blocked_unsupported_surface",
      },
      blocks,
    };
  }

  blocks.push({
    code: "UNSUPPORTED_EXPORT_TARGET",
    message: `Unsupported proposal.export.target=${exportTarget}.`,
  });
  return {
    targetResolution: {
      status: "blocked",
      surface: "unresolved",
      target_id: targetSlug,
      target_file: null,
      resolved_by: "blocked_unsupported_surface",
    },
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
        target_id: targetResolution.target_id,
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
    approval_state: {
      is_approved:
        proposal.review?.status === "approved" &&
        proposal.publication_status === "approved_for_export",
      review_status: proposal.review?.status ?? null,
      publication_status: proposal.publication_status,
      export_readiness: proposal.review?.export_readiness ?? null,
    },
    target_resolution: resolution.targetResolution,
    would_write: buildWouldWrite(proposal, resolution.targetResolution),
    evidence_summary: buildEvidenceSummary(index, proposal),
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
