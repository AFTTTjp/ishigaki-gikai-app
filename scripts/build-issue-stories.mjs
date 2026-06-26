#!/usr/bin/env node

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULT_EDITORIAL_DECISIONS_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-editorial-decisions.json"
);
const DEFAULT_REVIEW_PACKET_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-review-packet.json"
);
const DEFAULT_ISSUE_GRAPH_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-graph-pilot.json"
);
const DEFAULT_CANONICAL_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.canonical.json"
);
const DEFAULT_PUBLIC_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions/r8-dai4-teireikai.general-questions.json"
);
const DEFAULT_TOPIC_DIR = resolve(ROOT, "docs/ishigaki_gikai_topics_dev_set");
const DEFAULT_OUTPUT_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-stories.json"
);
const DEFAULT_OUTPUT_DIR = resolve(
  ROOT,
  "docs/general_questions_minutes/issue-stories/r8-dai4"
);

const EXPECTED_ISSUE_IDS = [
  "issue-r8d4-keelung-route",
  "issue-r8d4-rito-koshien",
  "issue-r8d4-former-cityhall",
  "issue-r8d4-lodging-tax-finance",
  "issue-r8d4-municipal-housing",
  "issue-r8d4-school-education",
  "issue-r8d4-disaster-fire-rescue",
];

const CONFIDENCE_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
  unknown: 3,
};

const GENERIC_OR_PROCEDURAL_PATTERNS = [
  /最後から\d+番目の質問者/,
  /質問者となりました/,
  /^(次に|続いて|最後に|では|そこで|また|なお)(\s|$)/,
  /^(?:大きな質問の)?\s*\d+\s*(?:項目目|点目|番目)\s*$/,
  /^\d+\s*(?:項目目|点目|番目)\s*$/,
  /次に移ります/,
  /削除します/,
  /議事進行/,
  /一般質問/,
  /見解をお伺いします$/,
  /認識をお伺いします$/,
  /ご答弁願います$/,
  /ご説明願います$/,
  /お伺いします$/,
  /お伺いいたします$/,
  /質問を行います$/,
  /質問します$/,
];

const KEYWORD_STOP_PHRASES = new Set([
  "について",
  "に関する",
  "及び",
  "並びに",
  "課題",
  "現状",
  "状況",
  "考え",
  "見解",
  "取組",
  "取り組み",
  "活用",
  "計画",
  "行政",
  "支援",
]);

