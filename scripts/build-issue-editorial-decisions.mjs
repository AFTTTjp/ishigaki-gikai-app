#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULT_REVIEW_PACKET_JSON = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-review-packet.json"
);
const DEFAULT_REVIEW_PACKET_MD = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-review-packet.md"
);
const DEFAULT_ISSUE_GRAPH_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-graph-pilot.json"
);
const DEFAULT_ARCHITECTURE_PATH = resolve(
  ROOT,
  "docs/architecture/issue-graph-r8-dai4.md"
);
const DEFAULT_OUTPUT_JSON = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-editorial-decisions.json"
);
const DEFAULT_OUTPUT_MD = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-editorial-decisions.md"
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

function parseArgs(argv) {
  const options = {
    reviewPacketJson: DEFAULT_REVIEW_PACKET_JSON,
    reviewPacketMd: DEFAULT_REVIEW_PACKET_MD,
    issueGraphPath: DEFAULT_ISSUE_GRAPH_PATH,
    architecturePath: DEFAULT_ARCHITECTURE_PATH,
    outputJson: DEFAULT_OUTPUT_JSON,
    outputMarkdown: DEFAULT_OUTPUT_MD,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--review-packet-json") {
      options.reviewPacketJson = resolve(argv[++i]);
      continue;
    }
    if (arg === "--review-packet-md") {
      options.reviewPacketMd = resolve(argv[++i]);
      continue;
    }
    if (arg === "--issue-graph") {
      options.issueGraphPath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--architecture") {
      options.architecturePath = resolve(argv[++i]);
      continue;
    }
    if (arg === "--output-json") {
      options.outputJson = resolve(argv[++i]);
      continue;
    }
    if (arg === "--output-markdown") {
      options.outputMarkdown = resolve(argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function buildIssueMap(reviewPacket) {
  const map = new Map();
  for (const issue of reviewPacket.issues) {
    map.set(issue.issue_id, issue);
  }
  return map;
}

function buildBillIndex(reviewPacket) {
  const map = new Map();
  for (const row of reviewPacket.summary.bill_candidates_index) {
    const key = `${row.issue_id}\t${row.bill_number ?? "none"}`;
    map.set(key, row);
  }
  return map;
}

function buildTopicIndex(reviewPacket) {
  const map = new Map();
  for (const row of reviewPacket.summary.topic_candidates_index) {
    const key = `${row.issue_id}\t${row.topic_slug ?? "none"}`;
    map.set(key, row);
  }
  return map;
}

function pickBill(billIndex, issueId, billNumber) {
  const row = billIndex.get(`${issueId}\t${billNumber}`);
  if (!row) {
    throw new Error(`Bill not found in review packet: ${issueId} / ${billNumber}`);
  }
  return {
    bill_number: row.bill_number,
    bill_name: row.bill_name,
    committee: row.committee,
    note: row.note,
  };
}

function pickTopic(topicIndex, issueId, topicSlug) {
  const row = topicIndex.get(`${issueId}\t${topicSlug}`);
  if (!row) {
    throw new Error(`Topic not found in review packet: ${issueId} / ${topicSlug}`);
  }
  return {
    topic_slug: row.topic_slug,
    topic_title: row.topic_title,
    note: row.note,
  };
}

function validateReviewPacket(reviewPacket) {
  const ids = reviewPacket.summary.issue_ids;
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_ISSUE_IDS)) {
    throw new Error("Issue ids in review packet do not match expected pilot 7");
  }
}

function buildIssueDecision({ issueId, issueMap, billIndex, topicIndex }) {
  const issue = issueMap.get(issueId);
  if (!issue) {
    throw new Error(`Issue not found in review packet: ${issueId}`);
  }

  switch (issueId) {
    case "issue-r8d4-keelung-route":
      return {
        issue_id: issueId,
        title: issue.title,
        editorial_status: "needs_topic_decision",
        confirmed_bills: [],
        candidate_bills: [pickBill(billIndex, issueId, "議案第45号")],
        confirmed_topics: [],
        candidate_topics: [
          pickTopic(topicIndex, issueId, "ishigaki-keelung-route-yaimamaru"),
        ],
        new_topic_candidates: [],
        split_notes: [],
        editor_notes: [
          "議案第45号は友好都市提携の議案であり、航路論点との接続は現時点では candidate 維持が妥当。",
          "既存 topic `ishigaki-keelung-route-yaimamaru` は存在するが、source topic_slugs での裏付けはないため candidate 維持。",
        ],
        next_action: [
          "議案第45号を keyPoint の relatedBills に採るかを編集者が最終確認する。",
          "既存 topic を keyPoint 側へ使うか、Issue 単独で扱うかを確認する。",
        ],
      };

    case "issue-r8d4-rito-koshien":
      return {
        issue_id: issueId,
        title: issue.title,
        editorial_status: "ready_for_keypoint_draft",
        confirmed_bills: [pickBill(billIndex, issueId, "議案第42号")],
        candidate_bills: [],
        confirmed_topics: [
          pickTopic(topicIndex, issueId, "rito-koshien-r8-dai4"),
        ],
        candidate_topics: [],
        new_topic_candidates: [],
        split_notes: [],
        editor_notes: [
          "一般質問 item ref 2件、議案第42号、既存 topic が一直線につながっており、pilot 7件の中で最も keyPoint 化しやすい。",
          "topic は source topic_slugs による confirmed_at_source を維持する。",
        ],
        next_action: [
          "keyPoint draft に進める前提で、status 文言と citizen-facing oneLine の草案を別途作る。",
        ],
      };

    case "issue-r8d4-former-cityhall":
      return {
        issue_id: issueId,
        title: issue.title,
        editorial_status: "keep_as_issue_only",
        confirmed_bills: [],
        candidate_bills: [],
        confirmed_topics: [
          pickTopic(topicIndex, issueId, "ishigaki-old-city-hall"),
        ],
        candidate_topics: [],
        new_topic_candidates: [],
        split_notes: [],
        editor_notes: [
          "既存 topic `ishigaki-old-city-hall` との接続は強い一方、今回 packet source には会期 bill 候補が置かれていない。",
          "現段階では会期 keyPoint へ昇格させるより、Issue として保持しつつ既存 topic への導線として扱う方が安全。",
        ],
        next_action: [
          "session-overview に出す場合でも relatedBills なしで扱うかを編集者が判断する。",
        ],
      };

    case "issue-r8d4-lodging-tax-finance":
      return {
        issue_id: issueId,
        title: issue.title,
        editorial_status: "needs_topic_decision",
        confirmed_bills: [pickBill(billIndex, issueId, "議案第36号")],
        candidate_bills: [
          pickBill(billIndex, issueId, "議案第41号"),
          pickBill(billIndex, issueId, "議案第42号"),
        ],
        confirmed_topics: [],
        candidate_topics: [],
        new_topic_candidates: [
          {
            proposed_title: "宿泊税と観光財源・基金の使い方",
            note: "議案第36号を中心に、議案第41号・第42号を周辺論点として束ねる新規 topic 候補。",
          },
        ],
        split_notes: [],
        editor_notes: [
          "議案第36号は論点の中心に近く、editorial 上は confirmed_bills へ寄せる案が妥当。",
          "議案第41号・第42号は寄付金・一般財源の文脈で関係するが、中心 bill ではないため candidate 維持。",
        ],
        next_action: [
          "新規 topic 化するか、Issue のみで留めるかを編集者が決める。",
          "topic 化する場合の title / slug を別途確定する。",
        ],
      };

    case "issue-r8d4-municipal-housing":
      return {
        issue_id: issueId,
        title: issue.title,
        editorial_status: "needs_topic_decision",
        confirmed_bills: [pickBill(billIndex, issueId, "議案第40号")],
        candidate_bills: [],
        confirmed_topics: [],
        candidate_topics: [],
        new_topic_candidates: [
          {
            proposed_title: "市営住宅・住まいの確保",
            note: "議案第40号と一般質問 item ref 4件を束ねる新規 topic 候補。",
          },
        ],
        split_notes: [],
        editor_notes: [
          "議案第40号は市営住宅 issue の中心 bill とみなしてよい。",
          "既存 topic は無いため、新規 topic を作るか、Issue のみで扱うかの判断が必要。",
        ],
        next_action: [
          "新規 topic 候補の可否を決める。",
          "keyPoint に進める場合は住まい確保の市民向け問いを短く整える。",
        ],
      };

    case "issue-r8d4-school-education":
      return {
        issue_id: issueId,
        title: issue.title,
        editorial_status: "needs_split",
        confirmed_bills: [],
        candidate_bills: [
          pickBill(billIndex, issueId, "議案第48号"),
          pickBill(billIndex, issueId, "議案第49号"),
        ],
        confirmed_topics: [],
        candidate_topics: [],
        new_topic_candidates: [],
        split_notes: [
          "議案第48号・第49号は GIGA 端末取得には直接つながるが、学校統廃合・給食・図書館・教育環境全体とは別軸になりやすい。",
          "sub_issue 例: `school-giga-devices` / `school-environment-and-reorganization`",
        ],
        editor_notes: [
          "現状の issue は教育全体を束ねすぎており、GIGA 端末議案を confirmed_bills に上げると論点が広すぎる。",
          "まず split してから keyPoint or topic 判断に進む方が安全。",
        ],
        next_action: [
          "教育全体 issue を 2 つ以上の sub_issue に分ける案を作る。",
        ],
      };

    case "issue-r8d4-disaster-fire-rescue":
      return {
        issue_id: issueId,
        title: issue.title,
        editorial_status: "needs_split",
        confirmed_bills: [],
        candidate_bills: [
          pickBill(billIndex, issueId, "議案第50号"),
          pickBill(billIndex, issueId, "議案第51号"),
        ],
        confirmed_topics: [],
        candidate_topics: [],
        new_topic_candidates: [],
        split_notes: [
          "議案第50号・第51号は消防救急車両の取得に接続するが、津波避難・有事・平和まで同一 issue に束ねると論点が広すぎる。",
          "sub_issue 例: `fire-and-ambulance-assets` / `tsunami-evacuation-and-civil-protection`",
        ],
        editor_notes: [
          "消防救急の asset issue と、津波避難・国民保護の policy issue は分けて扱う方が編集しやすい。",
        ],
        next_action: [
          "消防救急車両 issue と避難・有事 issue の分割案を先に作る。",
        ],
      };

    default:
      throw new Error(`No editorial template for issue: ${issueId}`);
  }
}

function buildDecisions(reviewPacket, options) {
  validateReviewPacket(reviewPacket);
  const issueMap = buildIssueMap(reviewPacket);
  const billIndex = buildBillIndex(reviewPacket);
  const topicIndex = buildTopicIndex(reviewPacket);

  const issues = EXPECTED_ISSUE_IDS.map((issueId) =>
    buildIssueDecision({ issueId, issueMap, billIndex, topicIndex })
  );

  const statusCounts = {
    ready_for_keypoint_draft: 0,
    needs_split: 0,
    needs_topic_decision: 0,
    keep_as_issue_only: 0,
  };

  for (const issue of issues) {
    statusCounts[issue.editorial_status] += 1;
  }

  return {
    schema_version: "issue-editorial-decisions/v1",
    diet_session_slug: reviewPacket.diet_session_slug,
    source_files: {
      issue_review_packet_json: relativizeFromRoot(options.reviewPacketJson),
      issue_review_packet_md: relativizeFromRoot(options.reviewPacketMd),
      issue_graph_pilot: relativizeFromRoot(options.issueGraphPath),
      architecture: relativizeFromRoot(options.architecturePath),
    },
    summary: {
      issue_count: issues.length,
      status_counts: statusCounts,
      issue_ids: issues.map((issue) => issue.issue_id),
    },
    issues,
  };
}

function formatBillList(items) {
  if (items.length === 0) return "- なし";
  return items
    .map(
      (item) =>
        `- ${item.bill_number}: ${item.bill_name}${item.committee ? ` / ${item.committee}` : ""}`
    )
    .join("\n");
}

function formatTopicList(items) {
  if (items.length === 0) return "- なし";
  return items
    .map(
      (item) =>
        `- ${item.topic_slug ?? "(new)"}: ${item.topic_title ?? item.proposed_title}${item.note ? ` / ${item.note}` : ""}`
    )
    .join("\n");
}

function formatTextList(items) {
  if (items.length === 0) return "- なし";
  return items.map((item) => `- ${item}`).join("\n");
}

function buildMarkdown(decisions) {
  const lines = [];
  lines.push("# Issue Editorial Decisions");
  lines.push("");
  lines.push(`- issue_count: ${decisions.summary.issue_count}`);
  lines.push(
    `- ready_for_keypoint_draft: ${decisions.summary.status_counts.ready_for_keypoint_draft}`
  );
  lines.push(`- needs_split: ${decisions.summary.status_counts.needs_split}`);
  lines.push(
    `- needs_topic_decision: ${decisions.summary.status_counts.needs_topic_decision}`
  );
  lines.push(
    `- keep_as_issue_only: ${decisions.summary.status_counts.keep_as_issue_only}`
  );
  lines.push("");

  for (const issue of decisions.issues) {
    lines.push(`## ${issue.title}`);
    lines.push("");
    lines.push(`- issue_id: ${issue.issue_id}`);
    lines.push(`- editorial_status: ${issue.editorial_status}`);
    lines.push("");
    lines.push("### Confirmed Bills");
    lines.push("");
    lines.push(formatBillList(issue.confirmed_bills));
    lines.push("");
    lines.push("### Candidate Bills");
    lines.push("");
    lines.push(formatBillList(issue.candidate_bills));
    lines.push("");
    lines.push("### Confirmed Topics");
    lines.push("");
    lines.push(formatTopicList(issue.confirmed_topics));
    lines.push("");
    lines.push("### Candidate Topics");
    lines.push("");
    lines.push(formatTopicList(issue.candidate_topics));
    lines.push("");
    lines.push("### New Topic Candidates");
    lines.push("");
    lines.push(formatTopicList(issue.new_topic_candidates));
    lines.push("");
    lines.push("### Split Notes");
    lines.push("");
    lines.push(formatTextList(issue.split_notes));
    lines.push("");
    lines.push("### Editor Notes");
    lines.push("");
    lines.push(formatTextList(issue.editor_notes));
    lines.push("");
    lines.push("### Next Action");
    lines.push("");
    lines.push(formatTextList(issue.next_action));
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const options = parseArgs(process.argv);
  const reviewPacket = readJson(options.reviewPacketJson);
  const decisions = buildDecisions(reviewPacket, options);

  mkdirSync(dirname(options.outputJson), { recursive: true });
  mkdirSync(dirname(options.outputMarkdown), { recursive: true });
  writeFileSync(options.outputJson, `${JSON.stringify(decisions, null, 2)}\n`);
  writeFileSync(options.outputMarkdown, buildMarkdown(decisions));

  console.log("=".repeat(60));
  console.log("Issue editorial decisions generated");
  console.log("=".repeat(60));
  console.log(`Review packet : ${options.reviewPacketJson}`);
  console.log(`Output JSON   : ${options.outputJson}`);
  console.log(`Output MD     : ${options.outputMarkdown}`);
  console.log(`Issues        : ${decisions.summary.issue_count}`);
  for (const [status, count] of Object.entries(decisions.summary.status_counts)) {
    console.log(`${status.padEnd(23)} ${count}`);
  }
}

main();
