#!/usr/bin/env node

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULT_ISSUE_GRAPH_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-graph-pilot.json"
);
const DEFAULT_ARCHITECTURE_PATH = resolve(
  ROOT,
  "docs/architecture/issue-graph-r8-dai4.md"
);
const DEFAULT_PUBLIC_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions/r8-dai4-teireikai.general-questions.json"
);
const DEFAULT_SESSION_OVERVIEWS_PATH = resolve(
  ROOT,
  "web/src/features/diet-sessions/shared/data/session-overviews.ts"
);
const DEFAULT_TOPIC_DIR = resolve(
  ROOT,
  "docs/ishigaki_gikai_topics_dev_set"
);
const DEFAULT_BILL_SRC_PATHS = [
  resolve(ROOT, "docs/20260620_第4回定例会_議案本文整備第2弾_最小本文SQL.sql"),
  resolve(ROOT, "docs/20260610_第4回定例会_議案本文整備第1弾SQL.sql"),
];
const DEFAULT_OUTPUT_JSON_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-review-packet.json"
);
const DEFAULT_OUTPUT_MD_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-review-packet.md"
);

function parseArgs(argv) {
  const options = {
    issueGraphPath: DEFAULT_ISSUE_GRAPH_PATH,
    architecturePath: DEFAULT_ARCHITECTURE_PATH,
    publicJsonPath: DEFAULT_PUBLIC_JSON_PATH,
    sessionOverviewsPath: DEFAULT_SESSION_OVERVIEWS_PATH,
    topicDir: DEFAULT_TOPIC_DIR,
    billSrcPaths: DEFAULT_BILL_SRC_PATHS,
    outputJsonPath: DEFAULT_OUTPUT_JSON_PATH,
    outputMarkdownPath: DEFAULT_OUTPUT_MD_PATH,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--issue-graph") {
      options.issueGraphPath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--architecture") {
      options.architecturePath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--public-json") {
      options.publicJsonPath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--session-overviews") {
      options.sessionOverviewsPath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--topic-dir") {
      options.topicDir = resolve(argv[++i]);
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
  return String(value ?? "")
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

function parseSessionCommittees(filePath, sessionSlug) {
  const source = readFileSync(filePath, "utf-8");
  const sessionMarker = `"${sessionSlug}": {`;
  const sessionIndex = source.indexOf(sessionMarker);
  if (sessionIndex < 0) {
    throw new Error(`Session slug not found in session-overviews: ${sessionSlug}`);
  }

  const committeesIndex = source.indexOf("committees:", sessionIndex);
  if (committeesIndex < 0) {
    throw new Error(`committees section not found for ${sessionSlug}`);
  }

  const keyPointsIndex = source.indexOf("keyPoints:", committeesIndex);
  const section = source.slice(
    committeesIndex,
    keyPointsIndex >= 0 ? keyPointsIndex : undefined
  );

  const committees = [];
  let currentCommittee = null;
  let inItems = false;
  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine.trim();
    const nameMatch = line.match(/^name:\s*"([^"]+)",$/);
    if (nameMatch) {
      currentCommittee = { name: nameMatch[1], items: [] };
      inItems = false;
      continue;
    }

    if (line === "items: [") {
      inItems = true;
      continue;
    }

    if (inItems) {
      if (line === "]," || line === "],") {
        inItems = false;
        continue;
      }
      const itemMatch = line.match(/^"([^"]+)",?$/);
      if (itemMatch && currentCommittee) {
        currentCommittee.items.push(itemMatch[1]);
      }
      continue;
    }

    if (line === "}," && currentCommittee) {
      committees.push(currentCommittee);
      currentCommittee = null;
    }
  }

  return committees;
}