function parseArgs(argv) {
  const options = {
    editorialDecisionsPath: DEFAULT_EDITORIAL_DECISIONS_PATH,
    reviewPacketPath: DEFAULT_REVIEW_PACKET_PATH,
    issueGraphPath: DEFAULT_ISSUE_GRAPH_PATH,
    canonicalJsonPath: DEFAULT_CANONICAL_JSON_PATH,
    publicJsonPath: DEFAULT_PUBLIC_JSON_PATH,
    topicDir: DEFAULT_TOPIC_DIR,
    outputJsonPath: DEFAULT_OUTPUT_JSON_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--editorial-decisions") {
      options.editorialDecisionsPath = resolve(argv[++index]);
      continue;
    }
    if (arg === "--review-packet") {
      options.reviewPacketPath = resolve(argv[++index]);
      continue;
    }
    if (arg === "--issue-graph") {
      options.issueGraphPath = resolve(argv[++index]);
      continue;
    }
    if (arg === "--canonical-json") {
      options.canonicalJsonPath = resolve(argv[++index]);
      continue;
    }
    if (arg === "--public-json") {
      options.publicJsonPath = resolve(argv[++index]);
      continue;
    }
    if (arg === "--topic-dir") {
      options.topicDir = resolve(argv[++index]);
      continue;
    }
    if (arg === "--output-json") {
      options.outputJsonPath = resolve(argv[++index]);
      continue;
    }
    if (arg === "--output-dir") {
      options.outputDir = resolve(argv[++index]);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function toStorySlug(issueId) {
  return issueId.replace(/^issue-r8d4-/, "");
}

function readTopics(topicDir) {
  const topics = new Map();
  for (const entry of readdirSync(topicDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".topic.json")) {
      continue;
    }
    const filePath = path.join(topicDir, entry.name);
    const data = readJson(filePath);
    topics.set(data.topic_slug, {
      topic_slug: data.topic_slug,
      topic_title: data.topic_title,
      topic_status: data.topic_status,
      source_file: filePath,
    });
  }
  return topics;
}

function countReviewFlags(reviewFlags) {
  return {
    hallucination_like: reviewFlags.hallucination_like.length,
    short_fragments: reviewFlags.short_fragments.length,
    name_or_title_variants: reviewFlags.name_or_title_variants.length,
    possible_asr_errors: reviewFlags.possible_asr_errors.length,
    needs_human_review: reviewFlags.needs_human_review.length,
  };
}

function totalReviewFlags(reviewCounts) {
  return Object.values(reviewCounts).reduce((sum, count) => sum + count, 0);
}

function buildPublicQuestionMap(publicData) {
  const map = new Map();
  for (const question of publicData.questions) {
    const items = new Map();
    for (const item of question.items) {
      items.set(item.item_number, item);
    }
    map.set(question.slug, { ...question, _items: items });
  }
  return map;
}

function buildCanonicalQuestionMap(canonicalData) {
  const map = new Map();
  for (const question of canonicalData.questions) {
    const byItemNumber = new Map();
    for (const candidate of question.question_items) {
      if (candidate.item_number === undefined) {
        continue;
      }
      const bucket = byItemNumber.get(candidate.item_number) ?? [];
      bucket.push(candidate);
      byItemNumber.set(candidate.item_number, bucket);
    }
    const reviewCounts = countReviewFlags(question.review_flags);
    map.set(question.slug, {
      ...question,
      _byItemNumber: byItemNumber,
      _reviewCounts: reviewCounts,
      _reviewRequired: totalReviewFlags(reviewCounts) > 0,
    });
  }
  return map;
}

function buildIssueMap(data) {
  const map = new Map();
  for (const issue of data.issues) {
    map.set(issue.issue_id, issue);
  }
  return map;
}

function validateIssueIds(editorialData, reviewPacket, issueGraph) {
  const editorialIds = editorialData.summary.issue_ids;
  const reviewIds = reviewPacket.summary.issue_ids;
  const graphIds = issueGraph.issues.map((issue) => issue.issue_id);
  if (JSON.stringify(editorialIds) !== JSON.stringify(EXPECTED_ISSUE_IDS)) {
    throw new Error("Editorial decisions issue ids do not match expected pilot 7");
  }
  if (JSON.stringify(reviewIds) !== JSON.stringify(EXPECTED_ISSUE_IDS)) {
    throw new Error("Issue review packet ids do not match expected pilot 7");
  }
  if (JSON.stringify(graphIds) !== JSON.stringify(EXPECTED_ISSUE_IDS)) {
    throw new Error("Issue graph ids do not match expected pilot 7");
  }
}

function confidenceLabel(value) {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "unknown";
}

function rankCandidate(a, b) {
  const confidenceDiff =
    CONFIDENCE_ORDER[confidenceLabel(a.confidence)] -
    CONFIDENCE_ORDER[confidenceLabel(b.confidence)];
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }
  return normalizeText(b.raw_anchor_text).length - normalizeText(a.raw_anchor_text).length;
}

function pickCanonicalAnchor(canonicalQuestion, itemNumber) {
  const candidates = canonicalQuestion?._byItemNumber.get(itemNumber) ?? [];
  if (candidates.length === 0) {
    return null;
  }
  return [...candidates].sort(rankCandidate)[0];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy(values, getKey) {
  const seen = new Set();
  const results = [];
  for (const value of values) {
    const key = getKey(value);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(value);
  }
  return results;
}

function stripHeadingSuffix(text) {
  return normalizeText(text)
    .replace(/について.*$/u, "")
    .replace(/に関する.*$/u, "")
    .replace(/についての.*$/u, "")
    .replace(/における.*$/u, "")
    .replace(/並びに.*$/u, "")
    .replace(/及び.*$/u, "")
    .trim();
}

function extractReferencePhrases(values) {
  const phrases = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) {
      continue;
    }

    const stripped = stripHeadingSuffix(normalized);
    if (stripped.length >= 2 && !KEYWORD_STOP_PHRASES.has(stripped)) {
      phrases.push(stripped);
    }

    const parts = normalized
      .replace(/[「」『』（）()]/g, " ")
      .split(/[、,・/]/)
      .map((part) => stripHeadingSuffix(part))
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter((part) => part.length >= 2 && !KEYWORD_STOP_PHRASES.has(part));

    phrases.push(...parts);
  }

  return unique(phrases);
}

