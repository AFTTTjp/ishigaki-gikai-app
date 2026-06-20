import { describe, expect, it } from "vitest";
import {
  extractBillTitlePrefix,
  getBillDisplayTitle,
  stripBillTitlePrefix,
} from "./bill-title";

describe("extractBillTitlePrefix", () => {
  it("議案第N号 を抽出できる", () => {
    expect(
      extractBillTitlePrefix(
        "議案第42号 令和8年度石垣市一般会計補正予算（第1号）"
      )
    ).toBe("議案第42号");
  });

  it("議員提出議案第N号 を抽出できる", () => {
    expect(extractBillTitlePrefix("議員提出議案第1号 〇〇に関する意見書")).toBe(
      "議員提出議案第1号"
    );
  });

  it("接頭辞が無ければ null", () => {
    expect(extractBillTitlePrefix("令和8年度一般会計補正予算")).toBeNull();
  });

  it("請願・承認・報告は議案番号接頭辞ではないので null", () => {
    expect(extractBillTitlePrefix("請願第2号 サンゴ保全")).toBeNull();
    expect(extractBillTitlePrefix("承認第2号 専決処分")).toBeNull();
  });

  it("先頭以外に番号があってもマッチしない（先頭厳密）", () => {
    expect(extractBillTitlePrefix("補正予算 議案第42号")).toBeNull();
  });

  it("null / undefined / 空文字は null", () => {
    expect(extractBillTitlePrefix(null)).toBeNull();
    expect(extractBillTitlePrefix(undefined)).toBeNull();
    expect(extractBillTitlePrefix("")).toBeNull();
  });
});

// 既存ユーティリティの挙動が壊れていないことの回帰テスト
describe("stripBillTitlePrefix (regression)", () => {
  it("議案番号接頭辞を除去する", () => {
    expect(
      stripBillTitlePrefix(
        "議案第42号 令和8年度石垣市一般会計補正予算（第1号）"
      )
    ).toBe("令和8年度石垣市一般会計補正予算");
  });

  it("接頭辞が無ければそのまま返す", () => {
    expect(stripBillTitlePrefix("一般会計補正予算")).toBe("一般会計補正予算");
  });

  it("null は null", () => {
    expect(stripBillTitlePrefix(null)).toBeNull();
  });
});

describe("getBillDisplayTitle (regression)", () => {
  it("bill_content.title を優先し接頭辞を除去する", () => {
    expect(
      getBillDisplayTitle({
        name: "議案第42号 令和8年度石垣市一般会計補正予算（第1号）",
        bill_content: { title: "議案第42号 補正予算の本文タイトル" },
      })
    ).toBe("補正予算の本文タイトル");
  });

  it("bill_content が無ければ name から接頭辞を除去する", () => {
    expect(
      getBillDisplayTitle({
        name: "議案第42号 令和8年度石垣市一般会計補正予算（第1号）",
      })
    ).toBe("令和8年度石垣市一般会計補正予算");
  });
});
