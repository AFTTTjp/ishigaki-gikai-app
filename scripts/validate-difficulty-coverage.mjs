#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateAndNormalizeGeneralQuestionsDocument } from "./import-general-questions-validation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_GENERAL_QUESTIONS_FILE = path.join(
  ROOT,
  "docs/general_questions/r8-dai4-teireikai.general-questions.json"
);
const DEFAULT_TOPICS_DIR = path.join(ROOT, "docs/ishigaki_gikai_topics_dev_set");
const PUBLIC_JSON_FORBIDDEN_KEYS = new Set([
  "candidate_id",
  "decision",
  "review_decision",
  "final_approval_status",
  "public_eligibility",
  "review_notes",
  "reviewer_notes",
  "evidence_excerpt",
  "attribution_confidence",
  "item_match_confidence",
]);
const VALID_DIFFICULTY_LEVELS = new Set(["normal", "hard"]);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function makeFinding(kind, scope, message) {
  return { kind, scope, message };
}

function increment(stats, key) {
  stats[key] += 1;
}

function comparePairCoverage(stats, normal, hard) {
  if (normal && hard) {
    increment(stats, "both");
    return;
  }
  if (normal) {
    increment(stats, "normal_only");
    increment(stats, "hard_fallback");
    return;
  }
  if (hard) {
    increment(stats, "hard_only");
    return;
  }
  increment(stats, "neither");
}

function scanForbiddenPublicKeys(value, scope, findings) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      scanForbiddenPublicKeys(entry, `${scope}[${index}]`, findings)
    );
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const nextScope = `${scope}.${key}`;
    if (PUBLIC_JSON_FORBIDDEN_KEYS.has(key)) {
      findings.push(
        makeFinding(
          "blocking",
          nextScope,
          "reviewer-only field must not appear in public JSON"
        )
      );
    }
    scanForbiddenPublicKeys(entry, nextScope, findings);
  }
}

export function collectGeneralQuestionsCoverage(document, jsonPath = "general-questions.json") {
  const findings = [];
  scanForbiddenPublicKeys(document, jsonPath, findings);
  const normalized = validateAndNormalizeGeneralQuestionsDocument(
    document,
    jsonPath
  );
  const questionSlugs = new Set();
  const itemKeys = new Set();
  const stats = {
    questions_total: normalized.questions.length,
    items_total: 0,
    normal_description: 0,
    detailed_description: 0,
    both: 0,
    normal_only: 0,
    detailed_only: 0,
    neither: 0,
    hard_fallback: 0,
    identical_description: 0,
  };

  for (const question of normalized.questions) {
    if (questionSlugs.has(question.slug)) {
      findings.push(
        makeFinding("blocking", question.slug, "duplicate general question slug")
      );
    }
    questionSlugs.add(question.slug);

    for (const item of question.items) {
      stats.items_total += 1;
      const itemKey = `${question.slug}.item${item.item_number}`;
      if (itemKeys.has(itemKey)) {
        findings.push(
          makeFinding("blocking", itemKey, "duplicate general question item key")
        );
      }
      itemKeys.add(itemKey);

      const hasNormal = hasText(item.normal_description);
      const hasDetailed = hasText(item.detailed_description);
      if (hasNormal) increment(stats, "normal_description");
      if (hasDetailed) increment(stats, "detailed_description");
      if (hasNormal && hasDetailed) {
        increment(stats, "both");
        if (item.normal_description === item.detailed_description) {
          increment(stats, "identical_description");
          findings.push(
            makeFinding(
              "warning",
              itemKey,
              "normal_description and detailed_description are identical"
            )
          );
        }
      } else if (hasNormal) {
        increment(stats, "normal_only");
        increment(stats, "hard_fallback");
        findings.push(
          makeFinding(
            "warning",
            itemKey,
            "hard mode will fallback to normal_description"
          )
        );
      } else if (hasDetailed) {
        increment(stats, "detailed_only");
        findings.push(
          makeFinding(
            "blocking",
            itemKey,
            "detailed_description must not exist without normal_description"
          )
        );
      } else {
        increment(stats, "neither");
        findings.push(
          makeFinding("warning", itemKey, "item has no difficulty descriptions")
        );
      }
    }
  }

  return {
    source: "json",
    stats,
    findings,
  };
}

