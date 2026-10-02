import "server-only";

import { cache } from "react";
import { createAdminClient } from "@mirai-gikai/supabase";
import type { Member, MemberDetail } from "../../shared/types";
import {
  buildMemberDetail,
  buildMemberRoster,
  type MemberRosterState,
  todayInJst,
} from "../../shared/utils/member-roster";

/**
 * 議員名簿のデータ取得（server-only）。
 *
 * - 新モデル（council_terms / member_terms / member_affiliation_snapshots）は RLS default-deny のため、
 *   必ず service role の admin client で読む。ブラウザには露出しない
 * - current mode / legacy mode の判定と Member の組み立ては shared/utils/member-roster.ts（純粋関数）で行う
 */

type DbError = { code?: string; message: string };

/** テーブルが存在しない（migration 未適用の環境）エラー */
function isMissingTable(error: DbError, table: string): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message.includes(`Could not find the table 'public.${table}'`) ||
    error.message.includes(`relation "public.${table}" does not exist`)
  );
}

/** 議員名簿に必要な状態を読む。1リクエスト内ではキャッシュして重複取得しない */
const loadMemberRosterState = cache(async (): Promise<MemberRosterState> => {
  const supabase = createAdminClient();

  const [members, memberLinks, councilTerms, memberTerms, snapshots] =
    await Promise.all([
      supabase
        .from("members")
        .select("*")
        .order("name_kana", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true }),
      supabase
        .from("member_links")
        .select("id, member_id, service, label, url, sort_order")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("council_terms").select("id, start_date, end_date"),
      supabase
        .from("member_terms")
        .select(
          "id, council_term_id, member_id, seat_number, election_count, start_date, end_date"
        ),
      supabase
        .from("member_affiliation_snapshots")
        .select("member_term_id, observed_on, party, party_group"),
    ]);

  // members が無い環境は従来どおり空の名簿にする。それ以外のエラーは握りつぶさない
  if (members.error && !isMissingTable(members.error, "members")) {
    throw new Error(`Failed to fetch members: ${members.error.message}`);
  }
  if (memberLinks.error && !isMissingTable(memberLinks.error, "member_links")) {
    throw new Error(
      `Failed to fetch member links: ${memberLinks.error.message}`
    );
  }

  // 新モデルのテーブルが無い環境は「新任期データ未投入」と同じ扱い（legacy mode）にする
  const optional = <T>(
    result: { data: T[] | null; error: DbError | null },
    table: string
  ): T[] => {
    if (result.error) {
      if (isMissingTable(result.error, table)) return [];
      throw new Error(`Failed to fetch ${table}: ${result.error.message}`);
    }
    return result.data ?? [];
  };

  return {
    members: members.data ?? [],
    memberLinks: (memberLinks.data ?? []).map((link) => ({
      id: link.id,
      member_id: link.member_id,
      service: link.service,
      label: link.label,
      url: link.url,
      sort_order: link.sort_order ?? 0,
    })),
    councilTerms: optional(councilTerms, "council_terms"),
    memberTerms: optional(memberTerms, "member_terms"),
    snapshots: optional(snapshots, "member_affiliation_snapshots"),
  };
});

/**
 * 議員一覧。
 * 新任期データが完全に揃っている場合だけ現任期の議員（current mode）を返し、
 * 欠けている間は従来どおり legacy 名簿（members.election_count が非 NULL の旧22人）を返す。
 */
export async function getMembers(): Promise<Member[]> {
  const state = await loadMemberRosterState();
  const roster = buildMemberRoster(state, todayInJst(new Date()));

  // 段階的な import の途中など、新モデルが不完全で legacy に戻ったときだけ記録する
  if (roster.mode === "legacy" && roster.partial) {
    console.warn(
      `[members] current roster is incomplete; using legacy roster: ${roster.reason}`
    );
  }
  return roster.members;
}

/**
 * 議員詳細。
 * current mode で名簿に載っていない議員（前議員）も、members に存在すれば返す（404 にしない）。
 */
export const getMemberById = cache(
  async (memberId: string): Promise<MemberDetail | null> => {
    const state = await loadMemberRosterState();
    return buildMemberDetail(memberId, state, todayInJst(new Date()));
  }
);
