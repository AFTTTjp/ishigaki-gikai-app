import { describe, expect, it } from "vitest";
import { formatDate } from "./format-date";

// Date("YYYY-MM-DD") interprets dates as UTC midnight, but getMonth/getDay uses local time.
// These tests use dates where the local-time day matches the intended date in JST (UTC+9).
describe("formatDate", () => {
  it("月・日・曜日を日本語形式でフォーマットする", () => {
    // 2026-06-15 は月曜日
    expect(formatDate("2026-06-15")).toBe("6月15日（月）");
  });

  it("1桁の月・日はゼロパディングしない", () => {
    // 2026-01-05 は月曜日
    expect(formatDate("2026-01-05")).toBe("1月5日（月）");
  });

  it("日曜日を正しく表示する", () => {
    // 2026-06-14 は日曜日
    expect(formatDate("2026-06-14")).toBe("6月14日（日）");
  });

  it("土曜日を正しく表示する", () => {
    // 2026-06-13 は土曜日
    expect(formatDate("2026-06-13")).toBe("6月13日（土）");
  });

  it("12月を正しく表示する", () => {
    // 2026-12-25 は金曜日
    expect(formatDate("2026-12-25")).toBe("12月25日（金）");
  });
});
