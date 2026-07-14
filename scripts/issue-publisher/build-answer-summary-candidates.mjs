import fs from "node:fs";
import path from "node:path";

const INVENTORY_PATH =
  "docs/general_questions_minutes/candidate-inventory/r8-dai4-teireikai.candidate-inventory.json";
const UTTERANCE_INDEX_PATH =
  "docs/general_questions_minutes/utterance-index/r8-dai4-teireikai.utterances.json";
const GENERAL_QUESTIONS_PATH =
  "docs/general_questions/r8-dai4-teireikai.general-questions.json";
const OUTPUT_PATH =
  "docs/general_questions_minutes/answer-summary-candidates/r8-dai4-teireikai.answer-summary-candidates.json";

const REVIEW_FIELD_NAMES = [
  "reviewed_speaker_name",
  "reviewed_speaker_role",
  "attribution_confidence",
  "attribution_basis",
  "attribution_review_notes",
  "item_match_confidence",
  "item_match_basis",
  "item_match_review_notes",
  "candidate_summary",
  "summary_basis",
  "candidate_review_status",
  "recommended_action",
  "review_notes",
];

const REVIEW_STATUSES = new Set([
  "pending_review",
  "hold_attribution",
  "hold_item_match",
  "hold_transcription",
  "reject_not_answer",
  "reject_duplicate",
  "approved_for_summary",
]);

const RECOMMENDED_ACTIONS = new Set([
  "review_for_city_answer_summary",
  "resolve_speaker_role",
  "resolve_item_match",
  "review_transcription",
  "keep_unresolved",
  "reject_not_answer",
  "already_reflected",
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readExistingReviewMap() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return new Map();
  }

  const existing = readJson(OUTPUT_PATH);
  const reviewMap = new Map();
  for (const entry of existing.entries ?? []) {
    for (const candidate of entry.candidates ?? []) {
      reviewMap.set(candidate.candidate_id, candidate);
    }
  }
  return reviewMap;
}

