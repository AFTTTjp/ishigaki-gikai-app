// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CityAnswerSummary, GeneralQuestion } from "../../shared/types";
import { GeneralQuestionCard } from "./general-question-card";

function makeQuestion({
  cityAnswerSummaries = [],
  confirmedFacts = [],
}: {
  cityAnswerSummaries?: CityAnswerSummary[];
  confirmedFacts?: string[];
} = {}): GeneralQuestion {
  return {
    id: "question-1",
    slug: "question-1",
    diet_session_id: "session-1",
    member_id: "member-1",
    question_number: 1,
    question_date: "2026-06-15",
    seat_type: "floor",
    source_kind: "official",
    member_name_raw: "テスト議員",
    status: "published",
    items: [
      {
        id: "item-1",
        general_question_id: "question-1",
        item_number: 1,
        title: "市営住宅について",
        sub_items: ["現状について", "支援策について"],
        city_answer_summaries: cityAnswerSummaries,
        confirmed_facts: confirmedFacts,
      },
    ],
  };
}

describe("GeneralQuestionCard", () => {
  it("confirmed_facts が空ならセクションを表示しない", () => {
    render(<GeneralQuestionCard question={makeQuestion()} />);

    expect(screen.queryByText("市の答弁で確認できたこと")).toBeNull();
    expect(screen.getByText("現状について")).toBeTruthy();
    expect(screen.getByText("支援策について")).toBeTruthy();
  });

  it("confirmed_facts があるときだけセクションと箇条書きを表示する", () => {
    render(
      <GeneralQuestionCard
        question={makeQuestion({
          confirmedFacts: [
            "点数評価方式案を本議会に上程している。",
            "居住支援協議会の設立に向けた取組を進めている。",
          ],
        })}
      />
    );

    expect(screen.getByText("市の答弁で確認できたこと")).toBeTruthy();
    expect(
      screen.getByText("点数評価方式案を本議会に上程している。")
    ).toBeTruthy();
    expect(
      screen.getByText("居住支援協議会の設立に向けた取組を進めている。")
    ).toBeTruthy();
    expect(screen.getByText("現状について")).toBeTruthy();
    expect(screen.getByText("支援策について")).toBeTruthy();
  });

  it("city_answer_summaries が空なら答弁要旨セクションを表示しない", () => {
    render(<GeneralQuestionCard question={makeQuestion()} />);

    expect(screen.queryByText("市の答弁要旨")).toBeNull();
    expect(screen.queryByText("議会での市側答弁を要約しています。")).toBeNull();
  });

  it("city_answer_summaries があるときだけ見出し、補足、要旨を表示する", () => {
    render(
      <GeneralQuestionCard
        question={makeQuestion({
          cityAnswerSummaries: [
            {
              summary: "市は制度の利用状況を説明した。",
              source_utterance_id: "utterance-1",
            },
          ],
        })}
      />
    );

    expect(screen.getByText("市の答弁要旨")).toBeTruthy();
    expect(screen.getByText("議会での市側答弁を要約しています。")).toBeTruthy();
    expect(screen.getByText("市は制度の利用状況を説明した。")).toBeTruthy();
    expect(screen.queryByText("utterance-1")).toBeNull();
  });

  it("city_answer_summaries が複数あるとき順序どおり表示する", () => {
    render(
      <GeneralQuestionCard
        question={makeQuestion({
          cityAnswerSummaries: [
            {
              summary: "第一の答弁要旨。",
              source_utterance_id: "utterance-1",
            },
            {
              summary: "第二の答弁要旨。",
              source_utterance_id: "utterance-2",
            },
          ],
        })}
      />
    );

    const summaries = screen.getAllByText(/第[一二]の答弁要旨。/);
    expect(summaries.map((element) => element.textContent)).toEqual([
      "第一の答弁要旨。",
      "第二の答弁要旨。",
    ]);
  });

  it("city_answer_summaries と confirmed_facts を同時に表示する", () => {
    render(
      <GeneralQuestionCard
        question={makeQuestion({
          cityAnswerSummaries: [
            {
              summary: "市は今後の対応方針を説明した。",
              source_utterance_id: "utterance-1",
            },
          ],
          confirmedFacts: ["点数評価方式案を本議会に上程している。"],
        })}
      />
    );

    expect(screen.getByText("市の答弁要旨")).toBeTruthy();
    expect(screen.getByText("市は今後の対応方針を説明した。")).toBeTruthy();
    expect(screen.getByText("市の答弁で確認できたこと")).toBeTruthy();
    expect(
      screen.getByText("点数評価方式案を本議会に上程している。")
    ).toBeTruthy();
  });
});
