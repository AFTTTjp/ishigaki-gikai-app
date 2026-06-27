#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path, { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ISSUE_GRAPH_V2_PATH = resolve(
  ROOT,
  "docs/general_questions_minutes/r8-dai4-teireikai.issue-graph-v2-rito-koshien.review.json"
);
const SPEECH_CANONICAL_PATHS = [
  resolve(
    ROOT,
    "docs/general_questions_minutes/speech-canonical/r8-dai4/ishigaki-r8-dai4-ippan-shiuezato-atsushi.speech-canonical.json"
  ),
  resolve(
    ROOT,
    "docs/general_questions_minutes/speech-canonical/r8-dai4/ishigaki-r8-dai4-ippan-nagahama-nobuo.speech-canonical.json"
  ),
];
const TOPIC_PATH = resolve(
  ROOT,
  "docs/ishigaki_gikai_topics_dev_set/rito-koshien-r8-dai4.topic.json"
);
const GENERAL_QUESTIONS_PATH = resolve(
  ROOT,
  "docs/general_questions/r8-dai4-teireikai.general-questions.json"
);
const SESSION_OVERVIEWS_PATH = resolve(
  ROOT,
  "web/src/features/diet-sessions/shared/data/session-overviews.ts"
);
const TARGETS = [
  {
    key: "rito-koshien",
    issueId: "issue-r8d4-rito-koshien",
    sessionSlug: "ishigaki-r8-dai4-teireikai",
    topicSlug: "rito-koshien-r8-dai4",
    billNumber: "議案第42号",
    committeeName: "総務財政委員会",
    outputPath: resolve(
      ROOT,
      "docs/general_questions_minutes/r8-dai4-teireikai.event-graph-v1-rito-koshien.review.json"
    ),
    questionRefs: [
      {
        questionSlug: "ishigaki-r8-dai4-ippan-shiuezato-atsushi",
        itemNumber: 7,
        memberLabel: "後上里厚司議員",
        eventDate: "2026-06-15",
        title: "後上里厚司議員が離島甲子園について一般質問する",
      },
      {
        questionSlug: "ishigaki-r8-dai4-ippan-nagahama-nobuo",
        itemNumber: 3,
        memberLabel: "長浜信夫議員",
        eventDate: "2026-06-22",
        title: "長浜信夫議員が離島甲子園大会出場について一般質問する",
      },
    ],
    aliases: [
      "rito-koshien",
      "issue-r8d4-rito-koshien",
      "rito-koshien-r8-dai4",
    ],
  },
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function readText(filePath) {
  return readFileSync(filePath, "utf-8");
}

function relativePath(filePath) {
  return relative(ROOT, filePath);
}

function validateContains(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected ${label} to contain "${needle}"`);
  }
}

function unique(values) {
  return [...new Set(values)];
}

function parseArgs(argv) {
  const rawTarget = argv[2] ?? TARGETS[0].key;
  const target = TARGETS.find((entry) => entry.aliases.includes(rawTarget));
  if (!target) {
    const supported = TARGETS.map((entry) => entry.aliases.join(" / ")).join(", ");
    throw new Error(`Unsupported issue target: ${rawTarget}. Supported: ${supported}`);
  }
  return { target };
}

function buildSpeechIndex() {
  const byQuestionSlug = new Map();
  const evidenceIds = new Set();

  for (const filePath of SPEECH_CANONICAL_PATHS) {
    const document = readJson(filePath);
    byQuestionSlug.set(document.question_slug, document);
    for (const block of document.speech_blocks ?? []) {
      evidenceIds.add(block.evidence_id);
    }
  }

  return { byQuestionSlug, evidenceIds };
}

function findQuestion(questionData, slug) {
  const question = questionData.questions.find((entry) => entry.slug === slug);
  if (!question) {
    throw new Error(`Question not found: ${slug}`);
  }
  return question;
}

function findRelatedItem(issue, slug, itemNumber) {
  const ref = (issue.related_general_question_items ?? []).find(
    (entry) => entry.questionSlug === slug && entry.itemNumber === itemNumber
  );
  if (!ref) {
    throw new Error(`Issue ref not found: ${slug} / item ${itemNumber}`);
  }
  return ref;
}

function collectQuestionEvidenceIds(ref) {
  return unique([
    ...(ref.speech_evidence?.question_primary_evidence_ids ?? []),
    ...(ref.speech_evidence?.answer_primary_evidence_ids ?? []),
    ...(ref.speech_evidence?.secondary_evidence_ids ?? []),
  ]);
}

function validateSourceArtifacts(
  target,
  issue,
  topic,
  generalQuestionsSource,
  sessionOverviewSource
) {
  validateContains(topic.topic_slug, target.topicSlug, "topic slug");
  validateContains(topic.description, target.billNumber, "topic description");

  for (const questionRef of target.questionRefs) {
    const question = findQuestion(generalQuestionsSource, questionRef.questionSlug);
    const item = question.items.find(
      (entry) => entry.item_number === questionRef.itemNumber
    );
    if (!item) {
      throw new Error(
        `Required general question item was not found: ${questionRef.questionSlug} / item ${questionRef.itemNumber}`
      );
    }
  }

  validateContains(
    sessionOverviewSource,
    `"${target.sessionSlug}": {`,
    "session overview"
  );
  validateContains(sessionOverviewSource, target.billNumber, "session overview");
  validateContains(sessionOverviewSource, target.committeeName, "session overview");
  validateContains(sessionOverviewSource, target.topicSlug, "session overview");
  validateContains(sessionOverviewSource, "離島甲子園に参加できる？", "session overview");

  if (issue.issue_id !== target.issueId) {
    throw new Error(`Unexpected issue id: ${issue.issue_id}`);
  }
}

function buildEvent(target, {
  eventId,
  eventType,
  title,
  status,
  eventDate,
  relatedBillNumbers = [],
  relatedCommittees = [],
  relatedQuestionRefs = [],
  evidenceIds = [],
  sourceRefs = [],
  notes = [],
}) {
  return {
    event_id: eventId,
    event_type: eventType,
    title,
    status,
    event_date: eventDate,
    session_slug: target.sessionSlug,
    related_issue_ids: [target.issueId],
    related_topic_slugs: [target.topicSlug],
    related_bill_numbers: relatedBillNumbers,
    related_committees: relatedCommittees,
    related_question_refs: relatedQuestionRefs,
    evidence_ids: evidenceIds,
    source_refs: sourceRefs,
    notes,
  };
}

function buildOutput(target) {
  const issueGraphV2 = readJson(ISSUE_GRAPH_V2_PATH);
  const topic = readJson(TOPIC_PATH);
  const generalQuestions = readJson(GENERAL_QUESTIONS_PATH);
  const sessionOverviewSource = readText(SESSION_OVERVIEWS_PATH);
  const speechIndex = buildSpeechIndex();
  const issue = issueGraphV2.issues?.[0];

  if (!issue) {
    throw new Error("Issue graph v2 review artifact has no issues");
  }

  validateSourceArtifacts(
    target,
    issue,
    topic,
    generalQuestions,
    sessionOverviewSource
  );

  const relatedQuestionEvents = target.questionRefs.map((questionRef) => {
    const relatedItem = findRelatedItem(
      issue,
      questionRef.questionSlug,
      questionRef.itemNumber
    );
    return {
      ...questionRef,
      evidenceIds: collectQuestionEvidenceIds(relatedItem),
    };
  });

  for (const evidenceId of relatedQuestionEvents.flatMap((row) => row.evidenceIds)) {
    if (!speechIndex.evidenceIds.has(evidenceId)) {
      throw new Error(`Unknown speech evidence id: ${evidenceId}`);
    }
  }

  const events = [
    buildEvent(target, {
      eventId: `${target.issueId}:bill-introduction:2026-06-08`,
      eventType: "bill_introduction",
      title: "議案第42号として離島甲子園参加経費を含む補正予算案が提出される",
      status: "candidate",
      eventDate: "2026-06-08",
      relatedBillNumbers: [target.billNumber],
      sourceRefs: [
        {
          source_kind: "topic_json",
          source_path: relativePath(TOPIC_PATH),
          source_locator: "topic_updates[0]",
        },
        {
          source_kind: "session_overview",
          source_path: relativePath(SESSION_OVERVIEWS_PATH),
          source_locator: `SESSION_OVERVIEWS["${target.sessionSlug}"].reportDetailed`,
        },
      ],
      notes: [
        "議案第42号の提出と離島甲子園参加経費の計上は topic source と session overview で確認できる。",
      ],
    }),
    buildEvent(target, {
      eventId: `${target.issueId}:committee-referral:2026-06-08`,
      eventType: "committee_referral",
      title: "議案第42号が総務財政委員会に付託される",
      status: "candidate",
      eventDate: "2026-06-08",
      relatedBillNumbers: [target.billNumber],
      relatedCommittees: [target.committeeName],
      sourceRefs: [
        {
          source_kind: "session_overview",
          source_path: relativePath(SESSION_OVERVIEWS_PATH),
          source_locator: `SESSION_OVERVIEWS["${target.sessionSlug}"].committees`,
        },
      ],
      notes: [
        "付託の source は session overview 由来で、council action や議事録根拠はまだ紐付けていない。",
      ],
    }),
    buildEvent(target, {
      eventId: `${target.issueId}:committee-discussion:2026-06-10`,
      eventType: "committee_discussion",
      title: "総務財政委員会で離島甲子園参加経費の経緯と宿泊条件が説明される",
      status: "candidate",
      eventDate: "2026-06-10",
      relatedBillNumbers: [target.billNumber],
      relatedCommittees: [target.committeeName],
      sourceRefs: [
        {
          source_kind: "topic_json",
          source_path: relativePath(TOPIC_PATH),
          source_locator: "topic_updates[1]",
        },
      ],
      notes: [
        "委員会 discussion は topic review artifact による保持で、speech evidence は未接続。",
      ],
    }),
    ...relatedQuestionEvents.map((questionRef) => {
      const speechSourcePath = SPEECH_CANONICAL_PATHS.find((filePath) =>
        filePath.includes(`${questionRef.questionSlug}.speech-canonical.json`)
      );
      if (!speechSourcePath) {
        throw new Error(`Speech source path not found: ${questionRef.questionSlug}`);
      }

      return buildEvent(target, {
        eventId: `${target.issueId}:general-question:${questionRef.questionSlug}:item${questionRef.itemNumber}`,
        eventType: "general_question",
        title: questionRef.title,
        status: "confirmed",
        eventDate: questionRef.eventDate,
        relatedBillNumbers: [target.billNumber],
        relatedQuestionRefs: [
          {
            question_slug: questionRef.questionSlug,
            item_number: questionRef.itemNumber,
          },
        ],
        evidenceIds: questionRef.evidenceIds,
        sourceRefs: [
          {
            source_kind: "issue_graph_v2_review",
            source_path: relativePath(ISSUE_GRAPH_V2_PATH),
            source_locator: `issues[0].related_general_question_items[questionSlug="${questionRef.questionSlug}"]`,
          },
          {
            source_kind: "speech_canonical",
            source_path: relativePath(speechSourcePath),
            source_locator: `speech_blocks[evidence_id="${questionRef.evidenceIds.join(
              '" | "'
            )}"]`,
          },
          {
            source_kind: "general_questions_json",
            source_path: relativePath(GENERAL_QUESTIONS_PATH),
            source_locator: `questions[slug="${questionRef.questionSlug}"].items[item_number=${questionRef.itemNumber}]`,
          },
        ],
        notes: [
          "question / answer primary evidence は Speech Canonical v1 pilot の stable evidence_id を使用。",
        ],
      });
    }),
  ];

  return {
    schema: "event-graph/v1-review",
    diet_session_slug: target.sessionSlug,
    issue_id: target.issueId,
    based_on: {
      issue_graph_v2_review: relativePath(ISSUE_GRAPH_V2_PATH),
      speech_canonical_sources: SPEECH_CANONICAL_PATHS.map(relativePath).sort((a, b) =>
        a.localeCompare(b, "ja")
      ),
      topic_source: relativePath(TOPIC_PATH),
      general_questions_source: relativePath(GENERAL_QUESTIONS_PATH),
      session_overview_source: relativePath(SESSION_OVERVIEWS_PATH),
    },
    events,
    review_required: [
      "vote not included in pilot v1 because a stable per-bill source was not connected in this artifact",
      "bill_introduction / committee_referral / committee_discussion are source_ref-based candidate events without speech evidence",
      "committee discussion details remain review-first and should not be promoted without stronger council source linkage",
    ],
  };
}