function extractSalientKeywords(phrases) {
  const keywords = [];

  for (const phrase of phrases) {
    const normalized = normalizeText(phrase);
    if (normalized.length >= 2 && normalized.length <= 16) {
      keywords.push(normalized);
    }

    const chunks = normalized.match(/[一-龠ぁ-んァ-ヶA-Za-z0-9]{2,}/g) ?? [];
    for (const chunk of chunks) {
      if (!KEYWORD_STOP_PHRASES.has(chunk)) {
        keywords.push(chunk);
      }
      if (chunk.length >= 4) {
        keywords.push(chunk.slice(0, 2));
        keywords.push(chunk.slice(-2));
      }
    }
  }

  return unique(
    keywords.filter(
      (keyword) =>
        keyword.length >= 2 &&
        !KEYWORD_STOP_PHRASES.has(keyword) &&
        !/^(項目目|点目|番目|質問|答弁|説明|見解|認識|現状)$/.test(keyword)
    )
  );
}

function isGenericOrProceduralAnchor(anchorText) {
  const normalized = normalizeText(anchorText);
  if (!normalized) {
    return true;
  }

  if (normalized.length <= 6) {
    return true;
  }

  return GENERIC_OR_PROCEDURAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildVerificationContext(issueGraphIssue, ref, item) {
  return {
    issueTitle: issueGraphIssue.title,
    itemTitle: ref.item_title ?? item?.title ?? null,
    subItemText:
      ref.sub_item_text ??
      (item && ref.subItemIndex !== null && ref.subItemIndex !== undefined
        ? item.sub_items?.[ref.subItemIndex] ?? null
        : null),
  };
}

function scoreCandidateAgainstContext(anchorText, verificationContext) {
  const normalizedAnchor = normalizeText(anchorText);
  const referenceTexts = [
    { source: "item", text: verificationContext.itemTitle },
    { source: "sub_item", text: verificationContext.subItemText },
    { source: "issue", text: verificationContext.issueTitle },
  ].filter((row) => row.text);
  const phrases = uniqueBy(
    referenceTexts.flatMap(({ source, text }) =>
      extractReferencePhrases([text]).map((phrase) => ({ source, text: phrase }))
    ),
    (row) => `${row.source}\t${row.text}`
  );
  const keywords = uniqueBy(
    referenceTexts.flatMap(({ source, text }) =>
      extractSalientKeywords(extractReferencePhrases([text])).map((keyword) => ({
        source,
        text: keyword,
      }))
    ),
    (row) => `${row.source}\t${row.text}`
  );

  const phraseMatches = phrases.filter(
    (phrase) => phrase.text.length >= 3 && normalizedAnchor.includes(phrase.text)
  );
  const keywordMatches = keywords.filter((keyword) => normalizedAnchor.includes(keyword.text));
  const score = phraseMatches.length * 4 + keywordMatches.length;

  return {
    score,
    phraseMatches,
    keywordMatches,
  };
}

function verifyCandidateAnchor(candidate, verificationContext) {
  const normalizedAnchor = normalizeText(candidate.raw_anchor_text);
  if (!normalizedAnchor) {
    return {
      accepted: false,
      reason: "empty anchor",
      score: 0,
      phraseMatches: [],
      keywordMatches: [],
    };
  }

  const match = scoreCandidateAgainstContext(candidate.raw_anchor_text, verificationContext);
  const procedural = isGenericOrProceduralAnchor(candidate.raw_anchor_text);
  const itemAwarePhraseMatches = match.phraseMatches.filter((row) => row.source !== "issue");
  const nonGenericKeywordMatches = unique(
    match.keywordMatches.map((row) => row.text).filter((keyword) => !KEYWORD_STOP_PHRASES.has(keyword))
  );
  const hasStrongMatch = itemAwarePhraseMatches.length > 0 || nonGenericKeywordMatches.length >= 2;

  if (procedural && !hasStrongMatch) {
    return {
      accepted: false,
      reason: "generic or procedural anchor",
      ...match,
    };
  }

  if (!hasStrongMatch) {
    return {
      accepted: false,
      reason: "item-aware verification did not find item/sub-item phrase match or 2+ keyword overlap",
      ...match,
    };
  }

  return {
    accepted: true,
    reason:
      itemAwarePhraseMatches.length > 0
        ? "item/sub-item phrase match"
        : "multi-keyword match",
    ...match,
  };
}

function rankVerifiedCandidate(a, b) {
  const scoreDiff = b.verification.score - a.verification.score;
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const confidenceDiff =
    CONFIDENCE_ORDER[confidenceLabel(a.candidate.confidence)] -
    CONFIDENCE_ORDER[confidenceLabel(b.candidate.confidence)];
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }

  return normalizeText(b.candidate.raw_anchor_text).length -
    normalizeText(a.candidate.raw_anchor_text).length;
}

