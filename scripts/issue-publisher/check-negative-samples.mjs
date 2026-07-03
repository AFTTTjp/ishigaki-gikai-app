#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateProposalAnchors,
} from "./validate-proposal-anchors.mjs";
import { loadUtteranceIndex } from "./resolve-anchor.mjs";
import {
  exportApprovedProposalDryRun,
} from "./export-approved-proposal-dry-run.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const DEFAULT_INDEX_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/utterance-index/r8-dai4-teireikai.utterances.json"
);

const POSITIVE_SAMPLE_PATHS = [
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/samples/r8-dai4-rito-koshien.sample.proposal.json"
  ),
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/samples/r8-dai4-former-cityhall.sample.proposal.json"
  ),
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/samples/r8-dai4-lodging-tax.sample.proposal.json"
  ),
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech.proposal.json"
  ),
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-topic-target.proposal.json"
  ),
];

const NEGATIVE_SAMPLES_DIR = resolve(
  ROOT,
  "docs/general_questions_minutes/issue-publisher-proposals/negative-samples"
);

const APPROVED_STATE_NEGATIVE_SAMPLES_DIR = resolve(
  ROOT,
  "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/negative"
);

const DRY_RUN_CASES = [
  {
    proposalPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-topic-target.proposal.json"
    ),
    outputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-export-dry-runs/approved-attributed-speech-topic-target.dry-run.json"
    ),
    expectedStatus: "resolved",
    expectedSurface: "topic",
    expectedTargetId: "ishigaki-old-city-hall",
    expectedBlockCodes: [],
  },
  {
    proposalPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech.proposal.json"
    ),
    outputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-export-dry-runs/approved-attributed-speech.blocked.dry-run.json"
    ),
    expectedStatus: "blocked",
    expectedSurface: "unresolved",
    expectedTargetId: null,
    expectedBlockCodes: ["MISSING_EXPLICIT_EXPORT_TARGET"],
  },
];

const EXPECTED_ERROR_CODES_BY_FILE = {
  "missing-required-field.proposal.json": ["MISSING_REQUIRED_FIELD"],
  "invalid-enum.proposal.json": ["INVALID_CLAIM_TYPE"],
  "empty-evidence.proposal.json": [
    "MISSING_EVIDENCE",
    "NO_PUBLISHABLE_EVIDENCE",
  ],
  "invalid-anchor.proposal.json": [
    "ANCHOR_NOT_FOUND",
    "NO_PUBLISHABLE_EVIDENCE",
  ],
  "review-only-source.proposal.json": [
    "REVIEW_ONLY_SOURCE",
    "NO_PUBLISHABLE_EVIDENCE",
  ],
  "transcript-only-fact.proposal.json": [
    "FACT_CLAIM_REQUIRES_OFFICIAL_EVIDENCE",
  ],
  "invalid-evidence-shape.proposal.json": ["INVALID_EVIDENCE_MODE"],
  "invalid-schema-version.proposal.json": ["INVALID_SCHEMA_VERSION"],
  "approved-missing-reviewer.proposal.json": ["MISSING_APPROVAL_REVIEWER"],
  "approved-missing-reviewed-at.proposal.json": [
    "MISSING_APPROVAL_REVIEWED_AT",
  ],
  "approved-missing-approval-note.proposal.json": ["MISSING_APPROVAL_NOTE"],
  "approved-missing-export-readiness.proposal.json": [
    "MISSING_EXPORT_READINESS",
  ],
  "approved-for-export-review-not-approved.proposal.json": [
    "APPROVED_EXPORT_REQUIRES_REVIEW_APPROVED",
  ],
  "approved-for-export-needs-human-review.proposal.json": [
    "APPROVED_EXPORT_REQUIRES_COMPLETED_HUMAN_REVIEW",
  ],
  "approved-for-export-not-ready.proposal.json": [
    "APPROVED_EXPORT_REQUIRES_READY_STATE",
  ],
  "approved-for-export-transcript-only-fact.proposal.json": [
    "FACT_CLAIM_REQUIRES_OFFICIAL_EVIDENCE",
  ],
  "approved-for-export-review-only-source.proposal.json": [
    "REVIEW_ONLY_SOURCE",
    "NO_PUBLISHABLE_EVIDENCE",
  ],
  "approved-ready-with-export-blockers.proposal.json": [
    "READY_EXPORT_HAS_BLOCKERS",
  ],
};

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function summarizeCodes(result) {
  return result.errors.map((error) => error.code);
}

