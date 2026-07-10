#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const GENERAL_QUESTIONS_PATH = resolve(
  ROOT,
  "docs/general_questions/r8-dai4-teireikai.general-questions.json"
);
const UTTERANCE_INDEX_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/utterance-index/r8-dai4-teireikai.utterances.json"
);
const OUTPUT_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/candidate-inventory/r8-dai4-teireikai.candidate-inventory.json"
);
const ANCHOR_SOURCE_FILE =
  "docs/general_questions_minutes/utterance-index/r8-dai4-teireikai.utterances.json";
const ANSWER_LIKE_REGEX =
  /ご質問にお答え|お答えいたします|お答えします|答弁|説明します|本市では|当局として/;
const QUESTION_PROMPT_REGEX =
  /ご答弁願います|答弁を求めます|お尋ねいたします|お伺いします|質問します|質問いたします/;
const GENERIC_ANSWER_MATCH_TERMS = new Set([
  "について",
  "現状",
  "進捗",
  "状況",
  "見解",
  "対応",
  "本市",
  "石垣市",
  "行政",
  "支援",
  "課題",
  "対策",
  "制度",
  "事業",
  "計画",
  "整備",
  "活用",
  "推進",
  "確保",
]);

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizeWhitespace(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function buildExcerpt(value, maxLength = 180) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function buildQuestionSummary(item) {
  const subItems = Array.isArray(item.sub_items) ? item.sub_items : [];
  if (subItems.length === 0) {
    return item.title;
  }

  return `${item.title}: ${subItems.join(" / ")}`;
}

function formatLineHint(utterance) {
  if (
    typeof utterance?.line_start === "number" &&
    typeof utterance?.line_end === "number"
  ) {
    return `L${utterance.line_start}-L${utterance.line_end}`;
  }

  return null;
}

function isAnswerLikeText(entry) {
  const text = normalizeWhitespace(entry?.text);
  return ANSWER_LIKE_REGEX.test(text) && !QUESTION_PROMPT_REGEX.test(text);
}

function isQuestionSideUtterance(entry) {
  return (
    entry &&
    entry.speech_kind !== "answer" &&
    entry.speaker_role_hint !== "executive" &&
    entry.speaker_role_hint !== "chair"
  );
}

function isFallbackProceduralNoise(entry) {
  const text = normalizeWhitespace(entry?.text);
  return /答弁を求めます|暫時休憩|再開いたします|質問を終わります|質問は終わりました|休憩いたします/.test(
    text
  );
}

function chooseQuestionAnchor(utterances) {
  return utterances.find((entry) => isQuestionSideUtterance(entry)) ?? null;
}

function chooseQuestionAnchorFallback(questionUtterances, utterancesForItem) {
  const firstItemLine = Math.min(
    ...utterancesForItem
      .map((entry) => entry?.line_start)
      .filter((value) => typeof value === "number")
  );

  if (!Number.isFinite(firstItemLine)) {
    return null;
  }

  const fallbackCandidates = questionUtterances.filter(
    (entry) =>
      entry.item_number_candidate === null &&
      isQuestionSideUtterance(entry) &&
      !isFallbackProceduralNoise(entry) &&
      typeof entry.line_end === "number" &&
      entry.line_end < firstItemLine
  );

  return fallbackCandidates.at(-1) ?? null;
}

function chooseAnswerUtterances(utterances) {
  return utterances.filter(
    (entry) =>
      entry.speaker_role_hint === "executive" ||
      entry.speaker_role_hint === "city" ||
      entry.speech_kind === "answer"
  );
}

function chooseUnknownAnswerLikeUtterance(utterances) {
  return (
    utterances.find(
      (entry) =>
        entry.speaker_role_hint === "unknown" &&
        entry.speech_kind !== "question_item" &&
        isAnswerLikeText(entry)
    ) ?? null
  );
}

function extractAnswerMatchTerms(item) {
  const source = [item.title, ...(item.sub_items ?? [])]
    .map(normalizeWhitespace)
    .join(" ");

  return Array.from(
    new Set(
      source
        .split(/[・「」『』（）()\/、,，。\s]+/)
        .map((term) => term.trim())
        .filter(
          (term) => term.length >= 3 && !GENERIC_ANSWER_MATCH_TERMS.has(term)
        )
    )
  ).slice(0, 8);
}

function isPotentialAnswerAnchor(entry) {
  return (
    entry &&
    entry.speaker_role_hint !== "chair" &&
    (entry.speaker_role_hint === "executive" ||
      entry.speaker_role_hint === "city" ||
      entry.speech_kind === "answer" ||
      isAnswerLikeText(entry))
  );
}

function chooseNullItemProximityAnswer(
  questionUtterances,
  utterancesForItem,
  questionAnchor,
  item
) {
  const matchTerms = extractAnswerMatchTerms(item);
  if (matchTerms.length === 0) {
    return null;
  }

  const lineCandidates = [
    ...utterancesForItem
      .map((entry) => entry?.line_end)
      .filter((value) => typeof value === "number"),
    typeof questionAnchor?.line_end === "number" ? questionAnchor.line_end : null,
  ].filter((value) => typeof value === "number");

  if (lineCandidates.length === 0) {
    return null;
  }

  const referenceLine = Math.max(...lineCandidates);
  const nextNumberedLine = questionUtterances
    .filter(
      (entry) =>
        Number.isInteger(entry.item_number_candidate) &&
        entry.item_number_candidate > item.item_number &&
        typeof entry.line_start === "number" &&
        entry.line_start > referenceLine
    )
    .map((entry) => entry.line_start)
    .sort((left, right) => left - right)[0];

  return (
    questionUtterances.find(
      (entry) =>
        entry.item_number_candidate === null &&
        isPotentialAnswerAnchor(entry) &&
        typeof entry.line_start === "number" &&
        entry.line_start > referenceLine &&
        entry.line_start - referenceLine <= 80 &&
        (typeof nextNumberedLine !== "number" || entry.line_start < nextNumberedLine) &&
        (() => {
          const text = normalizeWhitespace(entry.text);
          const matchedTerms = matchTerms.filter((term) => text.includes(term));
          return (
            matchedTerms.length >= 2 ||
            matchedTerms.some((term) => term.length >= 5)
          );
        })()
    ) ?? null
  );
}

function buildCityAnswerSummary(answerUtterances) {
  if (answerUtterances.length === 0) {
    return "";
  }

  return answerUtterances
    .slice(0, 2)
    .map((entry) => buildExcerpt(entry.text, 200))
    .join(" ");
}

function countBy(values) {
  const result = {};
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function buildCityAnswerAnchor(entry) {
  if (!entry) {
    return null;
  }

  return {
    utterance_id: entry.utterance_id ?? null,
    source_file: ANCHOR_SOURCE_FILE,
    speaker: entry.speaker_hint ?? null,
    speaker_role:
      entry.speaker_role_hint === "city" ? "city" : entry.speaker_role_hint === "executive" ? "executive" : "unknown",
    line_or_time_hint: formatLineHint(entry),
  };
}

function buildEntry(question, item, utterancesForItem, questionUtterances) {
  const directQuestionAnchor = chooseQuestionAnchor(utterancesForItem);
  const fallbackQuestionAnchor =
    directQuestionAnchor ?? chooseQuestionAnchorFallback(questionUtterances, utterancesForItem);
  const questionAnchor = directQuestionAnchor ?? fallbackQuestionAnchor;
  const usedFallbackQuestionAnchor =
    !directQuestionAnchor && Boolean(fallbackQuestionAnchor);
  const directAnswerUtterances = chooseAnswerUtterances(utterancesForItem);
  const unknownAnswerLikeUtterance =
    directAnswerUtterances.length === 0
      ? chooseUnknownAnswerLikeUtterance(utterancesForItem)
      : null;
  const nullItemProximityAnswer =
    directAnswerUtterances.length === 0 && !unknownAnswerLikeUtterance
      ? chooseNullItemProximityAnswer(
          questionUtterances,
          utterancesForItem,
          questionAnchor,
          item
        )
      : null;
  const selectedAnswerAnchor =
    directAnswerUtterances[0] ??
    unknownAnswerLikeUtterance ??
    nullItemProximityAnswer ??
    null;
  const answerAnchorSource = directAnswerUtterances.length > 0
    ? "direct_item_match"
    : unknownAnswerLikeUtterance
      ? "unknown_answer_like"
      : nullItemProximityAnswer
        ? "null_item_proximity"
        : "none";
  const answerAnchorConfidence =
    answerAnchorSource === "direct_item_match"
      ? "high"
      : answerAnchorSource === "unknown_answer_like"
        ? "medium"
        : "low";
  const answerUtterancesForSummary =
    directAnswerUtterances.length > 0
      ? directAnswerUtterances
      : selectedAnswerAnchor
        ? [selectedAnswerAnchor]
        : [];
  const riskFlags = [];

  if (!questionAnchor) {
    riskFlags.push("question_anchor_missing");
  } else if (usedFallbackQuestionAnchor) {
    riskFlags.push("question_anchor_fallback_used");
  } else if (questionAnchor.speaker_role_hint === "unknown") {
    riskFlags.push("speaker_role_unknown");
  }

  if (usedFallbackQuestionAnchor && questionAnchor?.speaker_role_hint === "unknown") {
    riskFlags.push("speaker_role_unknown");
  }

  if (!selectedAnswerAnchor) {
    riskFlags.push("city_answer_missing", "question_only");
  }
  if (answerAnchorSource === "unknown_answer_like") {
    riskFlags.push("answer_role_unknown");
  }
  if (answerAnchorSource === "null_item_proximity") {
    riskFlags.push("answer_anchor_low_confidence");
  }

  let reflectionType = "needs_review";
  let reflectionReason =
    "item 単位の target 判断と fact 抽出は、この inventory の後段で人間確認が必要です。";

  if (selectedAnswerAnchor && !(question.topic_slugs?.length > 0)) {
    reflectionType = "general_question_only";
    reflectionReason =
      "市側答弁 anchor はあるが、item 単位で既存 Topic への exact target は未確定のため、まず一般質問側の整理候補として扱います。";
  } else if (!selectedAnswerAnchor) {
    reflectionReason =
      "この inventory では市側答弁 anchor を機械的に確認できず、public reflection 候補としては保留です。";
  } else if (question.topic_slugs?.length > 0) {
    riskFlags.push("target_topic_uncertain");
    reflectionReason =
      "question 単位の topic_slugs はあるが、item 単位で既存 Topic へ exact に落とす判断はこの inventory では行いません。";
  }

  if (!selectedAnswerAnchor && !riskFlags.includes("question_only")) {
    riskFlags.push("question_only");
  }

  const unconfirmed = [];
  if (!questionAnchor) {
    unconfirmed.push(
      "question 側 anchor をこの inventory builder では機械的に特定できていません。"
    );
  }
  if (!selectedAnswerAnchor) {
    unconfirmed.push(
      "市側答弁 anchor をこの inventory builder では確認できていません。"
    );
  }
  if (questionAnchor?.speaker_role_hint === "unknown") {
    unconfirmed.push(
      "question 側 anchor の speaker role が unresolved のため、人間確認が必要です。"
    );
  }
  if (answerAnchorSource === "unknown_answer_like") {
    unconfirmed.push(
      "city/executive 側答弁 anchor は unknown answer-like として抽出しており、人間確認が必要です。"
    );
  }
  if (answerAnchorSource === "null_item_proximity") {
    unconfirmed.push(
      "city/executive 側答弁 anchor は item 番号未解決の近接 utterance から low confidence で抽出しています。"
    );
  }

  const confidence =
    answerAnchorSource === "direct_item_match" &&
    questionAnchor &&
    questionAnchor.speaker_role_hint !== "unknown"
      ? "medium"
      : "low";

  return {
    candidate_id: `${question.slug}.item${String(item.item_number).padStart(2, "0")}`,
    speaker_name: question.member_name_raw,
    speaker_role: "council_member",
    general_question_slug_or_id: question.slug,
    theme: item.title,
    question_summary: buildQuestionSummary(item),
    city_answer_summary: buildCityAnswerSummary(answerUtterancesForSummary),
    city_answer_anchor: buildCityAnswerAnchor(selectedAnswerAnchor),
    city_answer_excerpt: selectedAnswerAnchor
      ? buildExcerpt(selectedAnswerAnchor.text, 200)
      : "",
    city_answer_missing: !selectedAnswerAnchor,
    answer_anchor_confidence: answerAnchorConfidence,
    answer_anchor_source: answerAnchorSource,
    confirmed_facts: [],
    unconfirmed_or_not_decided: unconfirmed,
    recommended_reflection: {
      type: reflectionType,
      target_topic_slug: null,
      suggested_new_topic_slug: null,
      reason: reflectionReason,
    },
    risk_flags: Array.from(new Set(riskFlags)),
    anchor: {
      source_file: ANCHOR_SOURCE_FILE,
      quote_or_excerpt: questionAnchor ? buildExcerpt(questionAnchor.text) : "",
      speaker: questionAnchor?.speaker_hint ?? question.member_name_raw,
      line_or_time_hint: formatLineHint(questionAnchor),
    },
    confidence,
  };
}

function main() {
  const generalQuestions = loadJson(GENERAL_QUESTIONS_PATH);
  const utteranceIndex = loadJson(UTTERANCE_INDEX_PATH);
  const utterances = Array.isArray(utteranceIndex.utterances)
    ? utteranceIndex.utterances
    : [];

  const utterancesByQuestionAndItem = new Map();
  const utterancesByQuestion = new Map();
  for (const utterance of utterances) {
    if (utterance.question_slug) {
      const questionUtterances = utterancesByQuestion.get(utterance.question_slug) ?? [];
      questionUtterances.push(utterance);
      utterancesByQuestion.set(utterance.question_slug, questionUtterances);
    }

    if (!utterance.question_slug || !Number.isInteger(utterance.item_number_candidate)) {
      continue;
    }
    const key = `${utterance.question_slug}::${utterance.item_number_candidate}`;
    const current = utterancesByQuestionAndItem.get(key) ?? [];
    current.push(utterance);
    utterancesByQuestionAndItem.set(key, current);
  }

  const entries = [];
  for (const question of generalQuestions.questions ?? []) {
    const questionUtterances = (utterancesByQuestion.get(question.slug) ?? []).sort(
      (left, right) => (left.line_start ?? 0) - (right.line_start ?? 0)
    );
    for (const item of question.items ?? []) {
      const key = `${question.slug}::${item.item_number}`;
      const utterancesForItem = (utterancesByQuestionAndItem.get(key) ?? []).sort(
        (left, right) => (left.line_start ?? 0) - (right.line_start ?? 0)
      );
      entries.push(buildEntry(question, item, utterancesForItem, questionUtterances));
    }
  }

  const artifact = {
    schema_version: "candidate-inventory.v1",
    session: "令和8年第4回定例会",
    diet_session_slug: generalQuestions.diet_session_slug,
    generated_at: new Date().toISOString(),
    generated_from: [
      "docs/general_questions/r8-dai4-teireikai.general-questions.json",
      "docs/general_questions_minutes/utterance-index/r8-dai4-teireikai.utterances.json",
    ],
    summary: {
      general_question_count: (generalQuestions.questions ?? []).length,
      entry_count: entries.length,
      speaker_role_counts: countBy(entries.map((entry) => entry.speaker_role)),
      recommended_reflection_counts: countBy(
        entries.map((entry) => entry.recommended_reflection.type)
      ),
      risk_flag_counts: countBy(entries.flatMap((entry) => entry.risk_flags)),
    },
    entries,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(artifact.summary, null, 2)}\n`);
}

main();
