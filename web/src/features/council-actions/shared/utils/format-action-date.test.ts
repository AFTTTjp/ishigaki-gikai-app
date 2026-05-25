import { describe, expect, it } from "vitest";
import { formatActionDate } from "./format-action-date";

describe("formatActionDate", () => {
  it("YYYY-MM-DD 形式の日付を日本語形式に変換する", () => {
    const result = formatActionDate("2026-03-15");
    expect(result).toContain("2026年");
    expect(result).toContain("月");
    expect(result).toContain("日");
  });

  it("1月・1日など0埋めなしで返す", () => {
    const result = formatActionDate("2026-01-05");
    expect(result).toMatch(/^2026年\d{1,2}月\d{1,2}日$/);
  });

  it("無効な日付文字列はそのまま返す", () => {
    expect(formatActionDate("invalid-date")).toBe("invalid-date");
  });

  it("空文字はそのまま返す", () => {
    expect(formatActionDate("")).toBe("");
  });
});
