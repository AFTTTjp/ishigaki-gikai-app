import { describe, expect, it } from "vitest";
import {
  getAnonClient,
  getAuthenticatedClient,
  createTestUser,
  cleanupTestUser,
} from "../utils";

/**
 * RLS 有効 + ポリシーなし（default deny）のテーブルを検証する。
 * anon / authenticated どちらからも SELECT できないことを確認する。
 *
 * 注意: bills / bill_contents / diet_sessions は公開読み取りポリシーあり（default deny 対象外）。
 * 詳細: supabase/migrations/20260409103000_enable_rls_on_public_bill_tables.sql
 */

const tables = [
  "mirai_stances",
  "chats",
  "tags",
  "bills_tags",
  "preview_tokens",
  "interview_configs",
  "interview_questions",
  "interview_sessions",
  "interview_messages",
  "interview_report",
  "council_terms",
  "member_terms",
  "member_affiliations",
] as const;

describe("RLS default deny（全テーブル共通）", () => {
  describe("anon クライアント", () => {
    const anon = getAnonClient();

    for (const table of tables) {
      it(`${table}: SELECT が空結果になる`, async () => {
        const { data, error } = await anon.from(table).select("*").limit(1);
        // RLS で拒否される場合、エラーか空配列が返る
        if (error) {
          expect(error).toBeTruthy();
        } else {
          expect(data).toEqual([]);
        }
      });
    }

    it("bills: INSERT が拒否される", async () => {
      const { error } = await anon.from("bills").insert({
        name: "不正な挿入テスト",
        originating_house: "HR",
        status: "introduced",
        publish_status: "draft",
      });
      expect(error).not.toBeNull();
    });

    it("diet_sessions: INSERT が拒否される", async () => {
      const { error } = await anon.from("diet_sessions").insert({
        name: "不正な挿入テスト",
        start_date: "2025-01-01",
        end_date: "2025-06-30",
        slug: "rls-test",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("authenticated クライアント", () => {
    let userId: string;
    let email: string;
    const password = "test-password-123";

    beforeAll(async () => {
      email = `rls-test-${Date.now()}@example.com`;
      const user = await createTestUser(email, password);
      userId = user.id;
    });

    afterAll(async () => {
      await cleanupTestUser(userId);
    });

    for (const table of tables) {
      it(`${table}: SELECT が空結果になる`, async () => {
        const client = await getAuthenticatedClient(email, password);
        const { data, error } = await client.from(table).select("*").limit(1);
        if (error) {
          expect(error).toBeTruthy();
        } else {
          expect(data).toEqual([]);
        }
      });
    }

    it("bills: INSERT が拒否される", async () => {
      const client = await getAuthenticatedClient(email, password);
      const { error } = await client.from("bills").insert({
        name: "不正な挿入テスト",
        originating_house: "HR",
        status: "introduced",
        publish_status: "draft",
      });
      expect(error).not.toBeNull();
    });

    it("diet_sessions: INSERT が拒否される", async () => {
      const client = await getAuthenticatedClient(email, password);
      const { error } = await client.from("diet_sessions").insert({
        name: "不正な挿入テスト",
        start_date: "2025-01-01",
        end_date: "2025-06-30",
        slug: "rls-test",
      });
      expect(error).not.toBeNull();
    });
  });
});