function collectReferenceOnlyAnchors(issueGraphIssue, questionSlug, verificationContext) {
  const evidence = issueGraphIssue.evidence_anchors.find(
    (anchor) => anchor.questionSlug === questionSlug
  );
  if (!evidence) {
    return [];
  }

  const anchors = [];
  for (const rawAnchorText of evidence.raw_anchor_texts ?? []) {
    const normalized = normalizeText(rawAnchorText);
    if (!normalized) {
      continue;
    }
    if (isGenericOrProceduralAnchor(normalized)) {
      continue;
    }
    const verification = verifyCandidateAnchor(
      { raw_anchor_text: normalized, confidence: "low" },
      verificationContext
    );
    if (!verification.accepted) {
      continue;
    }
    anchors.push({
      raw_anchor_text: normalized,
      confidence: "low",
      source: "reference_only",
      note: evidence.note ?? null,
      verification,
    });
  }

  return anchors;
}

function resolveRelatedQuestion(ref, issueGraphIssue, publicQuestionMap, canonicalQuestionMap) {
  const publicQuestion = publicQuestionMap.get(ref.questionSlug);
  const canonicalQuestion = canonicalQuestionMap.get(ref.questionSlug);
  const item = publicQuestion?._items.get(ref.itemNumber);
  const verificationContext = buildVerificationContext(issueGraphIssue, ref, item);
  const canonicalCandidates = canonicalQuestion?._byItemNumber.get(ref.itemNumber) ?? [];
  const verifiedCandidates = canonicalCandidates
    .map((candidate) => ({
      candidate,
      verification: verifyCandidateAnchor(candidate, verificationContext),
    }))
    .filter((row) => row.verification.accepted)
    .sort(rankVerifiedCandidate);
  const chosenAnchor =
    verifiedCandidates.length > 0
      ? {
          raw_anchor_text: verifiedCandidates[0].candidate.raw_anchor_text,
          confidence: confidenceLabel(verifiedCandidates[0].candidate.confidence),
          source: "canonical_question_items",
          note: null,
        }
      : null;
  const referenceOnlyAnchors = collectReferenceOnlyAnchors(
    issueGraphIssue,
    ref.questionSlug,
    verificationContext
  ).filter((anchor) => anchor.raw_anchor_text !== chosenAnchor?.raw_anchor_text);
  const anchor_status = chosenAnchor ? "verified" : "needs_review";

  return {
    member_name: ref.member_name_raw ?? ref.member ?? publicQuestion?.member_name_raw ?? null,
    question_slug: ref.questionSlug,
    item_number: ref.itemNumber,
    sub_item_index: ref.subItemIndex ?? null,
    item_title: ref.item_title ?? item?.title ?? null,
    sub_item_text:
      ref.sub_item_text ??
      (item && ref.subItemIndex !== null && ref.subItemIndex !== undefined
        ? item.sub_items?.[ref.subItemIndex] ?? null
        : null),
    anchor_text: chosenAnchor?.raw_anchor_text ?? null,
    anchor_confidence: chosenAnchor?.confidence ?? "unknown",
    anchor_source: chosenAnchor?.source ?? "unresolved",
    anchor_note: chosenAnchor?.note ?? null,
    anchor_status,
    reference_only_anchors: referenceOnlyAnchors.map((anchor) => ({
      raw_anchor_text: anchor.raw_anchor_text,
      confidence: anchor.confidence,
      source: anchor.source,
      note: anchor.note,
    })),
    review_required:
      !ref.resolved ||
      anchor_status !== "verified" ||
      Boolean(canonicalQuestion?._reviewRequired),
    question_review_flags_count: canonicalQuestion?._reviewCounts ?? null,
    source_minutes_file: canonicalQuestion?.source_minutes_file ?? null,
    resolved: Boolean(ref.resolved),
  };
}

function buildRelatedBills(editorialIssue, reviewPacketIssue) {
  const results = [];

  for (const bill of editorialIssue.confirmed_bills) {
    results.push({
      bill_number: bill.bill_number,
      bill_name: bill.bill_name,
      committee: bill.committee ?? null,
      status: "confirmed",
      note: bill.note ?? null,
    });
  }

  for (const bill of editorialIssue.candidate_bills) {
    results.push({
      bill_number: bill.bill_number,
      bill_name: bill.bill_name,
      committee: bill.committee ?? null,
      status: "candidate",
      note: bill.note ?? null,
    });
  }

  if (results.length === 0) {
    results.push({
      bill_number: null,
      bill_name: null,
      committee: null,
      status: "unresolved",
      note:
        reviewPacketIssue.related_bills.length === 0
          ? "pilot source に related_bills が設定されていません"
          : "関連議案はありますが editorial decision 側で未確定です",
    });
  }

  return results;
}

