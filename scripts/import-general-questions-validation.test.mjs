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
  ).questions[0].items[0].city_answer_summaries;
}

describe("validateAndNormalizeGeneralQuestionsDocument city_answer_summaries", () => {
  it("omitted city_answer_summaries is normalized to an empty array", () => {
    expect(normalize({})).toEqual([]);
  });

  it("empty city_answer_summaries is accepted", () => {
    expect(normalize({ city_answer_summaries: [] })).toEqual([]);
  });

  it("a valid single summary is accepted", () => {
    expect(
      normalize({
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
      normalize({
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
      normalize({ city_answer_summaries: cityAnswerSummaries })
    ).toThrow(expectedMessage);
  });
});
