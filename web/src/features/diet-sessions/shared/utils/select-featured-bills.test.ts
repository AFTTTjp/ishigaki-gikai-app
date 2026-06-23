import { describe, expect, it } from "vitest";
import { selectFeaturedBills } from "./select-featured-bills";

type Bill = { id: string; name: string };

const bills: Bill[] = [
  { id: "b36", name: "議案第36号 石垣市宿泊税基金条例" },
  {
    id: "b45",
    name: "議案第45号 中華民国基隆市との国際友好都市提携について",
  },
  { id: "b42", name: "議案第42号 令和8年度石垣市一般会計補正予算（第1号）" },
];

describe("selectFeaturedBills", () => {
  it("議案番号に一致する bill を返す", () => {
    const result = selectFeaturedBills(["議案第45号"], bills);
    expect(result.map((b) => b.id)).toEqual(["b45"]);
  });

  it("billNumbers の記述順を維持する", () => {
    const result = selectFeaturedBills(["議案第45号", "議案第36号"], bills);
    expect(result.map((b) => b.id)).toEqual(["b45", "b36"]);
  });

  it("存在しない番号は無視する", () => {
    const result = selectFeaturedBills(["議案第99号", "議案第45号"], bills);
    expect(result.map((b) => b.id)).toEqual(["b45"]);
  });

  it("billNumbers が undefined / 空なら空配列", () => {
    expect(selectFeaturedBills(undefined, bills)).toEqual([]);
    expect(selectFeaturedBills([], bills)).toEqual([]);
  });

  it("bills が空でも安全に空配列", () => {
    expect(selectFeaturedBills(["議案第45号"], [])).toEqual([]);
  });

  it("同一番号が複数 bill にあっても最初の1件のみ", () => {
    const dup: Bill[] = [
      {
        id: "first",
        name: "議案第45号 中華民国基隆市との国際友好都市提携について",
      },
      { id: "second", name: "議案第45号 別表記の重複" },
    ];
    const result = selectFeaturedBills(["議案第45号"], dup);
    expect(result.map((b) => b.id)).toEqual(["first"]);
  });
});
