import { describe, expect, it } from "vitest";
import { sortBillsByNumber } from "./sort-bills-by-number";

describe("sortBillsByNumber", () => {
  it("第N号を昇順に並べ、元の配列は変更しない", () => {
    const bills = [
      { id: "bill-45", name: "議案第45号 国際友好都市提携" },
      { id: "bill-36", name: "議案第36号 宿泊税条例" },
      { id: "bill-42", name: "議案第42号 財産の取得" },
    ];

    expect(sortBillsByNumber(bills).map((bill) => bill.id)).toEqual([
      "bill-36",
      "bill-42",
      "bill-45",
    ]);
    expect(bills.map((bill) => bill.id)).toEqual([
      "bill-45",
      "bill-36",
      "bill-42",
    ]);
  });

  it("番号のない資料は番号付き議案の後ろへ並べる", () => {
    const bills = [
      { id: "report", name: "市政報告" },
      { id: "bill-2", name: "請願第2号 継続審査" },
      { id: "bill-10", name: "議案第10号 条例改正" },
    ];

    expect(sortBillsByNumber(bills).map((bill) => bill.id)).toEqual([
      "bill-2",
      "bill-10",
      "report",
    ]);
  });
});
