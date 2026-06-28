#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULT_PUBLIC_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions/r8-dai4-teireikai.general-questions.json"
);
const DEFAULT_MINUTES_ROOT = process.env.MIRAI_GIKAI_MINUTES_ROOT
  ? resolve(process.env.MIRAI_GIKAI_MINUTES_ROOT)
  : resolve(ROOT, "..", "local-transcriber", "outputs_minutes_input");
const DEFAULT_OUTPUT_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.canonical.json"
);

const REVIEW_FLAG_KEYS = [
  "hallucination_like",
  "short_fragments",
  "name_or_title_variants",
  "possible_asr_errors",
  "needs_human_review",
];

function parseArgs(argv) {
  const options = {
    publicJsonPath: DEFAULT_PUBLIC_JSON_PATH,
    minutesRoot: DEFAULT_MINUTES_ROOT,
    outputPath: DEFAULT_OUTPUT_PATH,
    minutesOverrideFiles: [],
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
    if (arg === "--minutes-override-file") {
      options.minutesOverrideFiles.push(resolve(argv[++i]));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
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

function normalizeForParsing(value) {
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

  return null;
}

function relativizeFromBase(basePath, filePath) {
  const relativePath = path.relative(basePath, filePath);
  if (
    relativePath &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  ) {
    return toPosixRelative(relativePath);
  }

  return path.basename(filePath);
}

function parseMinutesFileIdentity(minutesFilePath) {
  const normalized = normalizeForParsing(path.basename(minutesFilePath));
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
    source_minutes_file_path: minutesFilePath,
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

function parseBulletLines(sectionBody) {
  return sectionBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean);
}

function parseSourceFilePath(sourceSection, minutesFilePath) {
  const match = sourceSection.match(/^- 入力ファイル:\s*(.+)$/m);
  if (!match) {
    throw new Error(`Input file line not found in ${minutesFilePath}`);
  }

  const inputFileName = match[1].trim();
  return path.resolve(path.dirname(minutesFilePath), inputFileName);
}

function parseExtractedOverview(overviewSection) {
  if (!overviewSection) return [];

  const lines = overviewSection.split(/\r?\n/);
  const results = [];
  let inOverviewBullets = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (
      line === "冒頭部分:" ||
      line.startsWith("冒頭抜粋（要約ではありません）:")
    ) {
      inOverviewBullets = true;
      continue;
    }

    if (
      line === "頻出キーワード（上位）:" ||
      line === "キーワード候補（stopword 除外後の上位）:"
    ) {
      break;
    }

    if (inOverviewBullets && line.startsWith("- ")) {
      results.push(line.replace(/^- /, "").trim());
    }
  }

  return results;
}

function stripKeywordCount(value) {
  return value.replace(/\s*[（(]\d+\s*回[）)]\s*$/, "").trim();
}

function parseKeywords(keywordsSection, overviewSection) {
  const keywordLines = parseBulletLines(keywordsSection);
  if (keywordLines.length > 0) {
    return keywordLines.map(stripKeywordCount).filter(Boolean);
  }

  if (!overviewSection) {
    return [];
  }

  const lines = overviewSection.split(/\r?\n/);
  const results = [];
  let inKeywordBullets = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (
      line === "頻出キーワード（上位）:" ||
      line === "キーワード候補（stopword 除外後の上位）:"
    ) {
      inKeywordBullets = true;
      continue;
    }

    if (inKeywordBullets && line.startsWith("- ")) {
      results.push(stripKeywordCount(line.replace(/^- /, "").trim()));
    }
  }

  return results.filter(Boolean);
}

function inferItemNumber(rawAnchorText) {
  const patterns = [
    /^(?:大きな質問の)?\s*(\d+)\s*項目目/,
    /^(?:大きな質問の)?\s*(\d+)\s*点目/,
    /^(?:大きな質問の)?\s*(\d+)\s*番目/,
  ];

  for (const pattern of patterns) {
    const match = rawAnchorText.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }

  return undefined;
}

function parseQuestionItems(questionItemsSection) {
  if (!questionItemsSection) {
    return [];
  }

  const items = [];
  const lines = questionItemsSection.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(
      /^- line `(\d+)` \/ confidence `(high|medium|low)` \/ raw_anchor_text: (.+)$/
    );

    if (!match) {
      continue;
    }

    const raw_anchor_text = match[3].trim();
    const item_number = inferItemNumber(raw_anchor_text);
    items.push({
      ...(item_number !== undefined ? { item_number } : {}),
      raw_anchor_text,
      confidence: match[2],
    });
  }

  return items;
}