export function collectTopicsCoverage(topics) {
  const findings = [];
  const topicSlugs = new Set();
  const stats = {
    total: topics.length,
    normal_content: 0,
    hard_content: 0,
    both: 0,
    normal_only: 0,
    hard_only: 0,
    neither: 0,
    hard_fallback: 0,
  };

  for (const topic of topics) {
    const slug = topic.topic_slug;
    if (!hasText(slug)) {
      findings.push(makeFinding("blocking", "topics", "topic_slug is required"));
      continue;
    }
    if (topicSlugs.has(slug)) {
      findings.push(makeFinding("blocking", slug, "duplicate topic_slug"));
    }
    topicSlugs.add(slug);

    const hasNormal = hasText(topic.content);
    const hasHard = hasText(topic.content_hard);
    if (hasNormal) increment(stats, "normal_content");
    if (hasHard) increment(stats, "hard_content");
    comparePairCoverage(stats, hasNormal, hasHard);

    if (hasHard && !hasNormal) {
      findings.push(
        makeFinding("blocking", slug, "content_hard must not exist without content")
      );
    } else if (hasNormal && !hasHard) {
      findings.push(
        makeFinding("warning", slug, "hard mode will fallback to topic.content")
      );
    } else if (!hasNormal && !hasHard) {
      findings.push(
        makeFinding("warning", slug, "topic has no normal or hard content")
      );
    }
  }

  return {
    source: "json",
    stats,
    findings,
  };
}

function collectBillRowsCoverage(rows) {
  const findings = [];
  const stats = {
    published_total: rows.length,
    normal: 0,
    hard: 0,
    both: 0,
    normal_only: 0,
    hard_only: 0,
    neither: 0,
    hard_fallback: 0,
    identical_title: 0,
    identical_summary: 0,
    identical_content: 0,
  };

  for (const bill of rows) {
    const contents = Array.isArray(bill.bill_contents) ? bill.bill_contents : [];
    const byDifficulty = new Map();
    for (const content of contents) {
      if (!VALID_DIFFICULTY_LEVELS.has(content.difficulty_level)) {
        findings.push(
          makeFinding(
            "blocking",
            bill.id,
            `unknown difficulty value: ${content.difficulty_level}`
          )
        );
        continue;
      }
      if (byDifficulty.has(content.difficulty_level)) {
        findings.push(
          makeFinding(
            "blocking",
            bill.id,
            `duplicate ${content.difficulty_level} bill_content record`
          )
        );
      }
      byDifficulty.set(content.difficulty_level, content);
    }

    const normal = byDifficulty.get("normal");
    const hard = byDifficulty.get("hard");
    if (normal) increment(stats, "normal");
    if (hard) increment(stats, "hard");
    comparePairCoverage(stats, Boolean(normal), Boolean(hard));

    if (hard && !normal) {
      findings.push(
        makeFinding("blocking", bill.id, "hard bill_content exists without normal")
      );
    } else if (normal && !hard) {
      findings.push(
        makeFinding("warning", bill.id, "hard mode will fallback to normal bill_content")
      );
    } else if (!normal && !hard) {
      findings.push(
        makeFinding("warning", bill.id, "published bill has no difficulty content")
      );
    }

    if (normal && hard) {
      for (const field of ["title", "summary", "content"]) {
        if ((normal[field] ?? "").trim() === (hard[field] ?? "").trim()) {
          increment(stats, `identical_${field}`);
          findings.push(
            makeFinding(
              "warning",
              bill.id,
              `normal/hard ${field} are identical`
            )
          );
        }
      }
    }
  }

  return {
    source: "db",
    stats,
    findings,
  };
}

