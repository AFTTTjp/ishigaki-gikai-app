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
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-general-question-target.proposal.json"
  ),
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-former-cityhall-real-topic-target.proposal.json"
  ),
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-rito-koshien-real-topic-target.proposal.json"
  ),
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-former-cityhall-real-topic-target-v2.proposal.json"
  ),
  resolve(
    ROOT,
    "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-former-cityhall-shiuezato-auto-ready-topic-target-v2.proposal.json"
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
      "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-former-cityhall-real-topic-target.proposal.json"
    ),
    outputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-export-dry-runs/approved-attributed-speech-former-cityhall-real-topic-target.dry-run.json"
    ),
    expectedStatus: "resolved",
    expectedSurface: "topic",
    expectedTargetId: "ishigaki-old-city-hall",
    expectedTargetFile:
      "docs/ishigaki_gikai_topics_dev_set/old_city_hall.topic.json",
    expectedTargetLabel: "石垣市庁舎跡地活用",
    expectedBlockCodes: [],
  },
  {
    proposalPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-rito-koshien-real-topic-target.proposal.json"
    ),
    outputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-export-dry-runs/approved-attributed-speech-rito-koshien-real-topic-target.dry-run.json"
    ),
    expectedStatus: "resolved",
    expectedSurface: "topic",
    expectedTargetId: "rito-koshien-r8-dai4",
    expectedTargetFile:
      "docs/ishigaki_gikai_topics_dev_set/rito-koshien-r8-dai4.topic.json",
    expectedTargetLabel: "離島甲子園への出場はどうなる？",
    expectedBlockCodes: [],
  },
  {
    proposalPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-former-cityhall-real-topic-target-v2.proposal.json"
    ),
    outputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-export-dry-runs/approved-attributed-speech-former-cityhall-real-topic-target-v2.dry-run.json"
    ),
    expectedStatus: "resolved",
    expectedSurface: "topic",
    expectedTargetId: "ishigaki-old-city-hall",
    expectedTargetFile:
      "docs/ishigaki_gikai_topics_dev_set/old_city_hall.topic.json",
    expectedTargetLabel: "石垣市庁舎跡地活用",
    expectedBlockCodes: [],
    expectedStructuredCandidateV2: true,
    expectedCandidateV2WarningCodes: [
      "CANDIDATE_V2_QUESTION_ROLE_UNRESOLVED",
    ],
    expectedCandidateV2ReflectionContext: {
      questionRoleStatus: "unresolved",
      cityAnswerRoleStatus: "confirmed",
      reviewNoteCodes: [
        "QUESTION_ROLE_UNRESOLVED",
        "CITY_ANSWER_ROLE_CONFIRMED",
      ],
    },
    expectedCandidateV2ReflectionGate: {
      decision: "review_required",
      safeToGenerateTopicUpdate: false,
      allowedInputsExact: [],
      disallowedInputsIncludes: [
        "question",
        "unresolved_or_not_confirmed",
        "public_draft.summary_detailed",
      ],
      reasonCodes: [
        "QUESTION_ROLE_UNRESOLVED",
        "QUESTION_ROLE_REVIEW_REQUIRED",
        "CITY_ANSWER_ROLE_CONFIRMED_ONLY",
        "SPEAKER_METADATA_REVIEW_REQUIRED",
        "CONFIRMED_FACTS_REQUIRE_EDITORIAL_REVIEW",
      ],
    },
  },
  {
    proposalPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-former-cityhall-shiuezato-auto-ready-topic-target-v2.proposal.json"
    ),
    outputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-export-dry-runs/approved-attributed-speech-former-cityhall-shiuezato-auto-ready-topic-target-v2.dry-run.json"
    ),
    expectedStatus: "resolved",
    expectedSurface: "topic",
    expectedTargetId: "ishigaki-old-city-hall",
    expectedTargetFile:
      "docs/ishigaki_gikai_topics_dev_set/old_city_hall.topic.json",
    expectedTargetLabel: "石垣市庁舎跡地活用",
    expectedBlockCodes: [],
    expectedStructuredCandidateV2: true,
    expectedCandidateV2WarningCount: 0,
    expectedCandidateV2ReflectionContext: {
      questionRoleStatus: "confirmed",
      cityAnswerRoleStatus: "confirmed",
      reviewNoteCodes: ["CITY_ANSWER_ROLE_CONFIRMED"],
      warningSeverityCount: 0,
    },
    expectedCandidateV2ReflectionGate: {
      decision: "auto_ready",
      safeToGenerateTopicUpdate: true,
      allowedInputsExact: [
        "city_answer",
        "confirmed_facts",
        "recommended_reflection",
      ],
      disallowedInputsIncludes: [
        "question",
        "unresolved_or_not_confirmed",
        "public_draft.summary_detailed",
      ],
      noteSubstrings: [
        "Review-only gate",
        "Does not imply public JSON is updated",
        "does not authorize DB import or revalidation",
      ],
      reasonCodes: [
        "APPROVED_FOR_EXPORT",
        "TARGET_RESOLVED",
        "QUESTION_ROLE_CONFIRMED",
        "CITY_ANSWER_ROLE_CONFIRMED",
        "CONFIRMED_FACTS_PRESENT",
        "SAFE_SCOPE_CITY_ANSWER_ONLY",
        "NO_CANDIDATE_V2_WARNINGS",
      ],
    },
  },
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
    expectedTargetLabel: "石垣市庁舎跡地活用",
    expectedBlockCodes: [],
  },
  {
    proposalPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-general-question-target.proposal.json"
    ),
    outputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/issue-publisher-export-dry-runs/approved-attributed-speech-general-question-target.dry-run.json"
    ),
    expectedStatus: "resolved",
    expectedSurface: "general_question",
    expectedTargetId: "ishigaki-r8-dai4-ippan-tomoyose-eizo",
    expectedTargetLabel: "友寄永三 一般質問",
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

  if (artifact.application_status?.applied !== false) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} dry-run must remain unapplied`
    );
  }

  if (artifact.application_status?.public_json_written !== false) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} dry-run must not write public JSON`
    );
  }

  if (artifact.application_status?.db_written !== false) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} dry-run must not write DB state`
    );
  }

  if (artifact.application_status?.revalidation_needed !== false) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} dry-run must not require revalidation`
    );
  }

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

  if (
    caseConfig.expectedTargetLabel !== undefined &&
    artifact.target_resolution.target_label !== caseConfig.expectedTargetLabel
  ) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} dry-run target_label must be ${caseConfig.expectedTargetLabel}, but got ${artifact.target_resolution.target_label}`
    );
  }

  if (
    caseConfig.expectedTargetFile !== undefined &&
    artifact.target_resolution.target_file !== caseConfig.expectedTargetFile
  ) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} dry-run target_file must be ${caseConfig.expectedTargetFile}, but got ${artifact.target_resolution.target_file}`
    );
  }

  if (artifact.target_resolution.status === "resolved") {
    if (!artifact.target_resolution.target_label) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} resolved dry-run must include target_label`
      );
    }

    if (artifact.reviewer_guidance?.ready_for_editor_review !== true) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} resolved dry-run must be ready for editor review`
      );
    }
  }

  if (artifact.target_resolution.status === "blocked") {
    if (artifact.reviewer_guidance?.ready_for_editor_review !== false) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} blocked dry-run must not be ready for editor review`
      );
    }
  }

  if (caseConfig.expectedStructuredCandidateV2 === true) {
    if (!artifact.structured_candidate_v2) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run must include structured_candidate_v2`
      );
    }

    if (!artifact.anchor_role_summary?.candidate_v2) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run must include candidate_v2 anchor_role_summary`
      );
    }

    if (!artifact.candidate_v2_reflection_context) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run must include candidate_v2_reflection_context`
      );
    }

    if (!artifact.candidate_v2_reflection_gate) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run must include candidate_v2_reflection_gate`
      );
    }
  } else if (artifact.candidate_v2_reflection_gate !== null) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} non-v2 dry-run must keep candidate_v2_reflection_gate as null`
    );
  } else if (artifact.candidate_v2_reflection_context !== null) {
    throw new Error(
      `${path.basename(caseConfig.proposalPath)} non-v2 dry-run must keep candidate_v2_reflection_context as null`
    );
  }

  for (const expectedWarningCode of caseConfig.expectedCandidateV2WarningCodes ?? []) {
    const warningCodes = (artifact.candidate_v2_review_warnings ?? []).map(
      (entry) => entry.code
    );
    if (warningCodes.indexOf(expectedWarningCode) === -1) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run must include candidate_v2 review warning ${expectedWarningCode}, but got: ${warningCodes.join(", ")}`
      );
    }
  }

  if (caseConfig.expectedCandidateV2WarningCount !== undefined) {
    const warningCount = Array.isArray(artifact.candidate_v2_review_warnings)
      ? artifact.candidate_v2_review_warnings.length
      : 0;
    if (warningCount !== caseConfig.expectedCandidateV2WarningCount) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run candidate_v2 review warning count must be ${caseConfig.expectedCandidateV2WarningCount}, but got ${warningCount}`
      );
    }
  }

  if (caseConfig.expectedCandidateV2ReflectionContext) {
    const context = artifact.candidate_v2_reflection_context;
    const noteCodes = (context.review_notes ?? []).map((entry) => entry.code);
    const warningSeverityCount = (context.review_notes ?? []).filter(
      (entry) => entry?.severity === "warning"
    ).length;

    if (
      context.question?.role_observation?.role_status !==
      caseConfig.expectedCandidateV2ReflectionContext.questionRoleStatus
    ) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run question role status must be ${caseConfig.expectedCandidateV2ReflectionContext.questionRoleStatus}, but got ${context.question?.role_observation?.role_status}`
      );
    }

    if (
      context.city_answer?.role_observation?.role_status !==
      caseConfig.expectedCandidateV2ReflectionContext.cityAnswerRoleStatus
    ) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run city_answer role status must be ${caseConfig.expectedCandidateV2ReflectionContext.cityAnswerRoleStatus}, but got ${context.city_answer?.role_observation?.role_status}`
      );
    }

    for (const expectedCode of caseConfig.expectedCandidateV2ReflectionContext
      .reviewNoteCodes ?? []) {
      if (!noteCodes.includes(expectedCode)) {
        throw new Error(
          `${path.basename(caseConfig.proposalPath)} dry-run must include candidate_v2 reflection note ${expectedCode}, but got: ${noteCodes.join(", ")}`
        );
      }
    }

    if (
      caseConfig.expectedCandidateV2ReflectionContext.warningSeverityCount !==
        undefined &&
      warningSeverityCount !==
        caseConfig.expectedCandidateV2ReflectionContext.warningSeverityCount
    ) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run candidate_v2 reflection warning severity count must be ${caseConfig.expectedCandidateV2ReflectionContext.warningSeverityCount}, but got ${warningSeverityCount}`
      );
    }
  }

  if (caseConfig.expectedCandidateV2ReflectionGate) {
    const gate = artifact.candidate_v2_reflection_gate;

    if (gate.decision !== caseConfig.expectedCandidateV2ReflectionGate.decision) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run candidate_v2 reflection gate decision must be ${caseConfig.expectedCandidateV2ReflectionGate.decision}, but got ${gate.decision}`
      );
    }

    if (
      gate.safe_to_generate_topic_update !==
      caseConfig.expectedCandidateV2ReflectionGate.safeToGenerateTopicUpdate
    ) {
      throw new Error(
        `${path.basename(caseConfig.proposalPath)} dry-run candidate_v2 reflection gate safe_to_generate_topic_update must be ${caseConfig.expectedCandidateV2ReflectionGate.safeToGenerateTopicUpdate}, but got ${gate.safe_to_generate_topic_update}`
      );
    }

    for (const expectedCode of caseConfig.expectedCandidateV2ReflectionGate
      .reasonCodes ?? []) {
      if (!(gate.reasons ?? []).includes(expectedCode)) {
        throw new Error(
          `${path.basename(caseConfig.proposalPath)} dry-run must include candidate_v2 reflection gate reason ${expectedCode}, but got: ${(gate.reasons ?? []).join(", ")}`
        );
      }
    }

    if (caseConfig.expectedCandidateV2ReflectionGate.allowedInputsExact) {
      const actualAllowedInputs = Array.isArray(gate.allowed_inputs)
        ? gate.allowed_inputs
        : [];
      const expectedAllowedInputs =
        caseConfig.expectedCandidateV2ReflectionGate.allowedInputsExact;

      if (
        JSON.stringify(actualAllowedInputs) !==
        JSON.stringify(expectedAllowedInputs)
      ) {
        throw new Error(
          `${path.basename(caseConfig.proposalPath)} dry-run candidate_v2 reflection gate allowed_inputs must be ${JSON.stringify(expectedAllowedInputs)}, but got ${JSON.stringify(actualAllowedInputs)}`
        );
      }
    }

    for (const expectedInput of caseConfig.expectedCandidateV2ReflectionGate
      .disallowedInputsIncludes ?? []) {
      if (!(gate.disallowed_inputs ?? []).includes(expectedInput)) {
        throw new Error(
          `${path.basename(caseConfig.proposalPath)} dry-run candidate_v2 reflection gate must disallow input ${expectedInput}, but got: ${(gate.disallowed_inputs ?? []).join(", ")}`
        );
      }
    }

    for (const expectedNoteSubstring of caseConfig.expectedCandidateV2ReflectionGate
      .noteSubstrings ?? []) {
      const hasMatchingNote = (gate.notes ?? []).some((note) =>
        note.includes(expectedNoteSubstring)
      );

      if (!hasMatchingNote) {
        throw new Error(
          `${path.basename(caseConfig.proposalPath)} dry-run candidate_v2 reflection gate notes must include substring ${JSON.stringify(expectedNoteSubstring)}, but got: ${(gate.notes ?? []).join(" | ")}`
        );
      }
    }
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
