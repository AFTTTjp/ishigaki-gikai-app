import { describe, expect, it } from "vitest";
import {
  collectBillsCoverageFromRows,
  collectGeneralQuestionsCoverage,
  collectTopicsCoverage,
} from "./validate-difficulty-coverage.mjs";

function makeGeneralQuestionsDocument(items) {
  return {
    diet_session_slug: "session",
    questions: [
      {
        slug: "question-1",
        topic_slugs: [],
        items: items.map((item, index) => ({
          item_number: index + 1,
          title: `item ${index + 1}`,
          sub_items: [],
          confirmed_facts: [],
          city_answer_summaries: [],
          ...item,
        })),
      },
    ],
  };
}

describe("collectGeneralQuestionsCoverage", () => {
  it("counts current description states and separates warnings from blockers", () => {
    const report = collectGeneralQuestionsCoverage(
      makeGeneralQuestionsDocument([
        {
          normal_description: "短い説明です。",
          detailed_description: "詳しい説明です。",
        },
        {
          normal_description: "短い説明だけです。",
        },
        {},
      ])
    );

    expect(report.stats).toMatchObject({
      questions_total: 1,
      items_total: 3,
      normal_description: 2,
      detailed_description: 1,
      both: 1,
      normal_only: 1,
      detailed_only: 0,
      neither: 1,
      hard_fallback: 1,
    });
    expect(report.findings.filter((f) => f.kind === "blocking")).toHaveLength(0);
    expect(report.findings.filter((f) => f.kind === "warning")).toHaveLength(2);
  });

  it("blocks detailed-only descriptions", () => {
    const report = collectGeneralQuestionsCoverage(
      makeGeneralQuestionsDocument([
        {
          detailed_description: "詳しい説明だけです。",
        },
      ])
    );

    expect(report.stats.detailed_only).toBe(1);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        kind: "blocking",
        message: "detailed_description must not exist without normal_description",
      })
    );
  });

  it("blocks duplicate item keys", () => {
    const document = makeGeneralQuestionsDocument([{}, {}]);
    document.questions[0].items[1].item_number = 1;

    const report = collectGeneralQuestionsCoverage(document);

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        kind: "blocking",
        message: "duplicate general question item key",
      })
    );
  });

  it("blocks reviewer-only fields in public JSON", () => {
    const report = collectGeneralQuestionsCoverage(
      makeGeneralQuestionsDocument([
        {
          normal_description: "短い説明です。",
          review_notes: "公開JSONへ入れてはいけないメモ",
        },
      ])
    );

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        kind: "blocking",
        message: "reviewer-only field must not appear in public JSON",
      })
    );
  });
});

describe("collectTopicsCoverage", () => {
  it("counts topic hard fallback as a warning", () => {
    const report = collectTopicsCoverage([
      { topic_slug: "both", content: "normal", content_hard: "hard" },
      { topic_slug: "normal-only", content: "normal" },
    ]);

    expect(report.stats).toMatchObject({
      total: 2,
      normal_content: 2,
      hard_content: 1,
      both: 1,
      normal_only: 1,
      hard_fallback: 1,
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        kind: "warning",
        scope: "normal-only",
      })
    );
  });

  it("blocks hard-only topics", () => {
    const report = collectTopicsCoverage([
      { topic_slug: "hard-only", content_hard: "hard" },
    ]);

    expect(report.stats.hard_only).toBe(1);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        kind: "blocking",
        message: "content_hard must not exist without content",
      })
    );
  });
});

describe("collectBillsCoverageFromRows", () => {
  it("counts published bill coverage and identical fields", () => {
    const report = collectBillsCoverageFromRows([
      {
        id: "bill-1",
        bill_contents: [
          {
            difficulty_level: "normal",
            title: "同じタイトル",
            summary: "normal summary",
            content: "same content",
          },
          {
            difficulty_level: "hard",
            title: "同じタイトル",
            summary: "hard summary",
            content: "same content",
          },
        ],
      },
      {
        id: "bill-2",
        bill_contents: [
          {
            difficulty_level: "normal",
            title: "normal",
            summary: "normal",
            content: "normal",
          },
        ],
      },
    ]);

    expect(report.stats).toMatchObject({
      published_total: 2,
      normal: 2,
      hard: 1,
      both: 1,
      normal_only: 1,
      hard_fallback: 1,
      identical_title: 1,
      identical_summary: 0,
      identical_content: 1,
    });
    expect(report.findings.filter((f) => f.kind === "blocking")).toHaveLength(0);
    expect(report.findings.filter((f) => f.kind === "warning").length).toBe(3);
  });

  it("blocks unknown difficulty and duplicate records", () => {
    const report = collectBillsCoverageFromRows([
      {
        id: "bill-1",
        bill_contents: [
          { difficulty_level: "normal", title: "a", summary: "a", content: "a" },
          { difficulty_level: "normal", title: "b", summary: "b", content: "b" },
          { difficulty_level: "easy", title: "c", summary: "c", content: "c" },
        ],
      },
    ]);

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "blocking",
          message: "duplicate normal bill_content record",
        }),
        expect.objectContaining({
          kind: "blocking",
          message: "unknown difficulty value: easy",
        }),
      ])
    );
  });
});
