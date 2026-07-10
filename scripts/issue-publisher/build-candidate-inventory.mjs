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
  /ご質問にお答え|再質問にお答え|お答えいたします|お答えします|説明いたします|説明します|本市では|当局として/;
const QUESTION_PROMPT_REGEX =
  /ご答弁願います|答弁を求めます|お尋ねいたします|お伺いします|質問します|質問いたします/;
const EXECUTIVE_LABEL_REGEX = /課長|部長|市長|副市長|教育長|委員長|所長|局長|館長/;
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

const TERM_SPLIT_REGEX =
  /[・「」『』（）()\/、,，。\s]|について|における|どのように|並びに|及び|として|による|に対する|との|から|まで|ため|こと|もの|など|する|した|して|ある|いる/;
const FACT_CANDIDATE_SKIP_REGEX =
  /ご質問|再質問|お答えいたします|お答えします|答弁|続きまして|順を追って|まず|次に|以上です|以上で|項目目|議員の|議員ご質問|ご質問がありますので|ご質問がございますので/;
const FACT_CANDIDATE_FUTURE_OR_OPINION_REGEX =
  /考えております|考えています|考えます|認識しております|認識しています|認識している|予定しております|予定しています|予定です|見込んでおります|見込んでいます|努めてまいります|努めています|努めているところです|取り組んでまいります|取り組んでいます|取り組んでおります|検討してまいります|検討しています|必要があります|必要である|必要となります|想定しております|想定しています|方針です|したいと考えて|してまいりました/;
const FACT_CANDIDATE_QUESTION_REGEX =
  /ですか|でしょうか|伺います|お伺いします|お伺いいたします|お伺いしたいと思います|お聞きします|お聞きいたします|お尋ね|なぜ|求めます|願います|考えをお聞かせ|どうなっている|いかがですか/;
const FACT_CANDIDATE_EVALUATIVE_REGEX =
  /極めて|意義深い|重要|望ましい|必要である|受け止めております|受け止めています|高く評価しております|評価しております|評価しています/;
const FACT_CANDIDATE_DANGLING_ENDING_REGEX =
  /(?:によりますと|において|について|についてです|としては|としましては|ため|で|と|は)$/;
const FACT_CANDIDATE_CLOSED_ENDING_REGEX =
  /(?:です|ます|でした|ました|あります|ございます|であります|しております|しています|いたします|いたしました|となっています|となっております|行いました|実施しました|実施しております|開始しました|開始しております|完了しました|完了しております|設置されています|設置しております|継続しています)$/;
const FACT_CANDIDATE_GENERIC_ACTION_REGEX =
  /(?:関係部局と連携しながら対応しているところであります|今後も取り組んでまいります|適切に対応してまいります|努めてまいります|検討してまいります|推進してまいります|連携してまいります|対応しているところであります|待っているところでございます|受入れを行っています|指定できるとしています|取り組んでおります|努めているところです)$/;
const FACT_CANDIDATE_CONTEXT_DEPENDENT_REGEX =
  /これについて|このことについて|そのため|そのように|同事業|当該|これら|その後/;
const FACT_CANDIDATE_BARE_METRIC_REGEX =
  /^(?:件数|金額|寄付額|予算額|高齢化率|持ち家率|割合|人数|戸数|回数|約?[0-9０-９]+(?:\.[0-9０-９]+)?%?)(?:は|が|で|となって)/;
const FACT_CANDIDATE_BARE_HOUSEHOLD_REGEX =
  /^[0-9０-９一二三四五六七八九十]+人から[0-9０-９一二三四五六七八九十]+人世帯が/;
const FACT_CANDIDATE_TRANSCRIPTION_NOISE_REGEX =
  /証書類|観光町船|講習ごと|各部屋体育/;
const FACT_CANDIDATE_WEAK_ACTION_REGEX =
  /運行計画の見直しを検討していました|現在発注に係る事務手続きを進めております|計画としております|検討していました|進めております/;
const FACT_CANDIDATE_PLANNED_OR_INTENT_REGEX =
  /予定しているところです|予定しております|計画しております|見込んでおります|見込みです/;
