#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_MINUTES_ROOT =
  process.env.LOCAL_TRANSCRIBER_MINUTES_ROOT ??
  resolve(ROOT, "..", "local-transcriber", "outputs_minutes_input");
const OUTPUT_ROOT = resolve(
  ROOT,
  "docs/general_questions_minutes/speech-canonical/r8-dai4"
);

const DIET_SESSION_SLUG = "ishigaki-r8-dai4-teireikai";

const TARGETS = [
  {
    question_slug: "ishigaki-r8-dai4-ippan-shiuezato-atsushi",
    question_date: "2026-06-15",
    member_name_raw: "後上里厚司",
    item_number: 7,
    item_title: "離島甲子園について",
    minutes_relative_path:
      "2026-06-16/石垣市議会　令和８年６月１５日　６月定例会　後上里厚司議員　一般質問_minutes.md",
    question_block: {
      start_contains: "最後に離島公支援についてお伺いします",
      end_contains: "当局の答弁を求めます",
      speaker_hint: "後上里厚司",
      speaker_role_hint: "questioner",
      speech_kind: "question_item",
      confidence: "medium",
      review_flags: ["possible_asr_error", "needs_human_review"],
    },
    answer_block: {
      start_contains: "次に7項目目 離島甲子園のご質問にお答えします",
      end_before_contains: "水道部長金城康勝君",
      speaker_hint: null,
      speaker_role_hint: "executive",
      speech_kind: "answer",
      confidence: "high",
      review_flags: [],
    },
    item_candidates: [
      {
        candidate_id: "item7-question-primary",
        source: "question",
        raw_anchor_contains: "最後に離島公支援についてお伺いします",
        confidence: "medium",
      },
      {
        candidate_id: "item7-answer-primary",
        source: "answer",
        raw_anchor_contains: "次に7項目目 離島甲子園のご質問にお答えします",
        confidence: "high",
      },
    ],
    review_flags: {
      hallucination_like: [],
      short_fragments: [],
      name_or_title_variants: [],
      possible_asr_errors: [
        "質問側 cue に『離島公支援』という ASR 崩れがあり、item 7 の question marker として人手確認が必要",
      ],
      needs_human_review: [
        "question primary evidence は ASR 崩れを含むため review 前提",
        "answer block に speaker_hint が明示されないため role は executive hint 扱い",
      ],
    },
  },
  {
    question_slug: "ishigaki-r8-dai4-ippan-nagahama-nobuo",
    question_date: "2026-06-22",
    member_name_raw: "長浜信夫",
    item_number: 3,
    item_title: "離島甲子園大会出場について",
    minutes_relative_path:
      "2026-06-25/石垣市議会　令和８年６月２２日　６月定例会　長浜信夫議員　一般質問_minutes.md",
    question_block: {
      start_contains: "離島甲子園大会出場についてであります",
      end_contains: "説明を求めます",
      speaker_hint: "長浜信夫",
      speaker_role_hint: "questioner",
      speech_kind: "question_item",
      confidence: "high",
      review_flags: [],
    },
    answer_block: {
      start_contains: "次に3項目目",
      end_before_contains: "次に4項目目",
      speaker_hint: null,
      speaker_role_hint: "executive",
      speech_kind: "answer",
      confidence: "high",
      review_flags: [],
    },
    item_candidates: [
      {
        candidate_id: "item3-question-primary",
        source: "question",
        raw_anchor_contains: "離島甲子園大会出場についてであります",
        confidence: "high",
      },
      {
        candidate_id: "item3-answer-primary",
        source: "answer",
        raw_anchor_contains: "本大会不参加の経緯についてのご質問にお答えします",
        confidence: "high",
      },
    ],
    review_flags: {
      hallucination_like: [],
      short_fragments: [],
      name_or_title_variants: [],
      possible_asr_errors: [],
      needs_human_review: [
        "follow-up の再質問ブロックは pilot v1 では primary evidence に含めていない",
      ],
    },
  },
  {
    // former-cityhall（旧庁舎跡地）pilot 用。item2 の境界 marker は full_text に
    // 厳密に存在するが、話者名の ASR 崩れ・質問が冒頭まとめ読み由来など review 前提。
    // candidate → confirmed の確定は人間が後段で行う（このスクリプトは review artifact のみ生成）。
    question_slug: "ishigaki-r8-dai4-ippan-tomoyose-eizo",
    question_date: "2026-06-15",
    member_name_raw: "友寄永三",
    item_number: 2,
    item_title: "旧庁舎跡地開発について",
    minutes_relative_path:
      "2026-06-16/石垣市議会　令和８年６月15日　６月定例会　友寄永三議員　一般質問_minutes.md",
    question_block: {
      start_contains: "2番 旧庁舎跡地開発について",
      end_before_contains: "3番 教育行政",
      speaker_hint: "友寄永三",
      speaker_role_hint: "questioner",
      speech_kind: "question_item",
      confidence: "low",
      review_flags: ["possible_asr_error", "needs_human_review"],
    },
    answer_block: {
      start_contains: "2項目目 旧庁舎跡地開発について",
      end_before_contains: "続きまして、5項目目、船舶の経由地確保について",
      speaker_hint: null,
      speaker_role_hint: "executive",
      speech_kind: "answer",
      confidence: "medium",
      review_flags: ["needs_human_review"],
    },
    item_candidates: [
      {
        candidate_id: "item2-question-primary",
        source: "question",
        raw_anchor_contains: "2番 旧庁舎跡地開発について",
        confidence: "low",
      },
      {
        candidate_id: "item2-answer-primary",
        source: "answer",
        raw_anchor_contains: "2項目目 旧庁舎跡地開発について",
        confidence: "medium",
      },
    ],
    review_flags: {
      hallucination_like: [],
      short_fragments: [],
      name_or_title_variants: [
        "話者名が ASR で『友康映像 / 富代生映像 / 富山映像 / 友寄せ映像』等に崩れている（いずれも友寄永三）",
        "『三崎町』は ASR 変種で、public source（general-questions.json）では『美崎町』",
      ],
      possible_asr_errors: [
        "質問側 item2 の primary evidence は冒頭の全項目まとめ読みから抽出しており、item 単位の独立した質問ターンではない",
      ],
      needs_human_review: [
        "issue-review-packet で tomoyose の item 紐付けは要校正(review_required)とされており、question/answer の item2 binding は人間レビュー前提",
        "question block は『2番 旧庁舎跡地開発について』〜『3番 教育行政』で機械抽出（confidence low）",
        "candidate → confirmed の確定および公開可否は人間判断（このartifactでは未確定）",
      ],
    },
  },
];

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTopLevelSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = new Map();
  let currentTitle = null;
  let currentLines = [];

  const flush = () => {
    if (currentTitle === null) return;
    sections.set(currentTitle, currentLines.join("\n").trimEnd());
  };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      flush();
      currentTitle = match[1].trim();
      currentLines = [];
      continue;
    }
    if (currentTitle !== null) {
      currentLines.push(line);
    }
  }

  flush();
  return sections;
}