function parseBillSources(billSrcPaths) {
  const billsByNumber = new Map();

  const src20260620 = readFileSync(billSrcPaths[0], "utf-8");
  const rowRegex =
    /\('(?<name>議案第\d+号 [^']+)',\s*'(?<clean>[^']+)',\s*'(?<committee>[^']+)'\)/g;

  for (const match of src20260620.matchAll(rowRegex)) {
    const fullName = match.groups.name;
    const numberMatch = fullName.match(/^(議案第\d+号)/);
    if (!numberMatch) continue;
    billsByNumber.set(numberMatch[1], {
      bill_number: numberMatch[1],
      bill_name: fullName,
      bill_clean_title: match.groups.clean,
      committee_from_bill_src: match.groups.committee,
      source_file: relativizeFromRoot(billSrcPaths[0]),
    });
  }

  const src20260610 = readFileSync(billSrcPaths[1], "utf-8");
  const bill42Match = src20260610.match(/'議案第42号\s+([^']+)'/);
  if (bill42Match) {
    const fullName = `議案第42号 ${bill42Match[1]}`;
    billsByNumber.set("議案第42号", {
      bill_number: "議案第42号",
      bill_name: fullName,
      bill_clean_title: bill42Match[1],
      committee_from_bill_src: null,
      source_file: relativizeFromRoot(billSrcPaths[1]),
    });
  }

  return billsByNumber;
}

function parseTopics(topicDir) {
  const topics = new Map();
  const entries = readdirSync(topicDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".topic.json")) {
      continue;
    }
    const filePath = path.join(topicDir, entry.name);
    const data = readJson(filePath);
    topics.set(data.topic_slug, {
      topic_slug: data.topic_slug,
      topic_title: data.topic_title,
      topic_status: data.topic_status,
      topic_category: data.topic_category,
      source_file: relativizeFromRoot(filePath),
    });
  }
  return topics;
}

function buildQuestionIndex(publicData) {
  const bySlug = new Map();
  for (const question of publicData.questions) {
    const itemMap = new Map();
    for (const item of question.items) {
      itemMap.set(item.item_number, item);
    }
    bySlug.set(question.slug, { ...question, _itemMap: itemMap });
  }
  return bySlug;
}

function buildBillCommitteeMap(committees) {
  const map = new Map();
  for (const committee of committees) {
    for (const item of committee.items) {
      map.set(item, committee.name);
    }
  }
  return map;
}

function resolveGeneralQuestionRef(ref, questionIndex) {
  const question = questionIndex.get(ref.questionSlug);
  if (!question) {
    return {
      questionSlug: ref.questionSlug,
      itemNumber: ref.itemNumber,
      subItemIndex: ref.subItemIndex ?? null,
      member_name_raw: ref.member ?? null,
      item_title: ref.item_title ?? null,
      sub_item_text: null,
      resolved: false,
      reason: "question slug not found in public general questions JSON",
    };
  }

  const item = question._itemMap.get(ref.itemNumber);
  if (!item) {
    return {
      questionSlug: ref.questionSlug,
      itemNumber: ref.itemNumber,
      subItemIndex: ref.subItemIndex ?? null,
      member_name_raw: question.member_name_raw,
      item_title: ref.item_title ?? null,
      sub_item_text: null,
      resolved: false,
      reason: "item number not found in public general questions JSON",
    };
  }

  const subItemIndex =
    typeof ref.subItemIndex === "number" ? ref.subItemIndex : null;
  const sub_item_text =
    subItemIndex !== null ? item.sub_items[subItemIndex] ?? null : null;

  return {
    questionSlug: ref.questionSlug,
    itemNumber: ref.itemNumber,
    subItemIndex,
    member_name_raw: question.member_name_raw,
    item_title: item.title,
    sub_item_text,
    resolved:
      ref.resolved !== false &&
      (subItemIndex === null || sub_item_text !== null),
    reason:
      subItemIndex !== null && sub_item_text === null
        ? "subItemIndex out of range"
        : null,
    question_topic_slugs_source: question.topic_slugs ?? [],
  };
}