function buildRelatedTopics(editorialIssue, reviewPacketIssue, topicsBySlug) {
  const results = [];

  for (const topic of editorialIssue.confirmed_topics) {
    const topicInfo = topicsBySlug.get(topic.topic_slug);
    results.push({
      topic_slug: topic.topic_slug,
      title: topic.topic_title ?? topicInfo?.topic_title ?? null,
      status: "confirmed",
      note: topic.note ?? null,
    });
  }

  for (const topic of editorialIssue.candidate_topics) {
    const topicInfo = topicsBySlug.get(topic.topic_slug);
    results.push({
      topic_slug: topic.topic_slug,
      title: topic.topic_title ?? topicInfo?.topic_title ?? null,
      status: "candidate",
      note: topic.note ?? null,
    });
  }

  for (const topic of editorialIssue.new_topic_candidates) {
    results.push({
      topic_slug: null,
      title: topic.proposed_title,
      status: "new",
      note: topic.note ?? null,
    });
  }

  if (results.length === 0) {
    results.push({
      topic_slug: null,
      title: null,
      status: "unresolved",
      note:
        reviewPacketIssue.related_topics.length === 0
          ? "pilot source に related_topics が設定されていません"
          : "関連 topic はありますが editorial decision 側で未確定です",
    });
  }

  return results;
}

function buildCommitteeContext(relatedBills) {
  const committeeMap = new Map();
  for (const bill of relatedBills) {
    if (!bill.committee) {
      continue;
    }
    const row = committeeMap.get(bill.committee) ?? {
      committee_name: bill.committee,
      bill_numbers: [],
    };
    row.bill_numbers.push(bill.bill_number);
    committeeMap.set(bill.committee, row);
  }

  if (committeeMap.size === 0) {
    return {
      committees: [],
      note: "bill 経由で確認できる委員会候補はありません",
    };
  }

  return {
    committees: [...committeeMap.values()],
    note: "bill に付属する委員会名のみを記載しています",
  };
}

function listToSentence(values) {
  const filtered = values.map((value) => normalizeText(value)).filter(Boolean);
  if (filtered.length === 0) {
    return "該当なし";
  }
  return filtered.join("、");
}

function summarizeBills(relatedBills) {
  return relatedBills
    .map((bill) => {
      if (!bill.bill_number) {
        return "未確定";
      }
      return `${bill.bill_number}（${bill.status}）`;
    })
    .join("、");
}

function summarizeTopics(relatedTopics) {
  return relatedTopics
    .map((topic) => {
      const label = topic.topic_slug ?? topic.title ?? "未確定";
      return `${label}（${topic.status}）`;
    })
    .join("、");
}

function buildWhyItMatters(issueGraphIssue, relatedBills, relatedTopics) {
  const questionCount = issueGraphIssue.related_general_question_items.length;
  const billSummary = summarizeBills(relatedBills);
  const topicSummary = summarizeTopics(relatedTopics);
  return [
    `この issue は「${issueGraphIssue.citizen_question}」という市民向けの問いに対して、今会期でどの一般質問と議案候補が結び付いていたかを確認するための review draft です。`,
    `一般質問の参照件数は ${questionCount} 件で、関連議案は ${billSummary}、関連 topic は ${topicSummary} と整理されています。`,
  ].join(" ");
}

function buildWhatWasDiscussed(
  issueGraphIssue,
  relatedQuestions,
  relatedBills,
  relatedTopics,
  committeeContext,
  editorialIssue
) {
  const lines = [];
  const questionTitles = relatedQuestions
    .map((question) =>
      question.item_title
        ? `${question.member_name}「${question.item_title}」`
        : question.member_name
    )
    .filter(Boolean);
  lines.push(`一般質問では ${listToSentence(questionTitles)} がこの issue に関連付けられています。`);
  lines.push(`関連議案の整理は ${summarizeBills(relatedBills)} です。`);
  lines.push(`関連 topic の整理は ${summarizeTopics(relatedTopics)} です。`);
  if (committeeContext.committees.length > 0) {
    lines.push(
      `委員会文脈として ${committeeContext.committees
        .map((row) => `${row.committee_name}（${row.bill_numbers.join("、")}）`)
        .join("、")} が確認できます。`
    );
  } else {
    lines.push("bill 経由で確認できる委員会候補はありません。");
  }
  if (editorialIssue.split_notes.length > 0) {
    lines.push("この issue は分割前提の確認が必要です。");
  }
  return lines;
}