export function collectBillsCoverageFromRows(rows) {
  return collectBillRowsCoverage(rows);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readTopicFiles(topicsDir) {
  const entries = await fs.readdir(topicsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".topic.json"))
    .map((entry) => path.join(topicsDir, entry.name))
    .sort();
  return Promise.all(files.map((file) => readJson(file)));
}

async function collectBillsCoverageFromDb() {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --db"
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase
    .from("bills")
    .select("id, name, bill_contents(difficulty_level,title,summary,content)")
    .eq("publish_status", "published");

  if (error) {
    throw new Error(`Failed to fetch bills: ${error.message}`);
  }

  return collectBillRowsCoverage(data ?? []);
}

function formatFindings(findings) {
  if (findings.length === 0) {
    return "none";
  }
  return findings
    .map((finding) => `- [${finding.kind}] ${finding.scope}: ${finding.message}`)
    .join("\n");
}

function printHumanSummary(report) {
  console.log("Difficulty coverage validation");
  console.log("=".repeat(30));
  console.log("");
  console.log("Bills");
  if (report.bills.source === "not_collected") {
    console.log("  source: not collected (run with --db for published bills)");
  } else {
    const s = report.bills.stats;
    console.log(`  source: ${report.bills.source}`);
    console.log(`  both ${s.both} / ${s.published_total}`);
    console.log(`  normal only ${s.normal_only}, hard only ${s.hard_only}, neither ${s.neither}`);
    console.log(
      `  identical title ${s.identical_title}, summary ${s.identical_summary}, content ${s.identical_content}`
    );
  }
  console.log("");
  console.log("Topics");
  {
    const s = report.topics.stats;
    console.log(`  both ${s.both} / ${s.total}`);
    console.log(`  normal only ${s.normal_only}, hard only ${s.hard_only}, neither ${s.neither}`);
  }
  console.log("");
  console.log("General Questions");
  {
    const s = report.general_questions.stats;
    console.log(`  questions ${s.questions_total}, items ${s.items_total}`);
    console.log(`  both ${s.both} / ${s.items_total}`);
    console.log(
      `  normal only ${s.normal_only}, detailed only ${s.detailed_only}, neither ${s.neither}`
    );
  }
  console.log("");
  console.log(`Blocking findings: ${report.blocking_count}`);
  console.log(formatFindings(report.findings.filter((f) => f.kind === "blocking")));
  console.log("");
  console.log(`Warning findings: ${report.warning_count}`);
  console.log(formatFindings(report.findings.filter((f) => f.kind === "warning")));
}

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
    db: argv.includes("--db"),
  };
}

export async function buildDifficultyCoverageReport(options = {}) {
  const topics = await readTopicFiles(options.topicsDir ?? DEFAULT_TOPICS_DIR);
  const generalQuestions = await readJson(
    options.generalQuestionsFile ?? DEFAULT_GENERAL_QUESTIONS_FILE
  );
  const bills = options.db
    ? await collectBillsCoverageFromDb()
    : {
        source: "not_collected",
        stats: null,
        findings: [
          makeFinding(
            "warning",
            "bills",
            "published bill coverage requires --db because no complete bill source JSON exists"
          ),
        ],
      };
  const report = {
    bills,
    topics: collectTopicsCoverage(topics),
    general_questions: collectGeneralQuestionsCoverage(
      generalQuestions,
      options.generalQuestionsFile ?? DEFAULT_GENERAL_QUESTIONS_FILE
    ),
  };
  const findings = [
    ...report.bills.findings,
    ...report.topics.findings,
    ...report.general_questions.findings,
  ];
  return {
    ...report,
    findings,
    blocking_count: findings.filter((finding) => finding.kind === "blocking")
      .length,
    warning_count: findings.filter((finding) => finding.kind === "warning")
      .length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  try {
    const report = await buildDifficultyCoverageReport({ db: options.db });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printHumanSummary(report);
    }
    process.exit(report.blocking_count > 0 ? 1 : 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