function getSection(sections, aliases) {
  for (const alias of aliases) {
    if (sections.has(alias)) {
      return sections.get(alias);
    }
  }
  return "";
}

function extractFullText(markdown, minutesFilePath) {
  const sections = splitTopLevelSections(markdown);
  const fullTextSection = getSection(sections, ["本文 / full_text", "本文"]);
  if (!fullTextSection) {
    throw new Error(`Full text section not found: ${minutesFilePath}`);
  }

  const lines = fullTextSection.split(/\r?\n/);
  while (
    lines.length > 0 &&
    (lines[0].trim() === "" || lines[0].trim().startsWith(">"))
  ) {
    lines.shift();
  }

  const fullText = lines.join("\n").trim();
  if (!fullText) {
    throw new Error(`Full text is empty: ${minutesFilePath}`);
  }

  return fullText;
}

function toFullTextLines(fullText) {
  return fullText
    .split(/\r?\n/)
    .map((raw) => raw.trimEnd())
    .filter((raw) => raw.trim() !== "");
}

function findLineNumber(lines, needle) {
  const normalizedNeedle = normalizeText(needle);
  const index = lines.findIndex((line) =>
    normalizeText(line).includes(normalizedNeedle)
  );
  if (index < 0) {
    throw new Error(`Line containing "${needle}" was not found`);
  }
  return index + 1;
}

function buildEvidenceId(questionSlug, start, end) {
  return `${questionSlug}#L${start}-L${end}`;
}

function inferSpeakerHint(blockLines, fallback) {
  if (fallback !== undefined) {
    return fallback;
  }

  const speakerLine = blockLines.find((line) =>
    /(?:君|議長|委員長|市長|部長|課長)/u.test(line)
  );
  return speakerLine ?? null;
}

