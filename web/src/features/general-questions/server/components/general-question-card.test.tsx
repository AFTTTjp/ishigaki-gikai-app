// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GeneralQuestion } from "../../shared/types";
import { GeneralQuestionCard } from "./general-question-card";

function makeQuestion(confirmedFacts: string[]): GeneralQuestion {
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
        confirmed_facts: confirmedFacts,
      },
    ],
  };
}

describe("GeneralQuestionCard", () => {
  it("confirmed_facts が空ならセクションを表示しない", () => {
    render(<GeneralQuestionCard question={makeQuestion([])} />);

    expect(screen.queryByText("市の答弁で確認できたこと")).toBeNull();
    expect(screen.getByText("現状について")).toBeTruthy();
    expect(screen.getByText("支援策について")).toBeTruthy();
  });

  it("confirmed_facts があるときだけセクションと箇条書きを表示する", () => {
    render(
      <GeneralQuestionCard
        question={makeQuestion([
          "点数評価方式案を本議会に上程している。",
          "居住支援協議会の設立に向けた取組を進めている。",
        ])}
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
});