function validateOutput(output) {
  if (output.schema !== "event-graph/v1-review") {
    throw new Error(`Unexpected schema: ${output.schema}`);
  }
  if (!Array.isArray(output.events) || output.events.length !== 5) {
    throw new Error(`Expected 5 events, got ${output.events?.length ?? 0}`);
  }

  const generalQuestionEvents = output.events.filter(
    (event) => event.event_type === "general_question"
  );
  const candidateEvents = output.events.filter((event) => event.status === "candidate");
  const confirmedEvents = output.events.filter((event) => event.status === "confirmed");

  if (generalQuestionEvents.length !== 2) {
    throw new Error(`Expected 2 general_question events, got ${generalQuestionEvents.length}`);
  }
  if (candidateEvents.length !== 3) {
    throw new Error(`Expected 3 candidate events, got ${candidateEvents.length}`);
  }
  if (confirmedEvents.length !== 2) {
    throw new Error(`Expected 2 confirmed events, got ${confirmedEvents.length}`);
  }
}

function main() {
  const { target } = parseArgs(process.argv);
  const output = buildOutput(target);
  validateOutput(output);
  mkdirSync(path.dirname(target.outputPath), { recursive: true });
  writeFileSync(target.outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8");
  console.log(
    `[event-graph-v1-review] wrote ${relative(ROOT, target.outputPath)} (${output.events.length} events)`
  );
}

main();