function enrichBill(billRef, billsByNumber, billCommitteeMap) {
  const exact = billsByNumber.get(billRef.bill_number);
  const committee = billCommitteeMap.get(billRef.bill_number) ?? null;
  return {
    bill_number: billRef.bill_number,
    bill_name: exact?.bill_name ?? null,
    bill_clean_title: exact?.bill_clean_title ?? null,
    committee,
    status: billRef.status,
    note: billRef.note ?? null,
    exact_bill_found: Boolean(exact),
    committee_found: Boolean(committee),
    source_file: exact?.source_file ?? null,
  };
}

function categorizeBills(issue, billsByNumber, billCommitteeMap) {
  const confirmed = [];
  const candidate = [];
  const unresolved = [];

  for (const billRef of issue.related_bills ?? []) {
    const enriched = enrichBill(billRef, billsByNumber, billCommitteeMap);
    if (!enriched.exact_bill_found || !enriched.committee_found) {
      unresolved.push({
        ...enriched,
        unresolved_reason: !enriched.exact_bill_found
          ? "exact bill name not found in local bill source files"
          : "committee not found in session-overviews committees",
      });
      continue;
    }

    if (billRef.status === "confirmed") {
      confirmed.push(enriched);
    } else {
      candidate.push(enriched);
    }
  }

  if ((issue.related_bills ?? []).length === 0) {
    unresolved.push({
      bill_number: null,
      bill_name: null,
      bill_clean_title: null,
      committee: null,
      status: "unresolved",
      note: "pilot source に related_bills が設定されていません",
      exact_bill_found: false,
      committee_found: false,
      source_file: null,
      unresolved_reason: "no bill candidate at source",
    });
  }

  return { confirmed, candidate, unresolved };
}

function categorizeTopics(issue, topicsBySlug) {
  const confirmed_at_source = [];
  const candidate = [];
  const newTopics = [];
  const unresolved = [];

  for (const topicRef of issue.related_topics ?? []) {
    const topic = topicRef.topic_slug ? topicsBySlug.get(topicRef.topic_slug) : null;
    const sourceConfirmedHits = (issue.related_general_question_items ?? []).filter(
      (ref) =>
        Array.isArray(ref.question_topic_slugs_source) &&
        ref.question_topic_slugs_source.includes(topicRef.topic_slug)
    ).length;

    const enriched = {
      topic_slug: topicRef.topic_slug ?? null,
      topic_title: topic?.topic_title ?? null,
      topic_status: topic?.topic_status ?? null,
      topic_category: topic?.topic_category ?? null,
      source_file: topic?.source_file ?? null,
      status: topicRef.status,
      note: topicRef.note ?? null,
      exact_topic_found: Boolean(topic),
      source_confirmed_hits: sourceConfirmedHits,
    };

    if (topicRef.status === "confirmed_at_source") {
      if (!topic || sourceConfirmedHits === 0) {
        unresolved.push({
          ...enriched,
          unresolved_reason: !topic
            ? "confirmed_at_source topic slug not found in local topic files"
            : "confirmed_at_source but no related_general_question_items carry this source topic slug",
        });
      } else {
        confirmed_at_source.push(enriched);
      }
      continue;
    }

    if (topicRef.status === "candidate") {
      if (!topic) {
        unresolved.push({
          ...enriched,
          unresolved_reason: "candidate topic slug not found in local topic files",
        });
      } else {
        candidate.push(enriched);
      }
      continue;
    }

    if (topicRef.status === "new") {
      newTopics.push(enriched);
      continue;
    }

    unresolved.push({
      ...enriched,
      unresolved_reason: "unknown topic status",
    });
  }

  if ((issue.related_topics ?? []).length === 0) {
    unresolved.push({
      topic_slug: null,
      topic_title: null,
      topic_status: null,
      topic_category: null,
      source_file: null,
      status: "unresolved",
      note: "pilot source に related_topics が設定されていません",
      exact_topic_found: false,
      source_confirmed_hits: 0,
      unresolved_reason: "no topic candidate at source",
    });
  }

  return {
    confirmed_at_source,
    candidate,
    new: newTopics,
    unresolved,
  };
}