function buildReviewNotes(issueGraphIssue, editorialIssue, relatedQuestions) {
  const notes = [];
  notes.push(...editorialIssue.editor_notes);
  notes.push(...editorialIssue.next_action);
  if (issueGraphIssue.evidence_anchors.length > 0) {
    notes.push("question-level の evidence anchor は reference_only 扱いで、採用 anchor には使っていません。");
  }
  if (relatedQuestions.some((question) => question.review_required)) {
    notes.push("related_questions には item-aware verification を通過しなかった行が含まれています。");
  }
  return notes;
}

function buildNormalDraft(story) {
  const questionSummary = story.related_questions
    .map((question) =>
      question.item_title ? `${question.member_name}の「${question.item_title}」` : question.member_name
    )
    .slice(0, 5)
    .join("、");
  const billSummary = summarizeBills(story.related_bills);
  const splitNote =
    story.current_editorial_status === "needs_split"
      ? " この issue は論点が広いため、分割して読む前提で確認が必要です。"
      : "";
  return [
    "【review draft / normal】",
    `${story.title}について、今会期では ${questionSummary || "関連質問"} が参照されています。`,
    `関連議案の整理は ${billSummary} で、答弁内容や論点の切り分けは evidence anchor と原文で要確認です。${splitNote}`.trim(),
  ].join(" ");
}

function buildHardDraft(story) {
  const billSummary = summarizeBills(story.related_bills);
  const topicSummary = summarizeTopics(story.related_topics);
  const unresolvedCount = story.related_questions.filter((question) => question.review_required).length;
  return [
    "【review draft / hard】",
    `current editorial status は ${story.current_editorial_status} です。`,
    `related_questions は ${story.related_questions.length} 件で、anchor の review_required は ${unresolvedCount} 件あります。`,
    `関連議案は ${billSummary}、関連 topic は ${topicSummary} と整理しています。`,
    "市の答弁内容や因果関係の断定はしておらず、原文確認用の下書きとして扱ってください。",
  ].join(" ");
}