function preserveReviewFields(candidate, existingReviewMap) {
  const existing = existingReviewMap.get(candidate.candidate_id);
  if (!existing) {
    return candidate;
  }

  const preserved = { ...candidate };
  for (const fieldName of REVIEW_FIELD_NAMES) {
    if (Object.hasOwn(existing, fieldName)) {
      preserved[fieldName] = existing[fieldName];
    }
  }
  return preserved;
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function normalizeRiskFlags(flags) {
  return [...new Set(flags.filter(Boolean))].sort();
}

function makeQuestionText(item) {
  const subItems = Array.isArray(item?.sub_items) ? item.sub_items : [];
  if (subItems.length === 0) {
    return item?.title ?? "";
  }
  return `${item.title}: ${subItems.join(" / ")}`;
}

function getInventoryItemNumber(inventoryEntry) {
  if (Number.isInteger(inventoryEntry.item_number_candidate)) {
    return inventoryEntry.item_number_candidate;
  }

  const match = inventoryEntry.candidate_id.match(/\.item(\d+)$/);
  if (!match) {
    throw new Error(`Cannot infer item number: ${inventoryEntry.candidate_id}`);
  }
  return Number(match[1]);
}

function buildIndexes() {
  const inventory = readJson(INVENTORY_PATH);
  const utteranceIndex = readJson(UTTERANCE_INDEX_PATH);
  const generalQuestions = readJson(GENERAL_QUESTIONS_PATH);

  const utterances = utteranceIndex.utterances ?? [];
  const utteranceById = new Map(
    utterances.map((utterance) => [utterance.utterance_id, utterance]),
  );
  const questionBySlug = new Map(
    generalQuestions.questions.map((question) => [question.slug, question]),
  );

  return {
    inventory,
    utteranceIndex,
    generalQuestions,
    utteranceById,
    questionBySlug,
  };
}

function getQuestionEntry(questionBySlug, inventoryEntry) {
  const question = questionBySlug.get(inventoryEntry.general_question_slug_or_id);
  if (!question) {
    throw new Error(
      `Missing general question: ${inventoryEntry.general_question_slug_or_id}`,
    );
  }

  const itemNumber = getInventoryItemNumber(inventoryEntry);
  const item = question.items.find(
    (candidateItem) =>
      candidateItem.item_number === itemNumber ||
      `${candidateItem.item_number}` === `${itemNumber}`,
  );
  if (!item) {
    throw new Error(
      `Missing item ${itemNumber} for ${question.slug}`,
    );
  }

  return { question, item };
}

function candidateStatusAndAction(candidate, entry, anchorType) {
  const riskFlags = [...(entry.risk_flags ?? [])];
  const sourceRole = candidate.source_speaker_role;

  if (sourceRole === "unknown") {
    riskFlags.push("answer_role_unknown", "speaker_role_unknown");
    return {
      reviewed_speaker_name: null,
      reviewed_speaker_role: null,
      attribution_confidence: "unresolved",
      attribution_basis: null,
      attribution_review_notes:
        "speaker role が unknown のため、周辺 utterance と議事進行から話者確認が必要です。",
      item_match_confidence: "unresolved",
      item_match_basis: null,
      item_match_review_notes: null,
      candidate_summary: null,
      candidate_review_status: "hold_attribution",
      recommended_action: "resolve_speaker_role",
      risk_flags: normalizeRiskFlags(riskFlags),
      review_notes:
        "speaker role が unknown のため、市側答弁として扱う前に話者確認が必要です。",
    };
  }

  if (anchorType === "null_item_proximity") {
    riskFlags.push(
      "city_answer_missing",
      "item_match_uncertain",
      "low_confidence_answer_anchor",
      "recoverable_answer_candidate",
    );
    return {
      reviewed_speaker_name: candidate.source_speaker_name ?? null,
      reviewed_speaker_role: candidate.source_speaker_role ?? null,
      attribution_confidence:
        candidate.source_speaker_role === "executive" ||
        candidate.source_speaker_role === "city"
          ? "medium"
          : "unresolved",
      attribution_basis: null,
      attribution_review_notes:
        "source metadata では行政側候補ですが、null item proximity のため item 対応確認を優先します。",
      item_match_confidence: "unresolved",
      item_match_basis: null,
      item_match_review_notes:
        "null item proximity で拾った低信頼候補のため、対応 item を人手で確認するまで要約化しません。",
      candidate_summary: null,
      candidate_review_status: "hold_item_match",
      recommended_action: "resolve_item_match",
      risk_flags: normalizeRiskFlags(riskFlags),
      review_notes:
        "null item proximity で拾った低信頼候補のため、対応 item を人手で確認するまで要約化しません。",
    };
  }

  riskFlags.push("answer_like_requires_review");
  return {
    reviewed_speaker_name: null,
    reviewed_speaker_role: null,
    attribution_confidence: "unresolved",
    attribution_basis: null,
    attribution_review_notes:
      "answer-like 発話として抽出されています。公開要約に進める前に話者確認が必要です。",
    item_match_confidence: "medium",
    item_match_basis: null,
    item_match_review_notes:
      "inventory では item answer-like として抽出されていますが、話者帰属の確認が未了です。",
    candidate_summary: null,
    candidate_review_status: "pending_review",
    recommended_action: "review_for_city_answer_summary",
    risk_flags: normalizeRiskFlags(riskFlags),
    review_notes:
      "answer-like 発話として抽出されています。公開要約に進める前に話者と item 対応を確認してください。",
  };
}

function buildCandidate({
  inventoryEntry,
  source,
  utteranceById,
  anchorType,
  existingReviewMap,
}) {
  const utterance = utteranceById.get(source.utterance_id);
  if (!utterance) {
    throw new Error(`Missing source utterance: ${source.utterance_id}`);
  }

  const sourceText = utterance.text;
  if (!sourceText || sourceText.length === 0) {
    throw new Error(`Empty source text: ${source.utterance_id}`);
  }

  const sourceSpeakerName =
    source.speaker ?? utterance.speaker_hint ?? "unknown";
  const sourceSpeakerRole =
    source.speaker_role ?? utterance.speaker_role_hint ?? "unknown";

  const baseCandidate = {
    candidate_id: `${inventoryEntry.candidate_id}::${source.utterance_id}::${anchorType}`,
    source_utterance_id: source.utterance_id,
    source_file: UTTERANCE_INDEX_PATH,
    source_speaker_name: sourceSpeakerName,
    source_speaker_role: sourceSpeakerRole,
    source_text: sourceText,
    source_line_start: utterance.line_start,
    source_line_end: utterance.line_end,
    anchor_type: anchorType,
    answer_confidence:
      source.confidence ?? inventoryEntry.answer_anchor_confidence,
    fallback_used:
      anchorType === "null_item_proximity" ||
      (inventoryEntry.risk_flags ?? []).includes("question_anchor_fallback_used"),
    summary_basis: null,
  };

  return preserveReviewFields({
    ...baseCandidate,
    ...candidateStatusAndAction(baseCandidate, inventoryEntry, anchorType),
  }, existingReviewMap);
}

function buildArtifact() {
  const { inventory, utteranceIndex, questionBySlug, utteranceById } =
    buildIndexes();
  const existingReviewMap = readExistingReviewMap();

  const targetEntries = inventory.entries.filter(
    (entry) =>
      entry.answer_anchor_source === "unknown_answer_like" ||
      (entry.recoverable_answer_candidates ?? []).length > 0,
  );

  const entries = targetEntries.map((inventoryEntry) => {
    const { question, item } = getQuestionEntry(questionBySlug, inventoryEntry);

    const candidateSources = [];
    if (inventoryEntry.answer_anchor_source === "unknown_answer_like") {
      candidateSources.push({
        source: inventoryEntry.city_answer_anchor,
        anchorType: "unknown_answer_like",
      });
    }
    for (const recoverable of inventoryEntry.recoverable_answer_candidates ??
      []) {
      candidateSources.push({
        source: recoverable,
        anchorType: recoverable.reason ?? "null_item_proximity",
      });
    }

    const candidates = candidateSources.map((candidateSource, index) =>
      buildCandidate({
        inventoryEntry,
        source: candidateSource.source,
        utteranceById,
        anchorType: candidateSource.anchorType,
        existingReviewMap,
      }),
    );

    const entryRiskFlags = normalizeRiskFlags([
      ...(inventoryEntry.risk_flags ?? []),
      ...candidates.flatMap((candidate) => candidate.risk_flags),
    ]);
    const hasAttributionHold = candidates.some(
      (candidate) => candidate.candidate_review_status === "hold_attribution",
    );
    const hasItemHold = candidates.some(
      (candidate) => candidate.candidate_review_status === "hold_item_match",
    );

    return {
      entry_id: inventoryEntry.candidate_id,
      question_id: question.slug,
      question_order: question.question_number,
      questioner_name: question.member_name_raw,
      item_index: item.item_number,
      item_title: item.title,
      question_text: makeQuestionText(item),
      inventory_answer_state: {
        answer_anchor_source: inventoryEntry.answer_anchor_source,
        answer_anchor_confidence: inventoryEntry.answer_anchor_confidence,
        city_answer_missing: inventoryEntry.city_answer_missing,
      },
      entry_risk_flags: entryRiskFlags,
      review_status: hasAttributionHold
        ? "hold_attribution"
        : hasItemHold
          ? "hold_item_match"
          : "pending_review",
      recommended_action: hasAttributionHold
        ? "resolve_speaker_role"
        : hasItemHold
          ? "resolve_item_match"
          : "review_for_city_answer_summary",
      review_notes:
        "confirmed_facts phase close 後の reviewer-only answer summary 候補です。公開反映の承認データではありません。",
      candidates,
    };
  });

  const allCandidates = entries.flatMap((entry) => entry.candidates);
  const summary = {
    source_entry_count: targetEntries.length,
    generated_entry_count: entries.length,
    source_candidate_count:
      inventory.entries.filter(
        (entry) => entry.answer_anchor_source === "unknown_answer_like",
      ).length +
      inventory.entries.reduce(
        (count, entry) =>
          count + (entry.recoverable_answer_candidates ?? []).length,
        0,
      ),
    generated_candidate_count: allCandidates.length,
    summaries_generated: allCandidates.filter(
      (candidate) => candidate.candidate_summary !== null,
    ).length,
    summaries_held_or_null: allCandidates.filter(
      (candidate) => candidate.candidate_summary === null,
    ).length,
    review_status_counts: countBy(
      allCandidates,
      (candidate) => candidate.candidate_review_status,
    ),
    recommended_action_counts: countBy(
      allCandidates,
      (candidate) => candidate.recommended_action,
    ),
    risk_flag_counts: countBy(
      allCandidates.flatMap((candidate) => candidate.risk_flags),
      (riskFlag) => riskFlag,
    ),
  };

  return {
    schema_version: "answer-summary-candidates.v1",
    session: inventory.session,
    diet_session_slug: inventory.diet_session_slug,
    artifact_type: "answer_summary_candidates",
    artifact_origin: "generated_from_candidate_inventory",
    review_status: "reviewer_only",
    generated_at: new Date().toISOString(),
    generated_from: [INVENTORY_PATH, UTTERANCE_INDEX_PATH, GENERAL_QUESTIONS_PATH],
    source_inventory_summary: {
      entries: inventory.entries.length,
      direct_item_answer_anchors: inventory.entries.filter(
        (entry) => entry.answer_anchor_source === "direct_item_match",
      ).length,
      unknown_answer_like: inventory.entries.filter(
        (entry) => entry.answer_anchor_source === "unknown_answer_like",
      ).length,
      city_answer_missing: inventory.entries.filter(
        (entry) => entry.city_answer_missing,
      ).length,
      recoverable_answer_entries: inventory.entries.filter(
        (entry) => (entry.recoverable_answer_candidates ?? []).length > 0,
      ).length,
      recoverable_answer_candidates: inventory.entries.reduce(
        (count, entry) =>
          count + (entry.recoverable_answer_candidates ?? []).length,
        0,
      ),
      question_anchor_missing: inventory.entries.filter((entry) =>
        (entry.risk_flags ?? []).includes("question_anchor_missing"),
      ).length,
      speaker_role_unknown_warnings: inventory.entries.filter(
        (entry) =>
          entry.speaker_role === "unknown" ||
          (entry.risk_flags ?? []).includes("speaker_role_unknown"),
      ).length,
    },
    summary,
    entries,
  };
}

function assertEnum(value, allowed, pathName) {
  if (!allowed.has(value)) {
    throw new Error(`${pathName} has invalid value: ${value}`);
  }
}

function validateArtifact(artifact) {
  const { utteranceById, questionBySlug } = buildIndexes();
  const entryIds = new Set();
  const candidateIds = new Set();

  for (const entry of artifact.entries) {
    if (entryIds.has(entry.entry_id)) {
      throw new Error(`Duplicate entry_id: ${entry.entry_id}`);
    }
    entryIds.add(entry.entry_id);
    assertEnum(entry.review_status, REVIEW_STATUSES, entry.entry_id);
    assertEnum(entry.recommended_action, RECOMMENDED_ACTIONS, entry.entry_id);

    const question = questionBySlug.get(entry.question_id);
    if (!question) {
      throw new Error(`Missing question_id: ${entry.question_id}`);
    }
    const item = question.items.find(
      (candidateItem) => candidateItem.item_number === entry.item_index,
    );
    if (!item) {
      throw new Error(`Missing item ${entry.item_index}: ${entry.question_id}`);
    }

    for (const candidate of entry.candidates) {
      if (candidateIds.has(candidate.candidate_id)) {
        throw new Error(`Duplicate candidate_id: ${candidate.candidate_id}`);
      }
      candidateIds.add(candidate.candidate_id);
      assertEnum(
        candidate.candidate_review_status,
        REVIEW_STATUSES,
        candidate.candidate_id,
      );
      assertEnum(
        candidate.recommended_action,
        RECOMMENDED_ACTIONS,
        candidate.candidate_id,
      );

      const utterance = utteranceById.get(candidate.source_utterance_id);
      if (!utterance) {
        throw new Error(
          `Missing source utterance: ${candidate.source_utterance_id}`,
        );
      }
      if (candidate.source_text !== utterance.text) {
        throw new Error(
          `Source text mismatch: ${candidate.source_utterance_id}`,
        );
      }
      if (
        candidate.source_line_start !== utterance.line_start ||
        candidate.source_line_end !== utterance.line_end
      ) {
        throw new Error(
          `Line range mismatch: ${candidate.source_utterance_id}`,
        );
      }
      if (!candidate.source_text.trim()) {
        throw new Error(`Empty source text: ${candidate.candidate_id}`);
      }
      if (
        candidate.source_speaker_role === "unknown" &&
        !candidate.risk_flags.includes("answer_role_unknown")
      ) {
        throw new Error(
          `Unknown speaker role is not risk flagged: ${candidate.candidate_id}`,
        );
      }
      if (
        candidate.anchor_type === "null_item_proximity" &&
        candidate.item_match_confidence !== "high" &&
        candidate.candidate_review_status !== "hold_item_match"
      ) {
        throw new Error(
          `Uncertain item match is not held: ${candidate.candidate_id}`,
        );
      }
    }
  }
}

const artifact = buildArtifact();
validateArtifact(artifact);

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      output: OUTPUT_PATH,
      entries: artifact.entries.length,
      candidates: artifact.summary.generated_candidate_count,
      summaries_generated: artifact.summary.summaries_generated,
      summaries_held_or_null: artifact.summary.summaries_held_or_null,
    },
    null,
    2,
  ),
);
