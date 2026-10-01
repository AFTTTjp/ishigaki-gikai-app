import { describe, expect, it } from "vitest";
import {
  isAffiliationActiveOn,
  isDateInCouncilTerm,
  isDateInPeriod,
} from "./term-period";

describe("isDateInPeriod", () => {
  it("開始日・終了日を含む", () => {
    expect(isDateInPeriod("2030-01-01", "2030-01-01", "2030-12-31")).toBe(true);
    expect(isDateInPeriod("2030-12-31", "2030-01-01", "2030-12-31")).toBe(true);
  });

  it("開始日の前日・終了日の翌日は含まない", () => {
    expect(isDateInPeriod("2029-12-31", "2030-01-01", "2030-12-31")).toBe(
      false
    );
    expect(isDateInPeriod("2031-01-01", "2030-01-01", "2030-12-31")).toBe(
      false
    );
  });

  it("開始日と終了日が同じ（1日だけの期間）でもその日は含む", () => {
    expect(isDateInPeriod("2030-05-05", "2030-05-05", "2030-05-05")).toBe(true);
    expect(isDateInPeriod("2030-05-06", "2030-05-05", "2030-05-05")).toBe(
      false
    );
  });

  it("end が null なら終了日なしで、開始日以降は常に含む", () => {
    expect(isDateInPeriod("2999-12-31", "2030-01-01", null)).toBe(true);
    expect(isDateInPeriod("2029-12-31", "2030-01-01", null)).toBe(false);
  });

  it("月またぎ・閏日も文字列比較で正しく判定する", () => {
    expect(isDateInPeriod("2028-02-29", "2028-02-28", "2028-03-01")).toBe(true);
    expect(isDateInPeriod("2028-03-02", "2028-02-28", "2028-03-01")).toBe(
      false
    );
  });

  it("存在しない日付はエラーにする", () => {
    expect(() => isDateInPeriod("2030-13-45", "2030-01-01", null)).toThrow(
      /YYYY-MM-DD/
    );
    expect(() => isDateInPeriod("2029-02-29", "2029-01-01", null)).toThrow(
      /YYYY-MM-DD/
    );
  });

  it("YYYY-MM-DD 以外の形式はエラーにする", () => {
    expect(() => isDateInPeriod("2030/01/01", "2030-01-01", null)).toThrow();
    expect(() => isDateInPeriod("2030-01-01", "20300101", null)).toThrow();
    expect(() =>
      isDateInPeriod("2030-01-01", "2030-01-01", "2030-01-01T00:00:00Z")
    ).toThrow();
  });
});

describe("isDateInCouncilTerm", () => {
  const term = { start_date: "2030-01-01", end_date: "2033-12-31" };

  it("任期の境界日を含む", () => {
    expect(isDateInCouncilTerm("2030-01-01", term)).toBe(true);
    expect(isDateInCouncilTerm("2033-12-31", term)).toBe(true);
  });

  it("任期外は含まない", () => {
    expect(isDateInCouncilTerm("2029-12-31", term)).toBe(false);
    expect(isDateInCouncilTerm("2034-01-01", term)).toBe(false);
  });
});

describe("isAffiliationActiveOn", () => {
  it("valid_to が null なら継続中として開始日以降は有効", () => {
    const affiliation = { valid_from: "2030-01-01", valid_to: null };
    expect(isAffiliationActiveOn("2030-01-01", affiliation)).toBe(true);
    expect(isAffiliationActiveOn("2040-01-01", affiliation)).toBe(true);
    expect(isAffiliationActiveOn("2029-12-31", affiliation)).toBe(false);
  });

  it("valid_to がある場合はその日まで有効で、翌日は無効", () => {
    const affiliation = { valid_from: "2030-01-01", valid_to: "2031-06-30" };
    expect(isAffiliationActiveOn("2031-06-30", affiliation)).toBe(true);
    expect(isAffiliationActiveOn("2031-07-01", affiliation)).toBe(false);
  });
});