function buildEvidenceAnchors(relatedQuestions) {
  const anchors = [];

  for (const question of relatedQuestions) {
    if (!question.anchor_text) {
      continue;
    }
    anchors.push({
      question_slug: question.question_slug,
      member_name: question.member_name,
      anchor_text: question.anchor_text,
      confidence: question.anchor_confidence,
      source: question.anchor_source,
      review_required: question.review_required,
    });

    for (const referenceOnly of question.reference_only_anchors ?? []) {
      anchors.push({
        question_slug: question.question_slug,
        member_name: question.member_name,
        anchor_text: referenceOnly.raw_anchor_text,
        confidence: referenceOnly.confidence,
        source: referenceOnly.source,
        review_required: true,
        note: referenceOnly.note ?? null,
      });
    }
  }

  const seen = new Set();
  return anchors.filter((anchor) => {
    const key = `${anchor.question_slug}\t${anchor.anchor_text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildStory(issueId, context) {
  const editorialIssue = context.editorialMap.get(issueId);
  const reviewPacketIssue = context.reviewPacketMap.get(issueId);
  const issueGraphIssue = context.issueGraphMap.get(issueId);

  if (!editorialIssue || !reviewPacketIssue || !issueGraphIssue) {
    throw new Error(`Missing issue source for ${issueId}`);
  }

  const relatedQuestions = reviewPacketIssue.related_general_question_items.map((ref) =>
    resolveRelatedQuestion(ref, issueGraphIssue, context.publicQuestionMap, context.canonicalQuestionMap)
  );
  const relatedBills = buildRelatedBills(editorialIssue, reviewPacketIssue);
  const relatedTopics = buildRelatedTopics(
    editorialIssue,
    reviewPacketIssue,
    context.topicsBySlug
  );
  const committeeContext = buildCommitteeContext(relatedBills);
  const evidenceAnchors = buildEvidenceAnchors(relatedQuestions);
  const anchor_selection_status = editorialIssue.split_notes.length > 0
    ? "split_recommended"
    : relatedQuestions.every((question) => question.anchor_status === "verified")
      ? "verified"
      : "needs_review";
  const reviewRequired =
    anchor_selection_status !== "verified" ||
    editorialIssue.editorial_status !== "ready_for_keypoint_draft" ||
    relatedQuestions.some((question) => question.review_required) ||
    relatedBills.some((bill) => bill.status !== "confirmed") ||
    relatedTopics.some((topic) => topic.status !== "confirmed");

  const story = {
    issue_id: issueId,
    story_slug: toStorySlug(issueId),
    title: issueGraphIssue.title,
    citizen_question: issueGraphIssue.citizen_question,
    why_it_matters: buildWhyItMatters(issueGraphIssue, relatedBills, relatedTopics),
    what_was_discussed_this_session: buildWhatWasDiscussed(
      issueGraphIssue,
      relatedQuestions,
      relatedBills,
      relatedTopics,
      committeeContext,
      editorialIssue
    ),
    related_questions: relatedQuestions,
    related_bills: relatedBills,
    related_topics: relatedTopics,
    committee_context: committeeContext,
    current_editorial_status: editorialIssue.editorial_status,
    anchor_selection_status,
    review_required: reviewRequired,
    review_notes: buildReviewNotes(issueGraphIssue, editorialIssue, relatedQuestions),
    normal_draft: "",
    hard_draft: "",
    evidence_anchors: evidenceAnchors,
    split_warning:
      editorialIssue.split_notes.length > 0
        ? {
            required: true,
            notes: editorialIssue.split_notes,
          }
        : {
            required: false,
            notes: [],
          },
    confidence_summary: {
      high: relatedQuestions.filter((question) => question.anchor_confidence === "high").length,
      medium: relatedQuestions.filter((question) => question.anchor_confidence === "medium").length,
      low: relatedQuestions.filter((question) => question.anchor_confidence === "low").length,
      unknown: relatedQuestions.filter((question) => question.anchor_confidence === "unknown").length,
    },
  };

  story.normal_draft = buildNormalDraft(story);
  story.hard_draft = buildHardDraft(story);
  return story;
}

function renderStoryMarkdown(story) {
  const lines = [];
  lines.push(`# ${story.title}`);
  lines.push("");
  lines.push(`- issue_id: \`${story.issue_id}\``);
  lines.push(`- current_editorial_status: \`${story.current_editorial_status}\``);
  lines.push(`- anchor_selection_status: \`${story.anchor_selection_status}\``);
  lines.push(`- review_required: \`${story.review_required ? "true" : "false"}\``);
  lines.push(
    `- confidence_summary: high=${story.confidence_summary.high}, medium=${story.confidence_summary.medium}, low=${story.confidence_summary.low}, unknown=${story.confidence_summary.unknown}`
  );
  lines.push("");
  lines.push("## Citizen Question");
  lines.push("");
  lines.push(story.citizen_question);
  lines.push("");
  lines.push("## Why It Matters");
  lines.push("");
  lines.push(story.why_it_matters);
  lines.push("");
  lines.push("## What Was Discussed This Session");
  lines.push("");
  for (const line of story.what_was_discussed_this_session) {
    lines.push(`- ${line}`);
  }
  lines.push("");
  lines.push("## Related Questions");
  lines.push("");
  lines.push("| Member | Question Slug | Item | Sub Item | Anchor | Status | Confidence | Review Required | Reference Only |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const question of story.related_questions) {
    lines.push(
      `| ${escapeMarkdown(question.member_name ?? "")} | ${escapeMarkdown(question.question_slug)} | ${escapeMarkdown(question.item_title ?? "")} | ${escapeMarkdown(question.sub_item_text ?? "")} | ${escapeMarkdown(question.anchor_text ?? "要確認")} | ${escapeMarkdown(question.anchor_status)} | ${escapeMarkdown(question.anchor_confidence)} | ${question.review_required ? "yes" : "no"} | ${escapeMarkdown((question.reference_only_anchors ?? []).map((anchor) => anchor.raw_anchor_text).join(" / "))} |`
    );
  }
  lines.push("");
  lines.push("## Related Bills");
  lines.push("");
  lines.push("| Bill Number | Bill Name | Committee | Status | Note |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const bill of story.related_bills) {
    lines.push(
      `| ${escapeMarkdown(bill.bill_number ?? "未確定")} | ${escapeMarkdown(bill.bill_name ?? "未確定")} | ${escapeMarkdown(bill.committee ?? "")} | ${escapeMarkdown(bill.status)} | ${escapeMarkdown(bill.note ?? "")} |`
    );
  }
  lines.push("");
  lines.push("## Related Topics");
  lines.push("");
  lines.push("| Topic Slug | Title | Status | Note |");
  lines.push("| --- | --- | --- | --- |");
  for (const topic of story.related_topics) {
    lines.push(
      `| ${escapeMarkdown(topic.topic_slug ?? "未確定")} | ${escapeMarkdown(topic.title ?? "未確定")} | ${escapeMarkdown(topic.status)} | ${escapeMarkdown(topic.note ?? "")} |`
    );
  }
  lines.push("");
  lines.push("## Committee Context");
  lines.push("");
  if (story.committee_context.committees.length === 0) {
    lines.push(`- ${story.committee_context.note}`);
  } else {
    for (const committee of story.committee_context.committees) {
      lines.push(`- ${committee.committee_name}: ${committee.bill_numbers.join("、")}`);
    }
  }
  lines.push("");
  if (story.split_warning.required) {
    lines.push("## Split Warning");
    lines.push("");
    for (const note of story.split_warning.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }
  lines.push("## Review Notes");
  lines.push("");
  for (const note of story.review_notes) {
    lines.push(`- ${note}`);
  }
  lines.push("");
  lines.push("## Normal Draft");
  lines.push("");
  lines.push(story.normal_draft);
  lines.push("");
  lines.push("## Hard Draft");
  lines.push("");
  lines.push(story.hard_draft);
  lines.push("");
  lines.push("## Evidence Anchors");
  lines.push("");
  lines.push("| Member | Question Slug | Anchor | Confidence | Source | Review Required |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const anchor of story.evidence_anchors) {
    lines.push(
      `| ${escapeMarkdown(anchor.member_name ?? "")} | ${escapeMarkdown(anchor.question_slug)} | ${escapeMarkdown(anchor.anchor_text)} | ${escapeMarkdown(anchor.confidence)} | ${escapeMarkdown(anchor.source)} | ${anchor.review_required ? "yes" : "no"} |`
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildAggregate(stories, options) {
  const storyStatus = Object.fromEntries(
    EXPECTED_ISSUE_IDS.map((issueId) => [issueId, null])
  );
  for (const story of stories) {
    storyStatus[story.issue_id] = {
      story_slug: story.story_slug,
      current_editorial_status: story.current_editorial_status,
      anchor_selection_status: story.anchor_selection_status,
      review_required: story.review_required,
      has_normal_draft: Boolean(story.normal_draft),
      has_hard_draft: Boolean(story.hard_draft),
      has_split_warning: story.split_warning.required,
      evidence_anchor_count: story.evidence_anchors.length,
    };
  }

  return {
    schema_version: "issue-story-draft/v1",
    diet_session_slug: "ishigaki-r8-dai4-teireikai",
    generated_at: new Date().toISOString(),
    source_files: {
      issue_editorial_decisions: options.editorialDecisionsPath,
      issue_review_packet: options.reviewPacketPath,
      issue_graph_pilot: options.issueGraphPath,
      canonical_general_questions: options.canonicalJsonPath,
      public_general_questions: options.publicJsonPath,
    },
    summary: {
      issue_count: stories.length,
      story_status: storyStatus,
      review_required_count: stories.filter((story) => story.review_required).length,
      needs_split_count: stories.filter(
        (story) => story.current_editorial_status === "needs_split"
      ).length,
    },
    stories,
  };
}

function main() {
  const options = parseArgs(process.argv);
  const editorialData = readJson(options.editorialDecisionsPath);
  const reviewPacket = readJson(options.reviewPacketPath);
  const issueGraph = readJson(options.issueGraphPath);
  const canonicalData = readJson(options.canonicalJsonPath);
  const publicData = readJson(options.publicJsonPath);
  const topicsBySlug = readTopics(options.topicDir);

  validateIssueIds(editorialData, reviewPacket, issueGraph);

  const context = {
    editorialMap: buildIssueMap(editorialData),
    reviewPacketMap: buildIssueMap(reviewPacket),
    issueGraphMap: buildIssueMap(issueGraph),
    canonicalQuestionMap: buildCanonicalQuestionMap(canonicalData),
    publicQuestionMap: buildPublicQuestionMap(publicData),
    topicsBySlug,
  };

  const stories = EXPECTED_ISSUE_IDS.map((issueId) => buildStory(issueId, context));
  const aggregate = buildAggregate(stories, options);

  mkdirSync(dirname(options.outputJsonPath), { recursive: true });
  mkdirSync(options.outputDir, { recursive: true });
  writeFileSync(options.outputJsonPath, `${JSON.stringify(aggregate, null, 2)}\n`);

  for (const story of stories) {
    const outputPath = path.join(options.outputDir, `${story.story_slug}.md`);
    writeFileSync(outputPath, renderStoryMarkdown(story));
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        output_json: options.outputJsonPath,
        output_dir: options.outputDir,
        issue_count: stories.length,
        review_required_count: aggregate.summary.review_required_count,
        needs_split_count: aggregate.summary.needs_split_count,
      },
      null,
      2
    )}\n`
  );
}

main();
