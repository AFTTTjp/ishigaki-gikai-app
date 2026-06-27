#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TARGETS = [
  {
    key: "rito-koshien",
    aliases: [
      "rito-koshien",
      "issue-r8d4-rito-koshien",
      "rito-koshien-r8-dai4",
    ],
    inputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/r8-dai4-teireikai.event-graph-v1-rito-koshien.review.json"
    ),
    outputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/r8-dai4-teireikai.timeline-review-rito-koshien.json"
    ),
    topicSlug: "rito-koshien-r8-dai4",
    issueId: "issue-r8d4-rito-koshien",
  },
];

const LABELS = {
  bill_introduction: "議案提出",
  committee_referral: "委員会付託",
  committee_discussion: "委員会で説明",
  general_question: "一般質問",
};

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function relativePath(filePath) {
  return relative(ROOT, filePath);
}

function unique(values) {
  return [...new Set(values)];
}

function parseArgs(argv) {
  const rawTarget = argv[2] ?? TARGETS[0].key;
  const target = TARGETS.find((entry) => entry.aliases.includes(rawTarget));
  if (!target) {
    const supported = TARGETS.map((entry) => entry.aliases.join(" / ")).join(", ");
    throw new Error(`Unsupported target: ${rawTarget}. Supported: ${supported}`);
  }
  return { target };
}

function summarizeEvent(event) {
  if (Array.isArray(event.notes) && event.notes.length > 0) {
    return String(event.notes[0]).trim();
  }
  return String(event.title ?? "").trim();
}

function toTimelineItem(event) {
  return {
    date: event.event_date,
    label: LABELS[event.event_type] ?? event.event_type,
    title: event.title,
    summary: summarizeEvent(event),
    event_type: event.event_type,
    status: event.status,
    source_refs: event.source_refs ?? [],
    evidence_ids: event.evidence_ids ?? [],
  };
}

function compareTimelineItems(a, b) {
  const dateDiff = String(a.date).localeCompare(String(b.date), "ja");
  if (dateDiff !== 0) return dateDiff;
  return String(a.title).localeCompare(String(b.title), "ja");
}

function buildTimelineReview(target) {
  const eventGraph = readJson(target.inputPath);

  if (eventGraph.schema !== "event-graph/v1-review") {
    throw new Error(`Unexpected event graph schema: ${eventGraph.schema}`);
  }
  if (eventGraph.issue_id !== target.issueId) {
    throw new Error(`Unexpected issue id: ${eventGraph.issue_id}`);
  }

  const timelineItems = (eventGraph.events ?? []).map(toTimelineItem).sort(compareTimelineItems);

  return {
    schema: "timeline-review/v1",
    topic_slug: target.topicSlug,
    issue_id: target.issueId,
    source_event_graph: relativePath(target.inputPath),
    timeline_items: timelineItems,
    review_required: unique([
      ...(eventGraph.review_required ?? []),
      "vote event is not included in timeline-review/v1",
      "candidate items should not be treated as confirmed public facts without review",
      "UI integration is not implemented in this review artifact",
    ]),
  };
}

function validateOutput(output) {
  if (output.schema !== "timeline-review/v1") {
    throw new Error(`Unexpected schema: ${output.schema}`);
  }
  if (!Array.isArray(output.timeline_items) || output.timeline_items.length !== 5) {
    throw new Error(
      `Expected 5 timeline items, got ${output.timeline_items?.length ?? 0}`
    );
  }

  const candidateCount = output.timeline_items.filter(
    (item) => item.status === "candidate"
  ).length;
  const confirmedCount = output.timeline_items.filter(
    (item) => item.status === "confirmed"
  ).length;

  if (candidateCount !== 3) {
    throw new Error(`Expected 3 candidate items, got ${candidateCount}`);
  }
  if (confirmedCount !== 2) {
    throw new Error(`Expected 2 confirmed items, got ${confirmedCount}`);
  }

  for (const item of output.timeline_items) {
    if (!item.date || !item.label || !item.title || !item.summary) {
      throw new Error("Timeline item is missing required display fields");
    }
  }
}

function main() {
  const { target } = parseArgs(process.argv);
  const output = buildTimelineReview(target);
  validateOutput(output);
  mkdirSync(path.dirname(target.outputPath), { recursive: true });
  writeFileSync(target.outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  console.log(
    `[topic-timeline-review] wrote ${relative(ROOT, target.outputPath)} (${output.timeline_items.length} items)`
  );
}

main();
