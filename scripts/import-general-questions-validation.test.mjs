import { describe, expect, it } from "vitest";
import { validateAndNormalizeGeneralQuestionsDocument } from "./import-general-questions-validation.mjs";

function makeDocument(itemOverrides = {}) {
  return {
    diet_session_slug: "ishigaki-r8-dai4-teireikai",
    questions: [
      {
        slug: "question-1",
        topic_slugs: [],
        items: [
          {
            item_number: 1,
            title: "テスト項目",
            sub_items: [],
            confirmed_facts: [],
            ...itemOverrides,
          },
        ],
      },
    ],
  };
}

function normalize(itemOverrides) {
  return validateAndNormalizeGeneralQuestionsDocument(
    makeDocument(itemOverrides),
    "fixture.json"
  ).questions[0].items[0];
}

function normalizeCityAnswerSummaries(itemOverrides) {
  return normalize(itemOverrides).city_answer_summaries;
}

describe("validateAndNormalizeGeneralQuestionsDocument city_answer_summaries", () => {
  it("omitted city_answer_summaries is normalized to an empty array", () => {
    expect(normalizeCityAnswerSummaries({})).toEqual([]);
  });

  it("empty city_answer_summaries is accepted", () => {
    expect(normalizeCityAnswerSummaries({ city_answer_summaries: [] })).toEqual(
      []
    );
  });

  it("a valid single summary is accepted", () => {
    expect(
      normalizeCityAnswerSummaries({
        city_answer_summaries: [
          {
            summary: "市は制度の利用状況を説明した。",
            source_utterance_id: "utterance-1",
          },
        ],
      })
    ).toEqual([
      {
        summary: "市は制度の利用状況を説明した。",
        source_utterance_id: "utterance-1",
      },
    ]);
  });

  it("valid multiple summaries preserve order", () => {
    expect(
      normalizeCityAnswerSummaries({
        city_answer_summaries: [
          {
            summary: "第一の要旨。",
            source_utterance_id: "utterance-1",
          },
          {
            summary: "第二の要旨。",
            source_utterance_id: "utterance-2",
          },
        ],
      })
    ).toEqual([
      {
        summary: "第一の要旨。",
        source_utterance_id: "utterance-1",
      },
      {
        summary: "第二の要旨。",
        source_utterance_id: "utterance-2",
      },
    ]);
  });

  it.each([
    ["null", null, "must be an array"],
    ["non-array", "summary", "must be an array"],
    ["string element", ["summary"], "must be an object"],
    [
      "missing summary",
      [{ source_utterance_id: "utterance-1" }],
      "summary must be a non-empty string",
    ],
    [
      "empty summary",
      [{ summary: "   ", source_utterance_id: "utterance-1" }],
      "summary must be a non-empty string",
    ],
    [
      "missing source",
      [{ summary: "要旨。" }],
      "source_utterance_id must be a non-empty string",
    ],
    [
      "empty source",
      [{ summary: "要旨。", source_utterance_id: " " }],
      "source_utterance_id must be a non-empty string",
    ],
    [
      "unknown property",
      [{ summary: "要旨。", source_utterance_id: "utterance-1", speaker: "市長" }],
      "has unknown properties: speaker",
    ],
    [
      "duplicate source",
      [
        { summary: "第一の要旨。", source_utterance_id: "utterance-1" },
        { summary: "第二の要旨。", source_utterance_id: "utterance-1" },
      ],
      "source_utterance_id must be unique",
    ],
    [
      "duplicate summary",
      [
        { summary: "同じ要旨。", source_utterance_id: "utterance-1" },
        { summary: "同じ要旨。", source_utterance_id: "utterance-2" },
      ],
      "summary must be unique",
    ],
  ])("rejects %s", (_label, cityAnswerSummaries, expectedMessage) => {
    expect(() =>
      normalizeCityAnswerSummaries({ city_answer_summaries: cityAnswerSummaries })
    ).toThrow(expectedMessage);
  });
});

describe("validateAndNormalizeGeneralQuestionsDocument item descriptions", () => {
  it("omitted descriptions are normalized to null", () => {
    expect(normalize({})).toMatchObject({
      normal_description: null,
      detailed_description: null,
    });
  });

  it("accepts normal_description only", () => {
    expect(
      normalize({
        normal_description: "市営住宅の入居支援について問います。",
      })
    ).toMatchObject({
      normal_description: "市営住宅の入居支援について問います。",
      detailed_description: null,
    });
  });

  it("accepts normal_description and detailed_description", () => {
    expect(
      normalize({
        normal_description: "市営住宅の入居支援について問います。",
        detailed_description:
          "住宅確保に困る世帯への支援や、市営住宅の入居枠について確認する質問です。",
      })
    ).toMatchObject({
      normal_description: "市営住宅の入居支援について問います。",
      detailed_description:
        "住宅確保に困る世帯への支援や、市営住宅の入居枠について確認する質問です。",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(
      normalize({
        normal_description: "  市営住宅の入居支援について問います。  ",
        detailed_description:
          "\n住宅確保に困る世帯への支援について確認する質問です。\t",
      })
    ).toMatchObject({
      normal_description: "市営住宅の入居支援について問います。",
      detailed_description:
        "住宅確保に困る世帯への支援について確認する質問です。",
    });
  });

  it.each([
    ["empty normal", { normal_description: "" }, "must not be empty"],
    ["whitespace normal", { normal_description: "   " }, "must not be empty"],
    ["null normal", { normal_description: null }, "must be a string"],
    ["wrong normal type", { normal_description: ["説明"] }, "must be a string"],
    ["empty detail", { detailed_description: "" }, "must not be empty"],
    [
      "whitespace detail",
      { detailed_description: "   " },
      "must not be empty",
    ],
    ["null detail", { detailed_description: null }, "must be a string"],
    ["wrong detail type", { detailed_description: 123 }, "must be a string"],
    [
      "control character",
      { normal_description: "説明\u0001です。" },
      "must not contain control characters",
    ],
    [
      "normal too long",
      { normal_description: "あ".repeat(81) },
      "must be 80 characters or fewer",
    ],
    [
      "detail too long",
      { detailed_description: "あ".repeat(401) },
      "must be 400 characters or fewer",
    ],
    [
      "identical normal and detail",
      {
        normal_description: "市営住宅の入居支援について問います。",
        detailed_description: "市営住宅の入居支援について問います。",
      },
      "must not be identical",
    ],
  ])("rejects %s", (_label, overrides, expectedMessage) => {
    expect(() => normalize(overrides)).toThrow(expectedMessage);
  });

  it("old JSON shape remains valid", () => {
    expect(() =>
      validateAndNormalizeGeneralQuestionsDocument(
        makeDocument(),
        "fixture.json"
      )
    ).not.toThrow();
  });
});
