#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateProposalAnchors,
} from "./validate-proposal-anchors.mjs";
import { loadUtteranceIndex } from "./resolve-anchor.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const DEFAULT_INDEX_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/utterance-index/r8-dai4-teireikai.utterances.json"
);

const POSITIVE_SAMPLE_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/issue-publisher-proposals/samples/r8-dai4-rito-koshien.sample.proposal.json"
);

const NEGATIVE_SAMPLES_DIR = resolve(
  ROOT,
  "docs/general_questions_minutes/issue-publisher-proposals/negative-samples"
);

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
};

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function summarizeCodes(result) {
  return result.errors.map((error) => error.code);
}

function assertPositive(index) {
  const proposal = loadJson(POSITIVE_SAMPLE_PATH);
  const result = validateProposalAnchors(index, proposal);
  if (!result.ok) {
    throw new Error(
      `Positive sample must pass, but failed with codes: ${summarizeCodes(
        result
      ).join(", ")}`
    );
  }

  return {
    file: path.basename(POSITIVE_SAMPLE_PATH),
    ok: true,
  };
}

function assertNegative(index, fileName) {
  const proposalPath = resolve(NEGATIVE_SAMPLES_DIR, fileName);
  const proposal = loadJson(proposalPath);
  const result = validateProposalAnchors(index, proposal);
  const codes = summarizeCodes(result);
  const expectedCodes = EXPECTED_ERROR_CODES_BY_FILE[fileName] ?? [];

  if (result.ok) {
    throw new Error(`${fileName} must fail validation, but passed`);
  }

  for (const expectedCode of expectedCodes) {
    if (!codes.includes(expectedCode)) {
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

function main() {
  const index = loadUtteranceIndex(DEFAULT_INDEX_PATH);
  const negativeFiles = readdirSync(NEGATIVE_SAMPLES_DIR)
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  const summary = {
    positive_sample: assertPositive(index),
    negative_samples: negativeFiles.map((fileName) =>
      assertNegative(index, fileName)
    ),
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
