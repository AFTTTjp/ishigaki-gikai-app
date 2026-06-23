import { describe, expect, it } from "vitest";
import {
  type FeaturedBillGroupInput,
  selectFeaturedBillGroups,
} from "./select-featured-bills";

type Bill = { id: string; name: string };

const bills: Bill[] = [
  { id: "b36", name: "議案第36号 石垣市宿泊税基金条例" },
  {
    id: "b45",
    name: "議案第45号 中華民国基隆市との国際友好都市提携について",
  },
  { id: "b40", name: "議案第40号 石垣市営住宅条例の一部を改正する条例" },
  { id: "b49", name: "議案第49号 救助工作車の取得について" },
  { id: "b50", name: "議案第50号 高規格救急自動車の取得について" },
];

const groups: FeaturedBillGroupInput[] = [
  {
    category: "国際交流・交通",
    description: "台湾・基隆市との交流に関わる議案です。",
    billNumbers: ["議案第45号"],
  },
  {
    category: "観光・税",
    description: "宿泊税に関わる議案です。",
    billNumbers: ["議案第36号"],
  },
  {
    category: "防災・安全",
    description: "消防・救急に関わる議案です。",
    billNumbers: ["議案第49号", "議案第50号", "議案第51号"],
  },
];

describe("selectFeaturedBillGroups", () => {
  it("各グループの議案番号を bill に解決する", () => {
    const result = selectFeaturedBillGroups(groups, bills);
    expect(
      result.map((g) => ({
        category: g.category,
        ids: g.bills.map((b) => b.id),
      }))
    ).toEqual([
      { category: "国際交流・交通", ids: ["b45"] },
      { category: "観光・税", ids: ["b36"] },
      // 議案第51号 は bills に無いので除外され、49・50 のみ
      { category: "防災・安全", ids: ["b49", "b50"] },
    ]);
  });

  it("グループ順・グループ内の議案番号順を維持する", () => {
    const result = selectFeaturedBillGroups(
      [
        { category: "A", billNumbers: ["議案第40号", "議案第36号"] },
        { category: "B", billNumbers: ["議案第45号"] },
      ],
      bills
    );
    expect(result.map((g) => g.category)).toEqual(["A", "B"]);
    expect(result[0]?.bills.map((b) => b.id)).toEqual(["b40", "b36"]);
  });

  it("description はそのまま引き継ぎ、未指定なら undefined", () => {
    const result = selectFeaturedBillGroups(
      [{ category: "防災", billNumbers: ["議案第49号"] }],
      bills
    );
    expect(result[0]?.description).toBeUndefined();
  });

  it("解決できる議案が0件のグループは除外する", () => {
    const result = selectFeaturedBillGroups(
      [
        { category: "存在しない", billNumbers: ["議案第99号"] },
        { category: "観光・税", billNumbers: ["議案第36号"] },
      ],
      bills
    );
    expect(result.map((g) => g.category)).toEqual(["観光・税"]);
  });

  it("groups が undefined / 空なら空配列", () => {
    expect(selectFeaturedBillGroups(undefined, bills)).toEqual([]);
    expect(selectFeaturedBillGroups([], bills)).toEqual([]);
  });

  it("bills が空でも安全に空配列", () => {
    expect(selectFeaturedBillGroups(groups, [])).toEqual([]);
  });

  it("同一番号が複数 bill にあっても最初の1件のみ採用する", () => {
    const dup: Bill[] = [
      {
        id: "first",
        name: "議案第45号 中華民国基隆市との国際友好都市提携について",
      },
      { id: "second", name: "議案第45号 別表記の重複" },
    ];
    const result = selectFeaturedBillGroups(
      [{ category: "国際交流", billNumbers: ["議案第45号"] }],
      dup
    );
    expect(result[0]?.bills.map((b) => b.id)).toEqual(["first"]);
  });
});
