#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ISSUE_GRAPH_PILOT_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-graph-pilot.json"
);
const SPEECH_CANONICAL_DIR = resolve(
  ROOT,
  "docs/general_questions_minutes/speech-canonical/r8-dai4"
);
const TARGET_ISSUE_ID = "issue-r8d4-rito-koshien";
const OUTPUT_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-graph-v2-rito-koshien.review.json"
);

const SPEECH_SOURCES = [
  "ishigaki-r8-dai4-ippan-shiuezato-atsushi.speech-canonical.json",
  "ishigaki-r8-dai4-ippan-nagahama-nobuo.speech-canonical.json",
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function unique(values) {
  return [...new Set(values)];
}

function validateEvidenceIdFormat(evidenceId) {
  return /^.+#L\d+-L\d+$/.test(evidenceId);
}

function buildSpeechIndex() {
  const byQuestionSlug = new Map();
  const evidenceIds = new Set();
  const sourcePaths = [];

  for (const fileName of SPEECH_SOURCES) {
    const filePath = resolve(SPEECH_CANONICAL_DIR, fileName);
    const document = readJson(filePath);

    if (document.schema_version !== "speech-canonical/v1") {
      throw new Error(`Unexpected schema_version in ${fileName}`);
    }

    for (const block of document.speech_blocks ?? []) {
      if (!validateEvidenceIdFormat(block.evidence_id)) {
        throw new Error(`Invalid evidence_id in ${fileName}: ${block.evidence_id}`);
      }
      evidenceIds.add(block.evidence_id);
    }

    byQuestionSlug.set(document.question_slug, document);
    sourcePaths.push(relative(ROOT, filePath));
  }

  return {
    byQuestionSlug,
    evidenceIds,
    sourcePaths: sourcePaths.sort((a, b) => a.localeCompare(b, "ja")),
  };
}

function findPrimaryEvidenceIds(document, itemNumber, speechKind) {
  return (document.speech_blocks ?? [])
    .filter(
      (block) =>
        block.speech_kind === speechKind &&
        block.item_number_candidate === itemNumber
    )
    .map((block) => block.evidence_id)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

function buildRelatedItem(ref, speechIndex) {
  const document = speechIndex.byQuestionSlug.get(ref.questionSlug);
  if (!document) {
    throw new Error(`Speech canonical not found for ${ref.questionSlug}`);
  }

  const questionPrimary = findPrimaryEvidenceIds(
    document,
    ref.itemNumber,
    "question_item"
  );
  const answerPrimary = findPrimaryEvidenceIds(document, ref.itemNumber, "answer");

  if (questionPrimary.length === 0) {
    throw new Error(
      `Question primary evidence missing: ${ref.questionSlug} / item ${ref.itemNumber}`
    );
  }
  if (answerPrimary.length === 0) {
    throw new Error(
      `Answer primary evidence missing: ${ref.questionSlug} / item ${ref.itemNumber}`
    );
  }

  return {
    ...ref,
    speech_evidence: {
      source_question_slug: ref.questionSlug,
      question_primary_evidence_ids: questionPrimary,
      answer_primary_evidence_ids: answerPrimary,
      secondary_evidence_ids: [],
    },
  };
}

function buildReviewArtifact() {
  const issueGraph = readJson(ISSUE_GRAPH_PILOT_PATH);
  const speechIndex = buildSpeechIndex();
  const issue = (issueGraph.issues ?? []).find(
    (entry) => entry.issue_id === TARGET_ISSUE_ID
  );

  if (!issue) {
    throw new Error(`Issue not found: ${TARGET_ISSUE_ID}`);
  }

  const relatedItems = (issue.related_general_question_items ?? []).map((ref) =>
    buildRelatedItem(ref, speechIndex)
  );

  const questionEvidenceIds = relatedItems.flatMap(
    (ref) => ref.speech_evidence.question_primary_evidence_ids
  );
  const answerEvidenceIds = relatedItems.flatMap(
    (ref) => ref.speech_evidence.answer_primary_evidence_ids
  );
  const secondaryEvidenceIds = relatedItems.flatMap(
    (ref) => ref.speech_evidence.secondary_evidence_ids
  );

  const reviewIssue = {
    ...issue,
    related_general_question_items: relatedItems,
    issue_evidence: {
      question_evidence_ids: unique(questionEvidenceIds),
      answer_evidence_ids: unique(answerEvidenceIds),
      secondary_evidence_ids: unique(secondaryEvidenceIds),
      all_evidence_ids: unique([
        ...questionEvidenceIds,
        ...answerEvidenceIds,
        ...secondaryEvidenceIds,
      ]).sort((a, b) => a.localeCompare(b, "ja")),
    },
  };

  const output = {
    schema: "issue-graph/v2-review",
    diet_session_slug: issueGraph.diet_session_slug,
    based_on: {
      issue_graph_pilot: relative(ROOT, ISSUE_GRAPH_PILOT_PATH),
      speech_canonical_sources: speechIndex.sourcePaths,
    },
    issues: [reviewIssue],
  };

  for (const evidenceId of reviewIssue.issue_evidence.all_evidence_ids) {
    if (!speechIndex.evidenceIds.has(evidenceId)) {
      throw new Error(`Unknown evidence_id referenced: ${evidenceId}`);
    }
  }

  if (reviewIssue.issue_evidence.all_evidence_ids.length !== 4) {
    throw new Error(
      `Expected 4 evidence ids, got ${reviewIssue.issue_evidence.all_evidence_ids.length}`
    );
  }

  return output;
}

function main() {
  const output = buildReviewArtifact();
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  console.log(
    `[issue-graph-v2-review] wrote ${relative(ROOT, OUTPUT_PATH)} (${output.issues.length} issue)`
  );
}

main();
