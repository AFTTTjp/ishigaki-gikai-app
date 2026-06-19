import { describe, expect, it } from "vitest";
import {
  type KeyPointQuestionSource,
  selectRelatedGeneralQuestionItems,
} from "./select-related-general-questions";

const questions: KeyPointQuestionSource[] = [
  {
    slug: "gq-shiuezato",
    memberName: "後上里厚司",
    questionDate: "2026-06-15",
    items: [
      { itemNumber: 4, title: "石垣・台湾定期航路", subItems: ["航行費用"] },
      { itemNumber: 7, title: "離島甲子園について", subItems: [] },
    ],
  },
  {
    slug: "gq-miyara",
    memberName: "宮良操",
    questionDate: "2026-06-17",
    items: [
      { itemNumber: 1, title: "定期航路事業について", subItems: ["情報開示"] },
      {
        itemNumber: 4,
        title: "スポーツ行政について",
        subItems: ["離島甲子園大会派遣について"],
      },
    ],
  },
];

describe("selectRelatedGeneralQuestionItems", () => {
  it("itemNumber の item title を表示する", () => {
    const result = selectRelatedGeneralQuestionItems(
      [{ questionSlug: "gq-shiuezato", itemNumber: 7 }],
      questions
    );
    expect(result).toEqual([
      {
        key: "gq-shiuezato-7-title",
        memberName: "後上里厚司",
        displayTitle: "離島甲子園について",
        questionDate: "2026-06-15",
      },
    ]);
  });

  it("subItemIndex が有効なら sub_item を表示する", () => {
    const result = selectRelatedGeneralQuestionItems(
      [{ questionSlug: "gq-miyara", itemNumber: 4, subItemIndex: 0 }],
      questions
    );
    expect(result.map((r) => r.displayTitle)).toEqual([
      "離島甲子園大会派遣について",
    ]);
  });

  it("subItemIndex が範囲外なら item title にフォールバックする", () => {
    const result = selectRelatedGeneralQuestionItems(
      [{ questionSlug: "gq-miyara", itemNumber: 4, subItemIndex: 5 }],
      questions
    );
    expect(result.map((r) => r.displayTitle)).toEqual(["スポーツ行政について"]);
  });

  it("存在しない slug は無視する", () => {
    const result = selectRelatedGeneralQuestionItems(
      [
        { questionSlug: "gq-unknown", itemNumber: 1 },
        { questionSlug: "gq-shiuezato", itemNumber: 7 },
      ],
      questions
    );
    expect(result.map((r) => r.displayTitle)).toEqual(["離島甲子園について"]);
  });

  it("存在しない itemNumber は無視する", () => {
    const result = selectRelatedGeneralQuestionItems(
      [{ questionSlug: "gq-shiuezato", itemNumber: 99 }],
      questions
    );
    expect(result).toEqual([]);
  });

  it("refs の記述順を保つ", () => {
    const result = selectRelatedGeneralQuestionItems(
      [
        { questionSlug: "gq-miyara", itemNumber: 1 },
        { questionSlug: "gq-shiuezato", itemNumber: 4 },
      ],
      questions
    );
    expect(result.map((r) => r.memberName)).toEqual(["宮良操", "後上里厚司"]);
  });

  it("refs が undefined / 空なら空配列", () => {
    expect(selectRelatedGeneralQuestionItems(undefined, questions)).toEqual([]);
    expect(selectRelatedGeneralQuestionItems([], questions)).toEqual([]);
  });
});