function buildRelatedCommittees(billCategories) {
  const committees = new Map();
  for (const bucket of ["confirmed", "candidate"]) {
    for (const bill of billCategories[bucket]) {
      if (!bill.committee) continue;
      const key = `${bill.committee}\t${bill.bill_number}`;
      committees.set(key, {
        name: bill.committee,
        via_bill: bill.bill_number,
        bill_name: bill.bill_name,
        status: bill.status,
      });
    }
  }
  return [...committees.values()].sort((a, b) =>
    `${a.name}\t${a.via_bill}`.localeCompare(`${b.name}\t${b.via_bill}`, "ja")
  );
}

function deriveReviewRequired(issue, resolvedRefs, billCategories, topicCategories) {
  const derived = [];
  if (resolvedRefs.some((ref) => !ref.resolved)) {
    derived.push("related_general_question_items に unresolved ref があります");
  }
  if (billCategories.candidate.length > 0) {
    derived.push("related_bills に candidate があります");
  }
  if (billCategories.unresolved.some((bill) => bill.bill_number !== null)) {
    derived.push("bill 候補の exact 解決に失敗したものがあります");
  }
  if (
    topicCategories.candidate.length > 0 ||
    topicCategories.new.length > 0 ||
    topicCategories.unresolved.some((topic) => topic.topic_slug !== null)
  ) {
    derived.push("topic 候補の確認が必要です");
  }

  return [...new Set([...(issue.review_required ?? []), ...derived])];
}

function buildPacket(options) {
  const issueGraph = readJson(options.issueGraphPath);
  const publicData = readJson(options.publicJsonPath);
  const committees = parseSessionCommittees(
    options.sessionOverviewsPath,
    issueGraph.diet_session_slug
  );
  const billsByNumber = parseBillSources(options.billSrcPaths);
  const topicsBySlug = parseTopics(options.topicDir);
  const questionIndex = buildQuestionIndex(publicData);
  const billCommitteeMap = buildBillCommitteeMap(committees);

  const issues = issueGraph.issues.map((issue) => {
    const resolvedRefs = (issue.related_general_question_items ?? []).map((ref) =>
      resolveGeneralQuestionRef(ref, questionIndex)
    );
    const billCategories = categorizeBills(issue, billsByNumber, billCommitteeMap);
    const topicCategories = categorizeTopics(issue, topicsBySlug);
    const related_committees = buildRelatedCommittees(billCategories);
    const review_required = deriveReviewRequired(
      issue,
      resolvedRefs,
      billCategories,
      topicCategories
    );

    return {
      issue_id: issue.issue_id,
      title: issue.title,
      citizen_question: issue.citizen_question,
      summary: issue.summary,
      related_general_question_items: resolvedRefs,
      related_bills: billCategories,
      related_topics: topicCategories,
      related_committees,
      evidence_anchors: issue.evidence_anchors ?? [],
      review_required,
    };
  });

  const resolvedCount = issues.reduce(
    (sum, issue) =>
      sum +
      issue.related_general_question_items.filter((ref) => ref.resolved).length,
    0
  );
  const unresolvedCount = issues.reduce(
    (sum, issue) =>
      sum +
      issue.related_general_question_items.filter((ref) => !ref.resolved).length,
    0
  );
  const uniqueBillRows = [];
  const seenBillKeys = new Set();
  const uniqueTopicRows = [];
  const seenTopicKeys = new Set();

  for (const issue of issues) {
    for (const bucket of ["confirmed", "candidate", "unresolved"]) {
      for (const bill of issue.related_bills[bucket]) {
        const key = `${issue.issue_id}\t${bucket}\t${bill.bill_number ?? "none"}`;
        if (seenBillKeys.has(key)) continue;
        seenBillKeys.add(key);
        uniqueBillRows.push({
          issue_id: issue.issue_id,
          bucket,
          bill_number: bill.bill_number,
          bill_name: bill.bill_name,
          committee: bill.committee,
          note: bill.note,
        });
      }
    }

    for (const bucket of ["confirmed_at_source", "candidate", "new", "unresolved"]) {
      for (const topic of issue.related_topics[bucket]) {
        const key = `${issue.issue_id}\t${bucket}\t${topic.topic_slug ?? "none"}`;
        if (seenTopicKeys.has(key)) continue;
        seenTopicKeys.add(key);
        uniqueTopicRows.push({
          issue_id: issue.issue_id,
          bucket,
          topic_slug: topic.topic_slug,
          topic_title: topic.topic_title,
          note: topic.note,
        });
      }
    }
  }

  const packet = {
    schema_version: "issue-review-packet/v1",
    diet_session_slug: issueGraph.diet_session_slug,
    source_files: {
      issue_graph_pilot: relativizeFromRoot(options.issueGraphPath),
      architecture: relativizeFromRoot(options.architecturePath),
      public_general_questions: relativizeFromRoot(options.publicJsonPath),
      session_overviews: relativizeFromRoot(options.sessionOverviewsPath),
      topic_dir: relativizeFromRoot(options.topicDir),
      bill_sources: options.billSrcPaths.map(relativizeFromRoot),
    },
    summary: {
      issue_count: issues.length,
      issue_ids: issues.map((issue) => issue.issue_id),
      related_general_question_item_resolution: {
        resolved: resolvedCount,
        unresolved: unresolvedCount,
      },
      unresolved_issue_ids: issues
        .filter(
          (issue) =>
            issue.related_general_question_items.some((ref) => !ref.resolved) ||
            issue.related_bills.unresolved.length > 0 ||
            issue.related_topics.unresolved.length > 0
        )
        .map((issue) => issue.issue_id),
      bill_candidates_index: uniqueBillRows,
      topic_candidates_index: uniqueTopicRows,
    },
    issues,
  };

  if (issues.length !== 7) {
    throw new Error(`Expected 7 pilot issues, got ${issues.length}`);
  }

  return packet;
}