function emptyReviewFlags() {
  return {
    hallucination_like: [],
    short_fragments: [],
    name_or_title_variants: [],
    possible_asr_errors: [],
    needs_human_review: [],
  };
}

function parseReviewFlags(reviewFlagsSection) {
  const reviewFlags = emptyReviewFlags();
  if (!reviewFlagsSection) {
    return reviewFlags;
  }

  const hasStructuredCategories = /^###\s+/m.test(reviewFlagsSection);
  if (!hasStructuredCategories) {
    reviewFlags.needs_human_review = parseBulletLines(reviewFlagsSection).filter(
      (line) => line !== "（該当なし）"
    );
    return reviewFlags;
  }

  let currentCategory = null;
  for (const rawLine of reviewFlagsSection.split(/\r?\n/)) {
    const line = rawLine.trim();
    const subheadingMatch = line.match(/^###\s+(.+)$/);
    if (subheadingMatch) {
      const key = subheadingMatch[1].trim();
      currentCategory = REVIEW_FLAG_KEYS.includes(key) ? key : null;
      continue;
    }

    if (!currentCategory || !line.startsWith("- ")) {
      continue;
    }

    const value = line.replace(/^- /, "").trim();
    if (value === "（該当なし）") {
      continue;
    }
    reviewFlags[currentCategory].push(value);
  }

  return reviewFlags;
}

function parseFullText(fullTextSection, minutesFilePath) {
  if (!fullTextSection) {
    throw new Error(`Full text section not found in ${minutesFilePath}`);
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
    throw new Error(`Full text is empty in ${minutesFilePath}`);
  }

  return fullText;
}

function parseMinutesMarkdown(minutesFilePath, minutesRoot) {
  const markdown = readFileSync(minutesFilePath, "utf-8");
  const sections = splitTopLevelSections(markdown);

  const sourceSection = getSection(sections, ["元ファイル"]);
  const overviewSection = getSection(sections, ["抽出候補", "概要"]);
  const questionItemsSection = getSection(sections, ["質問項目候補"]);
  const keywordsSection = getSection(sections, ["議題・キーワード候補"]);
  const reviewFlagsSection = getSection(sections, [
    "要確認 / review_flags",
    "要確認",
  ]);
  const fullTextSection = getSection(sections, ["本文 / full_text", "本文"]);

  return {
    source_file: relativizeFromBase(
      minutesRoot,
      parseSourceFilePath(sourceSection, minutesFilePath)
    ),
    extracted_overview: parseExtractedOverview(overviewSection),
    keywords: parseKeywords(keywordsSection, overviewSection),
    review_flags: parseReviewFlags(reviewFlagsSection),
    question_items: parseQuestionItems(questionItemsSection),
    full_text: parseFullText(fullTextSection, minutesFilePath),
  };
}

function validateCanonicalJson(canonical, publicQuestions) {
  if (!Array.isArray(canonical.questions)) {
    throw new Error("questions is not an array");
  }

  if (canonical.questions.length !== publicQuestions.length) {
    throw new Error(
      `questions length mismatch: expected ${publicQuestions.length}, got ${canonical.questions.length}`
    );
  }

  const publicSlugs = publicQuestions.map((question) => question.slug);
  const canonicalSlugs = canonical.questions.map((question) => question.slug);
  if (JSON.stringify(publicSlugs) !== JSON.stringify(canonicalSlugs)) {
    throw new Error("slug order mismatch between public JSON and canonical JSON");
  }

  for (const question of canonical.questions) {
    if (typeof question.full_text !== "string" || question.full_text.trim() === "") {
      throw new Error(`full_text is empty: ${question.slug}`);
    }

    if (!Array.isArray(question.question_items)) {
      throw new Error(`question_items is not an array: ${question.slug}`);
    }

    for (const key of REVIEW_FLAG_KEYS) {
      if (!Array.isArray(question.review_flags?.[key])) {
        throw new Error(`review_flags.${key} missing: ${question.slug}`);
      }
    }
  }
}

function buildCanonicalQuestions(publicQuestions, minutesByKey, minutesRoot) {
  const unmatchedPublicQuestions = [];
  const usedKeys = new Set();

  const canonicalQuestions = [...publicQuestions]
    .sort((a, b) => a.question_number - b.question_number)
    .map((publicQuestion) => {
      const matchKey = `${publicQuestion.question_date}\t${publicQuestion.member_name_raw}`;
      const minutesIdentity = minutesByKey.get(matchKey);

      if (!minutesIdentity) {
        unmatchedPublicQuestions.push(matchKey);
        return null;
      }

      usedKeys.add(matchKey);
      const parsedMinutes = parseMinutesMarkdown(
        minutesIdentity.source_minutes_file_path,
        minutesRoot
      );

      return {
        slug: publicQuestion.slug,
        question_number: publicQuestion.question_number,
        question_date: publicQuestion.question_date,
        meeting_type: "general_question",
        style: "question",
        seat_type: publicQuestion.seat_type,
        member_id: publicQuestion.member_id,
        member_name_raw: publicQuestion.member_name_raw,
        source_file: parsedMinutes.source_file,
        extracted_overview: parsedMinutes.extracted_overview,
        keywords: parsedMinutes.keywords,
        review_flags: parsedMinutes.review_flags,
        question_items: parsedMinutes.question_items,
        full_text: parsedMinutes.full_text,
      };
    });

  if (unmatchedPublicQuestions.length > 0) {
    throw new Error(
      `Unmatched public questions: ${unmatchedPublicQuestions.join(", ")}`
    );
  }

  const extraMinutes = [...minutesByKey.keys()].filter((key) => !usedKeys.has(key));
  if (extraMinutes.length > 0) {
    throw new Error(`Unmatched minutes files: ${extraMinutes.join(", ")}`);
  }

  return canonicalQuestions;
}

function main() {
  const options = parseArgs(process.argv);
  if (!existsSync(options.minutesRoot)) {
    throw new Error(
      `Minutes root not found: ${options.minutesRoot}. Pass --minutes-root or set MIRAI_GIKAI_MINUTES_ROOT.`
    );
  }
  const publicData = JSON.parse(readFileSync(options.publicJsonPath, "utf-8"));
  const publicQuestions = publicData.questions ?? [];
  const minutesFiles = listMinutesFiles(options.minutesRoot);

  if (minutesFiles.length !== publicQuestions.length) {
    throw new Error(
      `Minutes count mismatch: expected ${publicQuestions.length}, got ${minutesFiles.length}`
    );
  }

  const minutesByKey = new Map();
  for (const minutesFile of minutesFiles) {
    const identity = parseMinutesFileIdentity(minutesFile);
    const key = `${identity.question_date}\t${identity.member_name_raw}`;
    if (minutesByKey.has(key)) {
      throw new Error(`Duplicate minutes identity detected: ${key}`);
    }
    minutesByKey.set(key, identity);
  }

  for (const overrideFile of options.minutesOverrideFiles) {
    if (!existsSync(overrideFile)) {
      throw new Error(`Override minutes file not found: ${overrideFile}`);
    }
    const identity = parseMinutesFileIdentity(overrideFile);
    const key = `${identity.question_date}\t${identity.member_name_raw}`;
    minutesByKey.set(key, identity);
  }

  const canonical = {
    schema_version: "v1",
    diet_session_slug: publicData.diet_session_slug,
    source_kind: "minutes_extracted",
    source_tool: "make_minutes.sh",
    source_public_json: relativizeFromRoot(options.publicJsonPath),
    questions: buildCanonicalQuestions(
      publicQuestions,
      minutesByKey,
      options.minutesRoot
    ),
  };

  validateCanonicalJson(canonical, publicQuestions);

  mkdirSync(path.dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(canonical, null, 2)}\n`);

  console.log("=".repeat(60));
  console.log("Canonical general questions JSON generated");
  console.log("=".repeat(60));
  console.log(`Public JSON : ${options.publicJsonPath}`);
  console.log(`Minutes root: ${options.minutesRoot}`);
  console.log(`Output      : ${options.outputPath}`);
  console.log(`Questions   : ${canonical.questions.length}`);
}

main();