function getExpectedErrorCodes(fileName) {
  const expectedCodes = EXPECTED_ERROR_CODES_BY_FILE[fileName];

  if (!Array.isArray(expectedCodes) || expectedCodes.length === 0) {
    throw new Error(
      `${fileName} is missing expected error code mapping in EXPECTED_ERROR_CODES_BY_FILE`
    );
  }

  return expectedCodes;
}

function assertPositive(index, proposalPath) {
  const proposal = loadJson(proposalPath);
  const result = validateProposalAnchors(index, proposal);
  if (!result.ok) {
    throw new Error(
      `${path.basename(proposalPath)} must pass, but failed with codes: ${summarizeCodes(
        result
      ).join(", ")}`
    );
  }

  return {
    file: path.basename(proposalPath),
    ok: true,
  };
}

function assertNegative(index, baseDir, fileName) {
  const proposalPath = resolve(baseDir, fileName);
  const proposal = loadJson(proposalPath);
  const result = validateProposalAnchors(index, proposal);
  const codes = summarizeCodes(result);
  const expectedCodes = getExpectedErrorCodes(fileName);

  if (result.ok) {
    throw new Error(`${fileName} must fail validation, but passed`);
  }

  for (const expectedCode of expectedCodes) {
    if (codes.indexOf(expectedCode) === -1) {
      throw new Error(
        `${fileName} must include error code ${expectedCode}, but got: ${codes.join(", ")}`
      );
    }
  }

  return {
    file: fileName,
    ok: false,
    expected_error_codes: expectedCodes,
    actual_error_codes: codes,
  };
}

function assertDryRunCase(caseConfig) {
  const artifact = exportApprovedProposalDryRun({
    proposalPath: caseConfig.proposalPath,
    outPath: caseConfig.outputPath,
  });
  const blockCodes = artifact.blocks.map((entry) => entry.code);

  if (artifact.target_resolution.status !== caseConfig.expectedStatus) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} dry-run status must be ${caseConfig.expectedStatus}, but got ${artifact.target_resolution.status}`
    );
  }

  if (artifact.target_resolution.surface !== caseConfig.expectedSurface) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} dry-run surface must be ${caseConfig.expectedSurface}, but got ${artifact.target_resolution.surface}`
    );
  }

  if (artifact.target_resolution.target_id !== caseConfig.expectedTargetId) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} dry-run target_id must be ${caseConfig.expectedTargetId}, but got ${artifact.target_resolution.target_id}`
    );
  }

  for (const expectedCode of caseConfig.expectedBlockCodes) {
    if (blockCodes.indexOf(expectedCode) === -1) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run must include block code ${expectedCode}, but got: ${blockCodes.join(", ")}`
      );
    }
  }

  return {
    file: path.basename(caseConfig.proposalPath),
    target_resolution: artifact.target_resolution,
    block_codes: blockCodes,
    output_path: path.relative(ROOT, caseConfig.outputPath),
  };
}

function main() {
  const index = loadUtteranceIndex(DEFAULT_INDEX_PATH);
  const negativeFiles = readdirSync(NEGATIVE_SAMPLES_DIR)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();
  const approvedStateNegativeFiles = readdirSync(
    APPROVED_STATE_NEGATIVE_SAMPLES_DIR
  )
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  const summary = {
    positive_samples: POSITIVE_SAMPLE_PATHS.map((proposalPath) =>
      assertPositive(index, proposalPath)
    ),
    negative_samples: negativeFiles.map((fileName) =>
      assertNegative(index, NEGATIVE_SAMPLES_DIR, fileName)
    ),
    approved_state_negative_samples: approvedStateNegativeFiles.map(
      (fileName) =>
        assertNegative(index, APPROVED_STATE_NEGATIVE_SAMPLES_DIR, fileName)
    ),
    dry_run_exports: DRY_RUN_CASES.map((caseConfig) =>
      assertDryRunCase(caseConfig)
    ),
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
