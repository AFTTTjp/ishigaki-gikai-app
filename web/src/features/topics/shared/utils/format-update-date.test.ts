import { describe, expect, it } from "vitest";
import { formatUpdateDate } from "./format-update-date";

describe("formatUpdateDate", () => {
  it("ISO日時文字列を日本語日付に変換する", () => {
    expect(formatUpdateDate("2026-04-15T00:00:00.000Z")).toBe("2026年4月15日");
  });

  it("無効な日付はそのまま返す", () => {
    expect(formatUpdateDate("invalid-date")).toBe("invalid-date");
  });

  it("空文字はそのまま返す", () => {
    expect(formatUpdateDate("not-a-date-string")).toBe("not-a-date-string");
  });

  it("JST midnight ISO offset を前日にずらさず表示する", () => {
    expect(formatUpdateDate("2026-06-15T00:00:00+09:00")).toBe("2026年6月15日");
  });

  it("UTC ISO でも JST 基準で表示する", () => {
    expect(formatUpdateDate("2026-06-14T15:00:00.000Z")).toBe("2026年6月15日");
  });
});
