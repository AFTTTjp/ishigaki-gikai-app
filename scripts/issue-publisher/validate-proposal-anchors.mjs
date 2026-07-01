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

function isCliEntry() {
  return path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function validateProposalAnchors(index, proposal) {
  const errors = [];
  const warnings = [];
  const evidenceResults = [];

  const claimType = proposal.claim_type ?? "attributed_speech";
  const evidence = Array.isArray(proposal.evidence) ? proposal.evidence : null;

  if (!evidence || evidence.length === 0) {
    errors.push({
      code: "MISSING_EVIDENCE",
      message: "proposal.evidence must contain at least one entry",
    });
  }

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

  return {
    ok: errors.length === 0,
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