function bulletList(items, formatter) {
  if (items.length === 0) {
    return "- なし";
  }
  return items.map((item) => `- ${formatter(item)}`).join("\n");
}

function renderBillTable(rows) {
  if (rows.length === 0) {
    return "なし";
  }
  const lines = [
    "| status | 議案番号 | 議案名 | 委員会 | note |",
    "|---|---|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.status ?? row.bucket ?? "—"} | ${row.bill_number ?? "—"} | ${row.bill_name ?? "—"} | ${row.committee ?? "—"} | ${row.note ?? "—"} |`
    );
  }
  return lines.join("\n");
}

function renderTopicTable(rows, label) {
  if (rows.length === 0) {
    return `- ${label}: なし`;
  }
  const lines = [
    `- ${label}:`,
    "| status | topic_slug | topic_title | note |",
    "|---|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.status ?? row.bucket ?? "—"} | ${row.topic_slug ?? "—"} | ${row.topic_title ?? "—"} | ${row.note ?? "—"} |`
    );
  }
  return lines.join("\n");
}

function renderRefTable(refs) {
  if (refs.length === 0) {
    return "なし";
  }
  const lines = [
    "| resolved | questionSlug | itemNumber | subItemIndex | member | item title | sub_item text |",
    "|---|---|---:|---:|---|---|---|",
  ];
  for (const ref of refs) {
    lines.push(
      `| ${ref.resolved ? "true" : "false"} | ${ref.questionSlug} | ${ref.itemNumber} | ${ref.subItemIndex ?? "—"} | ${ref.member_name_raw ?? "—"} | ${ref.item_title ?? "—"} | ${ref.sub_item_text ?? "—"} |`
    );
  }
  return lines.join("\n");
}

