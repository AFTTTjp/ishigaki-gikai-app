#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const DEFAULT_PUBLIC_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions/r8-dai4-teireikai.general-questions.json"
);
const DEFAULT_MINUTES_ROOT =
  process.env.LOCAL_TRANSCRIBER_MINUTES_ROOT ??
  resolve(ROOT, "..", "local-transcriber", "outputs_minutes_input");
const DEFAULT_OUTPUT_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/utterance-index/r8-dai4-teireikai.utterances.json"
);

const SESSION_SLUG = "ishigaki-r8-dai4-teireikai";
const TOP_LEVEL_SOURCE_KIND = "general_question_minutes";
const SPEAKER_ROLE_EXECUTIVE_PATTERNS = [
  "市長",
  "副市長",
  "教育長",
  "部長",
  "課長",
  "次長",
  "局長",
  "参事",
  "室長",
  "主幹",
  "担当",
];

function parseArgs(argv) {
  const options = {
    publicJsonPath: DEFAULT_PUBLIC_JSON_PATH,
    minutesRoot: DEFAULT_MINUTES_ROOT,
    outputPath: DEFAULT_OUTPUT_PATH,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--public-json") {
      options.publicJsonPath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--minutes-root") {
      options.minutesRoot = resolve(argv[++i]);
      continue;
    }
    if (arg === "--output") {
      options.outputPath = resolve(argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function listMinutesFiles(rootDir) {
  const results = [];

  function walk(currentDir) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith("一般質問_minutes.md")) {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results.sort((a, b) => a.localeCompare(b, "ja"));
}

function parseMinutesFileIdentity(minutesFilePath) {
  const normalized = normalizeText(path.basename(minutesFilePath));
  const dateMatch = normalized.match(/令和8年(\d+)月(\d+)日/);
  const memberMatch = normalized.match(
    /^.*定例会 (.+?)議員 一般質問_minutes(?:_[^.]+)?\.md$/
  );

  if (!dateMatch || !memberMatch) {
    throw new Error(`Failed to parse minutes file identity: ${minutesFilePath}`);
  }

  const [, month, day] = dateMatch;
  return {
    member_name_raw: memberMatch[1].trim(),
    question_date: `2026-${String(Number(month)).padStart(2, "0")}-${String(
      Number(day)
    ).padStart(2, "0")}`,
  };
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

  return lines.join("\n").trim();
}

function toFullTextLines(fullText) {
  const rawLines = fullText.split(/\r?\n/);
  const lines = [];
  let lineNumber = 0;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }
    lineNumber += 1;
    lines.push({
      lineNumber,
      text: trimmed,
      normalized: normalizeText(trimmed),
    });
  }

  return lines;
}

function buildQuestionMap(publicJsonPath) {
  const data = JSON.parse(readFileSync(publicJsonPath, "utf8"));
  const map = new Map();

  for (const question of data.questions ?? []) {
    const key = `${question.question_date}::${normalizeText(
      question.member_name_raw
    )}`;
    map.set(key, question);
  }

  return {
    dietSessionSlug: data.diet_session_slug,
    questions: data.questions ?? [],
    byDateAndMember: map,
  };
}

function buildMinutesMap(minutesFiles) {
  const map = new Map();

  for (const minutesFile of minutesFiles) {
    const identity = parseMinutesFileIdentity(minutesFile);
    const key = `${identity.question_date}::${normalizeText(
      identity.member_name_raw
    )}`;
    if (map.has(key)) {
      throw new Error(`Duplicate minutes match for ${key}`);
    }
    map.set(key, minutesFile);
  }

  return map;
}

function detectSpeakerCue(normalizedLine) {
  if (!normalizedLine.endsWith("君")) {
    return null;
  }
  return normalizedLine;
}

function detectSpeakerContext({
  speakerCue,
  memberNameRaw,
}) {
  if (!speakerCue) return null;

  const memberName = normalizeText(memberNameRaw);
  if (speakerCue.includes(memberName) || speakerCue.includes(`${memberName}議員`)) {
    return {
      speaker_hint: memberNameRaw,
      speaker_role_hint: "questioner",
    };
  }

  if (speakerCue.includes("議長") || speakerCue.includes("委員長")) {
    return {
      speaker_hint: speakerCue.replace(/君$/, ""),
      speaker_role_hint: "chair",
    };
  }

  if (SPEAKER_ROLE_EXECUTIVE_PATTERNS.some((pattern) => speakerCue.includes(pattern))) {
    return {
      speaker_hint: speakerCue.replace(/君$/, ""),
      speaker_role_hint: "executive",
    };
  }

  return {
    speaker_hint: speakerCue.replace(/君$/, ""),
    speaker_role_hint: "unknown",
  };
}

function isProceduralLine(normalizedLine) {
  return [
    "質問者",
    "答弁を求めます",
    "答弁は終わりました",
    "休憩いたします",
    "再開することとし",
    "再開します",
    "質問は終わりました",
    "質問を終わります",
    "質問に入ります",
    "許します",
    "お願いいたします",
  ].some((phrase) => normalizedLine.includes(phrase));
}

function inferProceduralSpeakerContext(line, fallbackContext) {
  const normalizedLine = line.normalized;

  if (
    normalizedLine.includes("議長") ||
    normalizedLine.includes("委員長") ||
    normalizedLine.includes("質問者") ||
    normalizedLine.includes("休憩") ||
    normalizedLine.includes("再開")
  ) {
    return {
      speaker_hint: null,
      speaker_role_hint: "chair",
    };
  }

  return fallbackContext;
}

function createItemCueMatcher(question) {
  const byNumber = new Map(
    (question.items ?? []).map((item) => [Number(item.item_number), item])
  );
  const titleEntries = (question.items ?? [])
    .map((item) => ({
      item_number: Number(item.item_number),
      normalized_title: normalizeText(item.title),
      title: item.title,
    }))
    .filter((entry) => entry.normalized_title);

  return function matchItemCue(normalizedLine) {
    const numberedCue = normalizedLine.match(/(?:^|[^\d])(\d{1,2})\s*項目目/);
    if (numberedCue) {
      const itemNumber = Number(numberedCue[1]);
      const item = byNumber.get(itemNumber);
      if (item) {
        return {
          item_number: itemNumber,
          item_title: item.title,
          matched_by: "item_number",
        };
      }
    }

    const titledMatches = titleEntries.filter((entry) =>
      normalizedLine.includes(entry.normalized_title)
    );
    if (titledMatches.length === 1) {
      return {
        item_number: titledMatches[0].item_number,
        item_title: titledMatches[0].title,
        matched_by: "item_title",
      };
    }

    if (titledMatches.length > 1) {
      return {
        item_number: null,
        item_title: null,
        matched_by: "ambiguous_title",
      };
    }

    return null;
  };
}

function shouldStartNewItemBlock({
  currentBlock,
  nextItemCue,
}) {
  if (!nextItemCue) return false;
  if (!currentBlock) return false;
  if (currentBlock.lines.length === 0) return false;
  if (currentBlock.speech_kind === "procedural") return true;
  if (currentBlock.item_number_candidate === null) return true;
  return currentBlock.item_number_candidate !== nextItemCue.item_number;
}

function startBlock({
  utterances,
  question,
  sourceMinutesFile,
  speakerContext,
  line,
  itemCue,
  speechKind,
  additionalReviewFlags = [],
}) {
  const utteranceIndex = utterances.length + 1;
  return {
    utterance_id: `${SESSION_SLUG}.gq.${question.slug}.u${String(
      utteranceIndex
    ).padStart(4, "0")}`,
    anchor_aliases: [],
    source_type: TOP_LEVEL_SOURCE_KIND,
    source_minutes_file: sourceMinutesFile,
    question_slug: question.slug,
    question_date: question.question_date,
    member_name_raw: question.member_name_raw,
    item_number_candidate: itemCue?.item_number ?? null,
    item_title_candidate: itemCue?.item_title ?? null,
    line_start: line.lineNumber,
    line_end: line.lineNumber,
    lines: [line.text],
    speaker_hint: speakerContext?.speaker_hint ?? null,
    speaker_role_hint: speakerContext?.speaker_role_hint ?? null,
    speech_kind: speechKind,
    confidence:
      speechKind === "answer" || speechKind === "question_item"
        ? "medium"
        : "needs_review",
    review_flags: [...additionalReviewFlags],
  };
}

function finalizeBlock(block) {
  const text = block.lines.join("\n");
  const normalizedText = normalizeText(text);
  const alias = `${block.question_slug}#L${block.line_start}-L${block.line_end}`;

  return {
    utterance_id: block.utterance_id,
    anchor_aliases: [alias],
    source_type: block.source_type,
    source_minutes_file: block.source_minutes_file,
    question_slug: block.question_slug,
    question_date: block.question_date,
    member_name_raw: block.member_name_raw,
    item_number_candidate: block.item_number_candidate,
    item_title_candidate: block.item_title_candidate,
    line_start: block.line_start,
    line_end: block.line_end,
    text,
    normalized_text: normalizedText,
    speaker_hint: block.speaker_hint,
    speaker_role_hint: block.speaker_role_hint,
    speech_kind: block.speech_kind,
    confidence: block.confidence,
    review_flags: [...new Set(block.review_flags)],
    text_hash: sha256(normalizedText),
  };
}

function buildUtterancesForQuestion({ question, minutesFilePath, minutesRoot }) {
  const markdown = readFileSync(minutesFilePath, "utf8");
  const fullText = extractFullText(markdown, minutesFilePath);
  const lines = toFullTextLines(fullText);
  const sourceMinutesFile = toPosixPath(path.relative(minutesRoot, minutesFilePath));
  const matchItemCue = createItemCueMatcher(question);

  /** @type {ReturnType<typeof finalizeBlock>[]} */
  const utterances = [];
  let currentSpeakerContext = {
    speaker_hint: question.member_name_raw,
    speaker_role_hint: "questioner",
  };
  let currentBlock = null;

  const pushCurrentBlock = () => {
    if (!currentBlock || currentBlock.lines.length === 0) {
      currentBlock = null;
      return;
    }
    utterances.push(finalizeBlock(currentBlock));
    currentBlock = null;
  };

  for (const line of lines) {
    const speakerCue = detectSpeakerCue(line.normalized);
    if (speakerCue) {
      pushCurrentBlock();
      currentSpeakerContext =
        detectSpeakerContext({
          speakerCue,
          memberNameRaw: question.member_name_raw,
        }) ?? currentSpeakerContext;
      continue;
    }

    const itemCue = matchItemCue(line.normalized);
    const procedural = isProceduralLine(line.normalized);

    if (
      shouldStartNewItemBlock({
        currentBlock,
        nextItemCue: itemCue,
      })
    ) {
      pushCurrentBlock();
    }

    if (
      procedural &&
      currentBlock &&
      currentBlock.speech_kind !== "procedural" &&
      currentBlock.lines.length > 0
    ) {
      pushCurrentBlock();
    }

    if (!currentBlock) {
      const speechKind = procedural
        ? "procedural"
        : currentSpeakerContext?.speaker_role_hint === "executive"
          ? "answer"
          : currentSpeakerContext?.speaker_role_hint === "questioner"
            ? "question_item"
            : "unknown";
      const blockSpeakerContext = procedural
        ? inferProceduralSpeakerContext(line, currentSpeakerContext)
        : currentSpeakerContext;

      const additionalReviewFlags = [];
      if (itemCue?.matched_by === "ambiguous_title") {
        additionalReviewFlags.push("ambiguous_item_title_match");
      }
      if (
        blockSpeakerContext?.speaker_role_hint === "unknown" ||
        (blockSpeakerContext?.speaker_hint === null &&
          blockSpeakerContext?.speaker_role_hint !== "chair")
      ) {
        additionalReviewFlags.push("speaker_needs_review");
      }

      currentBlock = startBlock({
        utterances,
        question,
        sourceMinutesFile,
        speakerContext: blockSpeakerContext,
        line,
        itemCue: itemCue?.item_number ? itemCue : null,
        speechKind,
        additionalReviewFlags,
      });
      continue;
    }

    currentBlock.lines.push(line.text);
    currentBlock.line_end = line.lineNumber;

    if (currentBlock.item_number_candidate === null && itemCue?.item_number) {
      currentBlock.item_number_candidate = itemCue.item_number;
      currentBlock.item_title_candidate = itemCue.item_title;
    }
    if (itemCue?.matched_by === "ambiguous_title") {
      currentBlock.review_flags.push("ambiguous_item_title_match");
    }
  }

  pushCurrentBlock();
  return { utterances, sourceMinutesFile };
}

function validateAnchorUniqueness(utterances) {
  const seenUtteranceIds = new Set();
  const seenAliases = new Set();

  for (const utterance of utterances) {
    if (seenUtteranceIds.has(utterance.utterance_id)) {
      throw new Error(`Duplicate utterance_id: ${utterance.utterance_id}`);
    }
    seenUtteranceIds.add(utterance.utterance_id);

    for (const alias of utterance.anchor_aliases ?? []) {
      if (seenAliases.has(alias)) {
        throw new Error(`Duplicate anchor alias: ${alias}`);
      }
      seenAliases.add(alias);
    }
  }
}

function main() {
  const options = parseArgs(process.argv);

  if (!existsSync(options.minutesRoot)) {
    throw new Error(
      `Minutes root not found: ${options.minutesRoot}. Set LOCAL_TRANSCRIBER_MINUTES_ROOT or pass --minutes-root.`
    );
  }

  const questionMap = buildQuestionMap(options.publicJsonPath);
  if (questionMap.dietSessionSlug !== SESSION_SLUG) {
    throw new Error(
      `Unexpected diet_session_slug: ${questionMap.dietSessionSlug}`
    );
  }

  const minutesFiles = listMinutesFiles(options.minutesRoot);
  const minutesMap = buildMinutesMap(minutesFiles);
  const allUtterances = [];
  const generatedFrom = [toPosixPath(path.relative(ROOT, options.publicJsonPath))];

  for (const question of questionMap.questions) {
    const key = `${question.question_date}::${normalizeText(question.member_name_raw)}`;
    const minutesFilePath = minutesMap.get(key);

    if (!minutesFilePath) {
      throw new Error(
        `Minutes file not found for ${question.slug} (${question.question_date} / ${question.member_name_raw})`
      );
    }

    const { utterances, sourceMinutesFile } = buildUtterancesForQuestion({
      question,
      minutesFilePath,
      minutesRoot: options.minutesRoot,
    });

    allUtterances.push(...utterances);
    generatedFrom.push(`general_question_minutes:${sourceMinutesFile}`);
  }

  validateAnchorUniqueness(allUtterances);

  const payload = {
    schema_version: "issue-publisher-utterance-index.v1",
    diet_session_slug: SESSION_SLUG,
    source_kind: TOP_LEVEL_SOURCE_KIND,
    generated_at: new Date().toISOString(),
    generated_from: generatedFrom,
    utterances: allUtterances,
  };

  mkdirSync(path.dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Wrote ${allUtterances.length} utterances to ${path.relative(
      ROOT,
      options.outputPath
    )}`
  );
}

main();
