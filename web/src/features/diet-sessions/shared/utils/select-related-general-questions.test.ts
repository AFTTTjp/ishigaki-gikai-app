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
      {
        itemNumber: 4,
        title: "石垣・台湾定期航路",
        subItems: ["航行費用について", "採算性について", "物流量について"],
      },
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
        subItems: ["離島甲子園大会派遣について", "引率体制について"],
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

  it("subItemsPreview は最大2件まで（item title 表示時）", () => {
    const result = selectRelatedGeneralQuestionItems(
      [{ questionSlug: "gq-shiuezato", itemNumber: 4 }],
      questions
    );
    expect(result[0]?.displayTitle).toBe("石垣・台湾定期航路");
    expect(result[0]?.subItemsPreview).toEqual([
      "航行費用について",
      "採算性について",
    ]);
  });

  it("sub_item 表示時は、表示中の sub_item を補足から除外する", () => {
    const result = selectRelatedGeneralQuestionItems(
      [{ questionSlug: "gq-miyara", itemNumber: 4, subItemIndex: 0 }],
      questions
    );
    expect(result[0]?.displayTitle).toBe("離島甲子園大会派遣について");
    // 表示中の sub_item は重複除外され、残りだけが補足に出る
    expect(result[0]?.subItemsPreview).toEqual(["引率体制について"]);
  });

  it("sub_items が空なら subItemsPreview は付かない", () => {
    const result = selectRelatedGeneralQuestionItems(
      [{ questionSlug: "gq-shiuezato", itemNumber: 7 }],
      questions
    );
    expect(result[0]?.subItemsPreview).toBeUndefined();
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
