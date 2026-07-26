// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BillWithContent } from "@/features/bills/shared/types";
import type { DietSession } from "../../shared/types";
import { HomeDietSessionBillsSection } from "./home-diet-session-bills-section";

const session: DietSession = {
  id: "session-1",
  name: "令和8年第4回定例会",
  slug: "r8-dai4",
  shugiin_url: null,
  start_date: "2026-06-01",
  end_date: "2026-06-30",
  is_active: true,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-30T00:00:00.000Z",
};

function createBill(id: string, title: string): BillWithContent {
  return {
    id,
    name: title,
    status: "enacted",
    tags: [],
    thumbnail_url: null,
    published_at: "2026-06-07",
    is_featured: false,
    bill_content: {
      id: `content-${id}`,
      bill_id: id,
      title,
      summary: `${title}の説明`,
      content: `${title}の本文`,
      difficulty_level: "normal",
      created_at: "2026-06-07T00:00:00.000Z",
      updated_at: "2026-06-07T00:00:00.000Z",
    },
  } as unknown as BillWithContent;
}

describe("HomeDietSessionBillsSection", () => {
  it("公開議案を全件1回ずつ表示し、会期詳細と一般質問への導線を残す", () => {
    const bills = Array.from({ length: 17 }, (_, index) => {
      const billNumber = index + 36;
      return createBill(`bill-${billNumber}`, `議案第${billNumber}号`);
    });

    render(
      <HomeDietSessionBillsSection
        session={session}
        bills={bills}
        closed={false}
      />
    );

    const list = screen.getByTestId("current-session-bill-list");
    const billLinks = within(list).getAllByRole("link");
    expect(billLinks).toHaveLength(17);
    expect(list.className).toBe("flex flex-col gap-4");
    expect(list.className).not.toContain("grid");
    expect(list.className).not.toContain("lg:grid-cols-2");
    expect(billLinks.map((link) => link.getAttribute("href"))).toEqual(
      bills.map((bill) => `/bills/${bill.id}`)
    );
    expect(
      new Set(billLinks.map((link) => link.getAttribute("href"))).size
    ).toBe(17);

    expect(
      screen
        .getByRole("link", { name: "今会期の詳細を見る" })
        .getAttribute("href")
    ).toBe("/kokkai/r8-dai4/bills");
    expect(
      screen.getByRole("link", { name: "一般質問を見る" }).getAttribute("href")
    ).toBe("/general-questions/r8-dai4");
  });

  it("会期状態と公開件数を簡潔に表示する", () => {
    render(
      <HomeDietSessionBillsSection
        session={session}
        bills={[createBill("bill-36", "議案第36号")]}
        closed
      />
    );

    expect(screen.getByText("閉会")).toBeTruthy();
    expect(screen.getByText("公開中 1件")).toBeTruthy();
    expect(screen.getByText("2026.6.1〜2026.6.30")).toBeTruthy();
    expect(
      screen.queryByText(
        "この会期で公開されている議案を、議案番号順に掲載しています。気になるカードから内容や審議結果を確認できます。"
      )
    ).toBeNull();
  });
});
