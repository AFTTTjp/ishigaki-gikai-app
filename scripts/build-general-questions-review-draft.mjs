#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULT_CANONICAL_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.canonical.json"
);
const DEFAULT_PUBLIC_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions/r8-dai4-teireikai.general-questions.json"
);
const DEFAULT_OUTPUT_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.review-draft.json"
);
const DEFAULT_OUTPUT_MD_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.review-draft.md"
);

const REVIEW_REQUIRED_THRESHOLD = 20;
const CONFIDENCE_LEVELS = ["high", "medium", "low"];
const REVIEW_FLAG_KEYS = [
  "hallucination_like",
  "short_fragments",
  "name_or_title_variants",
  "possible_asr_errors",
  "needs_human_review",
];

function parseArgs(argv) {
  const options = {
    canonicalJsonPath: DEFAULT_CANONICAL_JSON_PATH,
    publicJsonPath: DEFAULT_PUBLIC_JSON_PATH,
    outputJsonPath: DEFAULT_OUTPUT_JSON_PATH,
    outputMarkdownPath: DEFAULT_OUTPUT_MD_PATH,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--canonical-json") {
      options.canonicalJsonPath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--public-json") {
      options.publicJsonPath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--output-json") {
      options.outputJsonPath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--output-markdown") {
      options.outputMarkdownPath = resolve(argv[++i]);
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
  return value
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPosixRelative(value) {
  return value.split(path.sep).join("/");
}

function relativizeFromRoot(filePath) {
  const relativePath = path.relative(ROOT, filePath);
  if (
    relativePath &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  ) {
    return toPosixRelative(relativePath);
  }

  return path.basename(filePath);
}

function sanitizePathForOutput(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    return filePath;
  }

  return relativizeFromRoot(filePath);
}

function isTooShortAnchor(anchorText) {
  return normalizeText(anchorText).length <= 12;
}

function isGenericAnchor(anchorText) {
  const text = normalizeText(anchorText);
  const genericPatterns = [
    /^(次に|続いて|最後に|では|そこで|また|なお)/,
    /^その.*(について|こと|状況)/,
    /^(検討|設置|説明|ご答弁|お示し).*(願います|お願いします|お伺いします|お伺いいたします)$/,
  ];

  if (genericPatterns.some((pattern) => pattern.test(text)) && text.length <= 40) {
    return true;
  }

  return false;
}

function isProceduralOrGreetingNoise(anchorText) {
  const text = normalizeText(anchorText);
  const noisePatterns = [
    /(皆様こんにちは|おはようございます)/,
    /(委員長|議長)/,
    /(議員のご質問|ご質問の\d+項目目|ご質問の\d+点目)/,
    /(議員の\d+項目目|議員の\d+点目)/,
    /(本日\d+番目|本日.*番目)/,
    /(状態になります|よろしくお願いします)/,
  ];

  return noisePatterns.some((pattern) => pattern.test(text));
}

function buildSuggestedAction(candidate) {
  if (candidate.confidence === "low") {
    return {
      suggested_action: "ignore_candidate",
      reason: "low confidence anchor",
    };
  }

  if (isTooShortAnchor(candidate.raw_anchor_text)) {
    return {
      suggested_action: "ignore_candidate",
      reason: "anchor is too short for public item drafting",
    };
  }

  if (isGenericAnchor(candidate.raw_anchor_text)) {
    return {
      suggested_action: "ignore_candidate",
      reason: "anchor is too generic without enough standalone topic context",
    };
  }

  if (isProceduralOrGreetingNoise(candidate.raw_anchor_text)) {
    return {
      suggested_action: "ignore_candidate",
      reason: "anchor looks like greeting or procedural noise rather than a public question item",
    };
  }

  if (candidate.confidence === "high") {
    return {
      suggested_action: "promote_candidate",
      reason: "high confidence anchor with enough topic specificity",
    };
  }

  return {
    suggested_action: "review_only",
    reason: "medium confidence anchor requires human review before promotion",
  };
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

function emptyConfidenceBuckets() {
  return {
    high: [],
    medium: [],
    low: [],
  };
}

function emptyConfidenceCounts() {
  return {
    high: 0,
    medium: 0,
    low: 0,
  };
}

function emptyActionCounts() {
  return {
    promote_candidate: 0,
    review_only: 0,
    ignore_candidate: 0,
  };
}

function validateInputs(publicData, canonicalData) {
  const publicQuestions = [...(publicData.questions ?? [])].sort(
    (a, b) => a.question_number - b.question_number
  );
  const canonicalQuestions = canonicalData.questions ?? [];

  if (publicQuestions.length !== canonicalQuestions.length) {
    throw new Error(
      `Question count mismatch: public=${publicQuestions.length}, canonical=${canonicalQuestions.length}`
    );
  }

  const publicSlugs = publicQuestions.map((question) => question.slug);
  const canonicalSlugs = canonicalQuestions.map((question) => question.slug);

  if (JSON.stringify(publicSlugs) !== JSON.stringify(canonicalSlugs)) {
    throw new Error("Slug order mismatch between public JSON and canonical JSON");
  }

  return { publicQuestions, canonicalQuestions };
}

function buildReviewDraft(publicQuestions, canonicalQuestions, canonicalJsonPath) {
  const summary = {
    question_count: canonicalQuestions.length,
    confidence_counts: emptyConfidenceCounts(),
    suggested_action_counts: emptyActionCounts(),
    review_required_count: 0,
  };

  const questions = canonicalQuestions.map((canonicalQuestion, index) => {
    const publicQuestion = publicQuestions[index];
    const current_items = publicQuestion.items.map((item) => ({
      item_number: item.item_number,
      title: item.title,
      sub_items: item.sub_items,
    }));

    const review_flags_count = countReviewFlags(canonicalQuestion.review_flags);
    const candidateBuckets = emptyConfidenceBuckets();
    const candidateCounts = emptyConfidenceCounts();
    const actionCounts = emptyActionCounts();
    const item_candidates = canonicalQuestion.question_items.map((candidate) => {
      const action = buildSuggestedAction(candidate);
      const draftCandidate = {
        ...(candidate.item_number !== undefined
          ? { item_number: candidate.item_number }
          : {}),
        raw_anchor_text: candidate.raw_anchor_text,
        confidence: candidate.confidence,
        suggested_action: action.suggested_action,
        reason: action.reason,
      };

      candidateBuckets[candidate.confidence].push(draftCandidate);
      candidateCounts[candidate.confidence] += 1;
      actionCounts[action.suggested_action] += 1;
      summary.confidence_counts[candidate.confidence] += 1;
      summary.suggested_action_counts[action.suggested_action] += 1;
      return draftCandidate;
    });

    const question_review_required =
      review_flags_count.needs_human_review >= REVIEW_REQUIRED_THRESHOLD;

    if (question_review_required) {
      summary.review_required_count += 1;
    }

    return {
      slug: canonicalQuestion.slug,
      question_number: canonicalQuestion.question_number,
      question_date: canonicalQuestion.question_date,
      member_name_raw: canonicalQuestion.member_name_raw,
      full_text_available: Boolean(canonicalQuestion.full_text?.trim()),
      current_items,
      keywords: canonicalQuestion.keywords,
      review_flags_count,
      question_review_required,
      confidence_counts: candidateCounts,
      suggested_action_counts: actionCounts,
      item_candidates_by_confidence: candidateBuckets,
      item_candidates,
    };
  });

  return {
    schema_version: "v1",
    source_kind: "review_draft",
    source_canonical_json: relativizeFromRoot(canonicalJsonPath),
    diet_session_slug: canonicalQuestions[0]?.slug
      ? canonicalDataSessionSlugFallback(canonicalQuestions)
      : undefined,
    summary,
    questions,
  };
}

function canonicalDataSessionSlugFallback(canonicalQuestions) {
  const firstSlug = canonicalQuestions[0]?.slug ?? "";
  const marker = "-ippan-";
  const index = firstSlug.indexOf(marker);
  return index >= 0 ? firstSlug.slice(0, index) : "";
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, "\\|");
}

function formatCurrentItems(currentItems) {
  if (currentItems.length === 0) {
    return "- なし";
  }

  return currentItems
    .map((item) => {
      const subItems =
        item.sub_items.length > 0 ? ` / ${item.sub_items.join(" / ")}` : "";
      return `- ${item.item_number}. ${item.title}${subItems}`;
    })
    .join("\n");
}

function formatCandidates(candidates) {
  if (candidates.length === 0) {
    return "- なし";
  }

  return candidates
    .map((candidate) => {
      const itemNumber =
        candidate.item_number !== undefined ? ` item=${candidate.item_number}` : "";
      return `- ${candidate.confidence}${itemNumber} / ${candidate.suggested_action} / ${candidate.raw_anchor_text}\n  reason: ${candidate.reason}`;
    })
    .join("\n");
}

function buildMarkdown(reviewDraft) {
  const lines = [];
  lines.push("# General Questions Review Draft");
  lines.push("");
  lines.push(`- source_kind: ${reviewDraft.source_kind}`);
  lines.push(`- question_count: ${reviewDraft.summary.question_count}`);
  lines.push(
    `- confidence_counts: high=${reviewDraft.summary.confidence_counts.high}, medium=${reviewDraft.summary.confidence_counts.medium}, low=${reviewDraft.summary.confidence_counts.low}`
  );
  lines.push(
    `- suggested_action_counts: promote=${reviewDraft.summary.suggested_action_counts.promote_candidate}, review_only=${reviewDraft.summary.suggested_action_counts.review_only}, ignore=${reviewDraft.summary.suggested_action_counts.ignore_candidate}`
  );
  lines.push(
    `- review_required_count: ${reviewDraft.summary.review_required_count}`
  );
  lines.push("");

  for (const question of reviewDraft.questions) {
    lines.push(
      `## [${question.question_number}] ${question.member_name_raw} (${question.question_date})`
    );
    lines.push("");
    lines.push(`- slug: ${question.slug}`);
    lines.push(
      `- full_text_available: ${question.full_text_available ? "true" : "false"}`
    );
    lines.push(
      `- question_review_required: ${question.question_review_required ? "true" : "false"}`
    );
    lines.push(
      `- review_flags_count: hallucination_like=${question.review_flags_count.hallucination_like}, short_fragments=${question.review_flags_count.short_fragments}, name_or_title_variants=${question.review_flags_count.name_or_title_variants}, possible_asr_errors=${question.review_flags_count.possible_asr_errors}, needs_human_review=${question.review_flags_count.needs_human_review}`
    );
    lines.push(
      `- confidence_counts: high=${question.confidence_counts.high}, medium=${question.confidence_counts.medium}, low=${question.confidence_counts.low}`
    );
    lines.push(
      `- suggested_action_counts: promote=${question.suggested_action_counts.promote_candidate}, review_only=${question.suggested_action_counts.review_only}, ignore=${question.suggested_action_counts.ignore_candidate}`
    );
    lines.push(
      `- keywords: ${question.keywords.length > 0 ? question.keywords.join(", ") : "なし"}`
    );
    lines.push("");
    lines.push("### Current Public Items");
    lines.push("");
    lines.push(formatCurrentItems(question.current_items));
    lines.push("");
    lines.push("### Promote Candidates");
    lines.push("");
    lines.push(formatCandidates(question.item_candidates_by_confidence.high));
    lines.push("");
    lines.push("### Review Only Candidates");
    lines.push("");
    lines.push(
      formatCandidates(question.item_candidates_by_confidence.medium.filter(
        (candidate) => candidate.suggested_action === "review_only"
      ))
    );
    lines.push("");
    lines.push("### Ignore Candidates");
    lines.push("");
    lines.push(
      formatCandidates(
        question.item_candidates.filter(
          (candidate) => candidate.suggested_action === "ignore_candidate"
        )
      )
    );
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv);
  const canonicalData = readJson(options.canonicalJsonPath);
  const publicData = readJson(options.publicJsonPath);
  const { publicQuestions, canonicalQuestions } = validateInputs(
    publicData,
    canonicalData
  );

  const reviewDraft = buildReviewDraft(
    publicQuestions,
    canonicalQuestions,
    options.canonicalJsonPath
  );
  reviewDraft.diet_session_slug = canonicalData.diet_session_slug;

  mkdirSync(dirname(options.outputJsonPath), { recursive: true });
  mkdirSync(dirname(options.outputMarkdownPath), { recursive: true });
  writeFileSync(options.outputJsonPath, `${JSON.stringify(reviewDraft, null, 2)}\n`);
  writeFileSync(options.outputMarkdownPath, buildMarkdown(reviewDraft));

  console.log("=".repeat(60));
  console.log("General questions review draft generated");
  console.log("=".repeat(60));
  console.log(`Canonical JSON : ${options.canonicalJsonPath}`);
  console.log(`Public JSON    : ${options.publicJsonPath}`);
  console.log(`Output JSON    : ${options.outputJsonPath}`);
  console.log(`Output Markdown: ${options.outputMarkdownPath}`);
  console.log(`Questions      : ${reviewDraft.summary.question_count}`);
  console.log(
    `Confidence     : high=${reviewDraft.summary.confidence_counts.high}, medium=${reviewDraft.summary.confidence_counts.medium}, low=${reviewDraft.summary.confidence_counts.low}`
  );
  console.log(
    `Review required: ${reviewDraft.summary.review_required_count}`
  );
}

main();