const FACT_CANDIDATE_WEAK_SUBJECT_REGEX =
  /^(?:令和[0-9０-９一二三四五六七八九十]+年度の新規事業でございます|[1-3１２３一二三]つ目は|同年|[0-9０-９一二三四五六七八九十]+回目は)/;
const FACT_CANDIDATE_CONCRETE_KEYWORD_REGEX =
  /事業|制度|計画|条例|予算|助成|支援|給付|補助|工事|施設|病院|学校|公園|住宅|市営住宅|航路|ごみ袋|バース|食肉センター|交通|トイレ|税|寄附金|ふるさと納税|基金|バードピア|防犯灯|公設市場|公共交通計画|運動公園|クーポン|離島患者|職員宿舎|基本協定書|市民会館|登山道|文化財|避難施設|救急|診療体制|脳神経外科|外来診療|統計調査/;
const FACT_CANDIDATE_CONCRETE_ACTION_REGEX =
  /実施|開始|継続|助成|給付|配布|設置|整備|導入|発注|完了|決定|上程|規定|支給|利用|認定|寄贈|予約|寄港|対象|確保|派遣|設立|建設|締結|更新|運行|受診|診療|発足/;
const FACT_CANDIDATE_SELF_CONTAINED_SPECIFICITY_REGEX =
  /令和[0-9０-９一二三四五六七八九十]+年|[0-9０-９]{4}年|[0-9０-９]+月(?:[0-9０-９]+日)?|[0-9０-９]+(?:件|戸|人|円|%|％|便)|市営住宅|宿泊税|公共交通計画|地域公共交通|離島甲子園|ごみ袋|バードピア|公設市場|運動公園|職員宿舎|市民会館|診療体制|脳神経外科|外来診療|救急車|救助車|火葬場|下水道|介護認定|GIGA|サンゴ|請願/;

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

function hasExecutiveLabel(value) {
  return EXECUTIVE_LABEL_REGEX.test(normalizeWhitespace(value));
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
        .split(TERM_SPLIT_REGEX)
        .map((term) => term.trim())
        .filter(
          (term) => term.length >= 3 && !GENERIC_ANSWER_MATCH_TERMS.has(term)
        )
    )
  ).slice(0, 8);
}

function compactText(value) {
  return normalizeWhitespace(value).replace(/[・「」『』（）()\/、,，。:：]/g, "");
}

function extractSubItemMatchTerms(item) {
  return Array.from(
    new Set(
      (item.sub_items ?? [])
        .map(normalizeWhitespace)
        .join(" ")
        .split(TERM_SPLIT_REGEX)
        .map((term) => term.trim())
        .filter(
          (term) => term.length >= 3 && !GENERIC_ANSWER_MATCH_TERMS.has(term)
        )
    )
  ).slice(0, 8);
}

function extractThemeTerms(item) {
  return Array.from(
    new Set(
      [item.title, ...(item.sub_items ?? [])]
        .map(normalizeWhitespace)
        .join(" ")
        .split(TERM_SPLIT_REGEX)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2 && !GENERIC_ANSWER_MATCH_TERMS.has(term))
    )
  ).slice(0, 12);
}

function hasThemeOverlap(text, item) {
  const normalized = normalizeWhitespace(text);
  const themeTerms = extractThemeTerms(item);
  return themeTerms.some((term) => normalized.includes(term));
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

function buildRecoverableAnswerCandidate(entry, reason) {
  return {
    utterance_id: entry.utterance_id ?? null,
    source_file: ANCHOR_SOURCE_FILE,
    speaker: entry.speaker_hint ?? null,
    speaker_role:
      entry.speaker_role_hint === "city"
        ? "city"
        : entry.speaker_role_hint === "executive"
          ? "executive"
          : "unknown",
    excerpt: buildExcerpt(entry.text, 200),
    reason,
    confidence: "low",
  };
}

function buildConfirmedFactCandidate(fact, entry) {
  return {
    fact,
    utterance_id: entry.utterance_id ?? null,
    source_file: ANCHOR_SOURCE_FILE,
    speaker: entry.speaker_hint ?? null,
    speaker_role:
      entry.speaker_role_hint === "city"
        ? "city"
        : entry.speaker_role_hint === "executive"
          ? "executive"
          : "unknown",
    excerpt: buildExcerpt(entry.text, 200),
    reason: "direct_item_match_sentence",
    confidence: "medium",
  };
}

function splitFactCandidateSegments(text) {
  const raw = typeof text === "string" ? text : "";
  const lineSegments = raw
    .split(/\n+/)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);
  if (lineSegments.length > 1) {
    return lineSegments;
  }
  return normalizeWhitespace(raw)
    .split(/[。！？]/)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);
}