function buildSpeechBlock(questionSlug, lines, config) {
  const start = findLineNumber(lines, config.start_contains);
  const end =
    config.end_contains !== undefined
      ? findLineNumber(lines, config.end_contains)
      : findLineNumber(lines, config.end_before_contains) - 1;

  if (end < start) {
    throw new Error(
      `Invalid block range for ${questionSlug}: start ${start}, end ${end}`
    );
  }

  const blockLines = lines.slice(start - 1, end);
  return {
    evidence_id: buildEvidenceId(questionSlug, start, end),
    block_index: 0,
    source_line_start: start,
    source_line_end: end,
    raw_text: blockLines.join("\n"),
    normalized_text: normalizeText(blockLines.join(" ")),
    speaker_hint: inferSpeakerHint(blockLines, config.speaker_hint),
    speaker_role_hint: config.speaker_role_hint,
    speech_kind: config.speech_kind,
    item_number_candidate: 0,
    confidence: config.confidence,
    review_flags: config.review_flags,
  };
}

function buildItemCandidates(questionSlug, lines, blocks, target) {
  const blockMap = {
    question: blocks.questionBlock,
    answer: blocks.answerBlock,
  };

  return target.item_candidates.map((candidate) => {
    const sourceLine = findLineNumber(lines, candidate.raw_anchor_contains);
    const relatedBlock = blockMap[candidate.source];
    return {
      candidate_id: `${questionSlug}-${candidate.candidate_id}`,
      evidence_ids: [relatedBlock.evidence_id],
      raw_anchor_text: lines[sourceLine - 1],
      source_line: sourceLine,
      item_number_candidate: target.item_number,
      confidence: candidate.confidence,
    };
  });
}

function buildDocument(target, minutesRoot) {
  const minutesPath = resolve(minutesRoot, target.minutes_relative_path);
  const markdown = readFileSync(minutesPath, "utf-8");
  const fullText = extractFullText(markdown, minutesPath);
  const lines = toFullTextLines(fullText);

  const questionBlock = buildSpeechBlock(target.question_slug, lines, {
    ...target.question_block,
  });
  const answerBlock = buildSpeechBlock(target.question_slug, lines, {
    ...target.answer_block,
  });

  questionBlock.block_index = 1;
  answerBlock.block_index = 2;
  questionBlock.item_number_candidate = target.item_number;
  answerBlock.item_number_candidate = target.item_number;

  return {
    schema_version: "speech-canonical/v1",
    diet_session_slug: DIET_SESSION_SLUG,
    question_slug: target.question_slug,
    question_date: target.question_date,
    meeting_type: "general_question",
    member_name_raw: target.member_name_raw,
    source_minutes_file: relative(minutesRoot, minutesPath),
    full_text: fullText,
    speech_blocks: [questionBlock, answerBlock],
    item_candidates: buildItemCandidates(
      target.question_slug,
      lines,
      { questionBlock, answerBlock },
      target
    ),
    review_flags: target.review_flags,
  };
}

function validateDocument(document, target) {
  if (typeof document.full_text !== "string" || document.full_text.trim() === "") {
    throw new Error(`full_text is empty: ${target.question_slug}`);
  }

  if (!Array.isArray(document.speech_blocks) || document.speech_blocks.length < 2) {
    throw new Error(`speech_blocks missing: ${target.question_slug}`);
  }

  if (!Array.isArray(document.item_candidates) || document.item_candidates.length < 2) {
    throw new Error(`item_candidates missing: ${target.question_slug}`);
  }

  const hasQuestionBlock = document.speech_blocks.some(
    (block) =>
      block.speech_kind === "question_item" &&
      block.item_number_candidate === target.item_number
  );
  const hasAnswerBlock = document.speech_blocks.some(
    (block) =>
      block.speech_kind === "answer" &&
      block.item_number_candidate === target.item_number
  );

  if (!hasQuestionBlock) {
    throw new Error(`question primary evidence missing: ${target.question_slug}`);
  }
  if (!hasAnswerBlock) {
    throw new Error(`answer primary evidence missing: ${target.question_slug}`);
  }

  for (const block of document.speech_blocks) {
    if (!/^.+#L\d+-L\d+$/.test(block.evidence_id)) {
      throw new Error(`invalid evidence_id: ${block.evidence_id}`);
    }
  }
}

function main() {
  mkdirSync(OUTPUT_ROOT, { recursive: true });

  for (const target of TARGETS) {
    const document = buildDocument(target, DEFAULT_MINUTES_ROOT);
    validateDocument(document, target);
    const outputPath = resolve(
      OUTPUT_ROOT,
      `${target.question_slug}.speech-canonical.json`
    );
    writeFileSync(`${outputPath}`, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
    console.log(
      `[speech-canonical] wrote ${relative(ROOT, outputPath)} (${document.speech_blocks.length} blocks / ${document.item_candidates.length} candidates)`
    );
  }
}

main();