function buildMarkdown(packet) {
  const lines = [];
  lines.push("# Issue Review Packet");
  lines.push("");
  lines.push(`- issue_count: ${packet.summary.issue_count}`);
  lines.push(
    `- related_general_question_items: resolved=${packet.summary.related_general_question_item_resolution.resolved}, unresolved=${packet.summary.related_general_question_item_resolution.unresolved}`
  );
  lines.push("");
  lines.push("## Issue 7件一覧");
  lines.push("");
  for (const issue of packet.issues) {
    lines.push(`- ${issue.issue_id}: ${issue.title}`);
  }
  lines.push("");
  lines.push("## Unresolved Summary");
  lines.push("");
  lines.push(
    bulletList(packet.summary.unresolved_issue_ids, (value) => value)
  );
  lines.push("");

  for (const issue of packet.issues) {
    const billRows = [
      ...issue.related_bills.confirmed,
      ...issue.related_bills.candidate,
      ...issue.related_bills.unresolved,
    ];
    const topicRows = [
      ...issue.related_topics.confirmed_at_source,
      ...issue.related_topics.candidate,
      ...issue.related_topics.new,
      ...issue.related_topics.unresolved,
    ];

    lines.push(`## ${issue.title}`);
    lines.push("");
    lines.push(`- issue_id: ${issue.issue_id}`);
    lines.push(`- citizen_question: ${issue.citizen_question}`);
    lines.push(`- summary: ${issue.summary}`);
    lines.push(`- review_required_count: ${issue.review_required.length}`);
    lines.push("");
    lines.push("### General Question Item Refs");
    lines.push("");
    lines.push(renderRefTable(issue.related_general_question_items));
    lines.push("");
    lines.push("### Related Bills");
    lines.push("");
    lines.push(renderBillTable(billRows));
    lines.push("");
    lines.push("### Related Topics");
    lines.push("");
    lines.push(renderTopicTable(issue.related_topics.confirmed_at_source, "confirmed_at_source"));
    lines.push("");
    lines.push(renderTopicTable(issue.related_topics.candidate, "candidate"));
    lines.push("");
    lines.push(renderTopicTable(issue.related_topics.new, "new"));
    lines.push("");
    lines.push(renderTopicTable(issue.related_topics.unresolved, "unresolved"));
    lines.push("");
    lines.push("### Related Committees");
    lines.push("");
    lines.push(
      bulletList(
        issue.related_committees,
        (committee) =>
          `${committee.name} (via ${committee.via_bill}${committee.bill_name ? ` / ${committee.bill_name}` : ""})`
      )
    );
    lines.push("");
    lines.push("### Evidence Anchors");
    lines.push("");
    lines.push(
      bulletList(issue.evidence_anchors, (anchor) => {
        const texts = (anchor.raw_anchor_texts ?? []).join(" / ");
        return `${anchor.questionSlug} ${anchor.member ? `(${anchor.member})` : ""}: ${texts}${anchor.note ? ` [${anchor.note}]` : ""}`;
      })
    );
    lines.push("");
    lines.push("### Review Required");
    lines.push("");
    lines.push(bulletList(issue.review_required, (item) => item));
    lines.push("");
  }

  lines.push("## Bill Candidates Index");
  lines.push("");
  lines.push(renderBillTable(packet.summary.bill_candidates_index));
  lines.push("");
  lines.push("## Topic Candidates Index");
  lines.push("");
  lines.push(
    renderTopicTable(packet.summary.topic_candidates_index, "all")
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv);
  const packet = buildPacket(options);

  mkdirSync(dirname(options.outputJsonPath), { recursive: true });
  mkdirSync(dirname(options.outputMarkdownPath), { recursive: true });
  writeFileSync(options.outputJsonPath, `${JSON.stringify(packet, null, 2)}\n`);
  writeFileSync(options.outputMarkdownPath, buildMarkdown(packet));

  console.log("=".repeat(60));
  console.log("Issue review packet generated");
  console.log("=".repeat(60));
  console.log(`Issue graph : ${options.issueGraphPath}`);
  console.log(`Output JSON : ${options.outputJsonPath}`);
  console.log(`Output MD   : ${options.outputMarkdownPath}`);
  console.log(`Issues      : ${packet.summary.issue_count}`);
  console.log(
    `GQ refs     : resolved=${packet.summary.related_general_question_item_resolution.resolved}, unresolved=${packet.summary.related_general_question_item_resolution.unresolved}`
  );
}

main();