function sanitizeFactCandidateSegment(segment) {
  let text = normalizeWhitespace(segment);
  while (/^.*?(?:お答えいたします|お答えします)\s*/.test(text)) {
    text = text.replace(/^.*?(?:お答えいたします|お答えします)\s*/, "");
  }
  text = text.replace(/^(?:まず|次に|続きまして)\s*/, "");
  text = text.replace(
    /^[0-9０-９一二三四五六七八九十]+点目(?:.*?)(?:について|については)\s*/,
    ""
  );
  text = text.replace(/[、,，]+$/g, "");
  return normalizeWhitespace(text);
}

function looksLikeFactCandidateSegment(segment, item) {
  const normalized = sanitizeFactCandidateSegment(segment);
  if (!normalized || normalized.length < 12) {
    return false;
  }
  if (FACT_CANDIDATE_TRANSCRIPTION_NOISE_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_SKIP_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_WEAK_SUBJECT_REGEX.test(normalized)) {
    return false;
  }
  if (QUESTION_PROMPT_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_QUESTION_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_FUTURE_OR_OPINION_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_GENERIC_ACTION_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_EVALUATIVE_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_CONTEXT_DEPENDENT_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_BARE_METRIC_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_BARE_HOUSEHOLD_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_WEAK_ACTION_REGEX.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_PLANNED_OR_INTENT_REGEX.test(normalized)) {
    return false;
  }
  if (/については?$/.test(normalized)) {
    return false;
  }
  if (FACT_CANDIDATE_DANGLING_ENDING_REGEX.test(normalized)) {
    return false;
  }
  if (/^1点目|^2点目|^3点目|^4点目|^5点目/.test(normalized)) {
    return false;
  }
  if (!FACT_CANDIDATE_CLOSED_ENDING_REGEX.test(normalized)) {
    return false;
  }
  const hasConcreteKeyword = FACT_CANDIDATE_CONCRETE_KEYWORD_REGEX.test(normalized);
  const hasConcreteAction = FACT_CANDIDATE_CONCRETE_ACTION_REGEX.test(normalized);
  if (!hasConcreteKeyword && !hasConcreteAction) {
    return false;
  }
  const themeOverlap = hasThemeOverlap(normalized, item);
  const hasSelfContainedSpecificity =
    FACT_CANDIDATE_SELF_CONTAINED_SPECIFICITY_REGEX.test(normalized) &&
    (hasConcreteKeyword || hasConcreteAction);
  if (!themeOverlap && !hasSelfContainedSpecificity) {
    return false;
  }
  return true;
}

function collectConfirmedFactCandidates(
  directAnswerUtterances,
  answerAnchorSource,
  answerAnchorConfidence,
  cityAnswerMissing,
  item
) {
  if (
    answerAnchorSource !== "direct_item_match" ||
    answerAnchorConfidence !== "high" ||
    cityAnswerMissing
  ) {
    return [];
  }

  const candidates = [];
  const seen = new Set();
  for (const entry of directAnswerUtterances) {
    for (const segment of splitFactCandidateSegments(entry.text)) {
      if (!looksLikeFactCandidateSegment(segment, item)) {
        continue;
      }
      const normalized = sanitizeFactCandidateSegment(segment);
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      candidates.push(buildConfirmedFactCandidate(normalized, entry));
      if (candidates.length >= 3) {
        return candidates;
      }
    }
  }
  return candidates;
}

function scoreRelatedTerms(text, terms) {
  const normalized = normalizeWhitespace(text);
  const matchedTerms = terms.filter((term) => normalized.includes(term));
  return {
    matchedTerms,
    matchedCount: matchedTerms.length,
    hasLongTerm: matchedTerms.some((term) => term.length >= 5),
  };
}

