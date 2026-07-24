import { describe, expect, it } from "vitest";

import {
  extractBillIdFromPath,
  isDifficultyTogglePage,
  isInterviewPage,
  isInterviewSection,
  isMainPage,
} from "./page-layout-utils";

describe("isMainPage", () => {
  it("returns true for the top page", () => {
    expect(isMainPage("/")).toBe(true);
  });

  it("returns true for a bill detail page", () => {
    expect(isMainPage("/bills/abc-123")).toBe(true);
  });

  it("returns false for a bill sub-page", () => {
    expect(isMainPage("/bills/abc-123/interview")).toBe(false);
  });

  it("returns false for an unrelated path", () => {
    expect(isMainPage("/about")).toBe(false);
  });

  it("returns false for the bills list page", () => {
    expect(isMainPage("/bills")).toBe(false);
    expect(isMainPage("/bills/")).toBe(false);
  });

  it("returns true for a topics detail page", () => {
    expect(isMainPage("/topics/some-slug")).toBe(true);
  });

  it("returns false for a topics sub-page", () => {
    expect(isMainPage("/topics/some-slug/sub")).toBe(false);
  });

  it("returns false for the topics list page", () => {
    expect(isMainPage("/topics")).toBe(false);
  });

  it("returns false for the members page", () => {
    expect(isMainPage("/members")).toBe(false);
  });
});

describe("isDifficultyTogglePage", () => {
  it("returns true for routes with difficulty-aware main content", () => {
    expect(isDifficultyTogglePage("/")).toBe(true);
    expect(isDifficultyTogglePage("/bills/abc-123")).toBe(true);
    expect(isDifficultyTogglePage("/topics/some-slug")).toBe(true);
  });

  it("returns true for /kokkai/[slug]/bills", () => {
    expect(
      isDifficultyTogglePage("/kokkai/ishigaki-r8-dai4-teireikai/bills")
    ).toBe(true);
  });

  it("returns true for /general-questions/[sessionSlug]", () => {
    expect(
      isDifficultyTogglePage("/general-questions/ishigaki-r8-dai4-teireikai")
    ).toBe(true);
  });

  it("returns false for /kokkai/[slug] (not the bills sub-page)", () => {
    expect(isDifficultyTogglePage("/kokkai/ishigaki-r8-dai4-teireikai")).toBe(
      false
    );
  });

  it("returns false for unrelated paths", () => {
    expect(isDifficultyTogglePage("/about")).toBe(false);
    expect(isDifficultyTogglePage("/bills")).toBe(false);
  });

  it("returns false for pages without difficulty-aware main content", () => {
    expect(isDifficultyTogglePage("/members")).toBe(false);
    expect(isDifficultyTogglePage("/topics")).toBe(false);
    expect(isDifficultyTogglePage("/faq")).toBe(false);
    expect(isDifficultyTogglePage("/donate")).toBe(false);
    expect(isDifficultyTogglePage("/privacy")).toBe(false);
    expect(isDifficultyTogglePage("/terms")).toBe(false);
    expect(isDifficultyTogglePage("/report/report-123")).toBe(false);
  });
});

describe("isInterviewPage", () => {
  it("returns true for an interview chat page", () => {
    expect(isInterviewPage("/bills/abc-123/interview/chat")).toBe(true);
  });

  it("returns false for an interview page without /chat", () => {
    expect(isInterviewPage("/bills/abc-123/interview")).toBe(false);
  });

  it("returns false for a bill detail page", () => {
    expect(isInterviewPage("/bills/abc-123")).toBe(false);
  });

  it("returns false for the top page", () => {
    expect(isInterviewPage("/")).toBe(false);
  });
});

describe("isInterviewSection", () => {
  it("returns true for the interview LP page", () => {
    expect(isInterviewSection("/bills/abc-123/interview")).toBe(true);
  });

  it("returns true for the interview chat page", () => {
    expect(isInterviewSection("/bills/abc-123/interview/chat")).toBe(true);
  });

  it("returns false for a bill detail page", () => {
    expect(isInterviewSection("/bills/abc-123")).toBe(false);
  });

  it("returns false for the top page", () => {
    expect(isInterviewSection("/")).toBe(false);
  });

  it("returns false for unrelated paths", () => {
    expect(isInterviewSection("/about")).toBe(false);
  });
});

describe("extractBillIdFromPath", () => {
  it("extracts bill ID from a bill detail path", () => {
    expect(extractBillIdFromPath("/bills/abc-123")).toBe("abc-123");
  });

  it("extracts bill ID from a bill sub-path", () => {
    expect(extractBillIdFromPath("/bills/abc-123/interview/chat")).toBe(
      "abc-123"
    );
  });

  it("returns null when path does not contain /bills/", () => {
    expect(extractBillIdFromPath("/about")).toBeNull();
  });

  it("returns null for the top page", () => {
    expect(extractBillIdFromPath("/")).toBeNull();
  });
});