function hasStrongRelatedTermMatch(text, terms) {
  const { matchedCount, hasLongTerm } = scoreRelatedTerms(text, terms);
  return matchedCount >= 2 || hasLongTerm;
}

function hasTitleOrSubItemMatch(text, item, terms) {
  const normalized = normalizeWhitespace(text);
  const compact = compactText(text);
  const titleCompact = compactText(item.title);
  const subItemTerms = extractSubItemMatchTerms(item);
  return (
    (titleCompact.length >= 5 && compact.includes(titleCompact)) ||
    subItemTerms.some((term) => normalized.includes(term)) ||
    hasStrongRelatedTermMatch(text, terms)
  );
}

function hasEarlyThematicMatch(text, item, terms) {
  return hasTitleOrSubItemMatch(normalizeWhitespace(text).slice(0, 180), item, terms);
}

function collectRecoverableAnswerCandidates(
  questionUtterances,
  utterancesForItem,
  questionAnchor,
  item,
  selectedAnswerAnchor
) {
  if (selectedAnswerAnchor) {
    return [];
  }

  const terms = extractAnswerMatchTerms(item);
  const lineCandidates = [
    ...utterancesForItem
      .map((entry) => entry?.line_end)
      .filter((value) => typeof value === "number"),
    typeof questionAnchor?.line_end === "number" ? questionAnchor.line_end : null,
  ].filter((value) => typeof value === "number");
  const referenceLine =
    lineCandidates.length > 0 ? Math.max(...lineCandidates) : null;
  const nextNumberedLine =
    typeof referenceLine === "number"
      ? questionUtterances
          .filter(
            (entry) =>
              Number.isInteger(entry.item_number_candidate) &&
              entry.item_number_candidate > item.item_number &&
              typeof entry.line_start === "number" &&
              entry.line_start > referenceLine
          )
          .map((entry) => entry.line_start)
          .sort((left, right) => left - right)[0]
      : null;

  const candidates = [];
  const seen = new Set();
  const pushCandidate = (entry, reason) => {
    if (!entry?.utterance_id || seen.has(entry.utterance_id)) {
      return;
    }
    seen.add(entry.utterance_id);
    candidates.push(buildRecoverableAnswerCandidate(entry, reason));
  };

  for (const entry of questionUtterances) {
    const text = normalizeWhitespace(entry?.text);
    const looksAnswerLike = isAnswerLikeText(entry);
    const strongMatch =
      terms.length > 0 && hasTitleOrSubItemMatch(text, item, terms);
    const lineStart = typeof entry?.line_start === "number" ? entry.line_start : null;
    const afterReference =
      typeof referenceLine !== "number" ||
      (typeof lineStart === "number" && lineStart > referenceLine);

    if (
      looksAnswerLike &&
      hasExecutiveLabel(`${entry?.speaker_hint ?? ""} ${text}`) &&
      (entry?.speech_kind === "question_item" || entry?.speaker_role_hint === "unknown") &&
      (strongMatch || terms.length === 0)
    ) {
      pushCandidate(entry, "segmentation_mixed");
      continue;
    }

    if (
      entry?.item_number_candidate === null &&
      afterReference &&
      isPotentialAnswerAnchor(entry) &&
      strongMatch &&
      hasEarlyThematicMatch(text, item, terms)
    ) {
      const reason =
        typeof referenceLine === "number" &&
        typeof nextNumberedLine === "number" &&
        typeof lineStart === "number" &&
        lineStart > nextNumberedLine
          ? "later_followup_answer"
          : "null_item_proximity";
      pushCandidate(entry, reason);
    }
  }

  return candidates.slice(0, 3);
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
  const recoverableAnswerCandidates = collectRecoverableAnswerCandidates(
    questionUtterances,
    utterancesForItem,
    questionAnchor,
    item,
    selectedAnswerAnchor
  );
  const confirmedFactCandidates = collectConfirmedFactCandidates(
    directAnswerUtterances,
    answerAnchorSource,
    answerAnchorConfidence,
    !selectedAnswerAnchor,
    item
  );
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
    recoverable_answer_candidates: recoverableAnswerCandidates,
    confirmed_fact_candidates: confirmedFactCandidates,
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
