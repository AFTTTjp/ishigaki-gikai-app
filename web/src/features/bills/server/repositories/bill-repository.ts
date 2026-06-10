import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient, type Database } from "@mirai-gikai/supabase";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import type { BillMemberVote, BillProposerMember } from "../../shared/types";

// ============================================================
// Bills
// ============================================================

type BillRow = Database["public"]["Tables"]["bills"]["Row"];
type BillDietSession = {
  name: string;
  slug: string | null;
};
type BillWithOptionalProposer = BillRow & {
  diet_session?: BillDietSession | BillDietSession[] | null;
  proposer_member?: BillProposerMember | BillProposerMember[] | null;
};

/**
 * 公開済み議案を難易度コンテンツ付きで取得
 */
export async function findPublishedBillsWithContents(
  difficultyLevel: DifficultyLevelEnum
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select(
      `
      *,
      diet_session:diet_sessions (
        name,
        slug
      ),
      bill_contents!inner (
        id,
        bill_id,
        title,
        summary,
        content,
        difficulty_level,
        created_at,
        updated_at
      )
    `
    )
    .eq("publish_status", "published")
    .eq("bill_contents.difficulty_level", difficultyLevel)
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch bills: ${error.message}`);
  }

  return data;
}

/**
 * 公開済み議案を1件取得
 */
export async function findPublishedBillById(id: string) {
  const supabase = createAdminClient();
  const query = () =>
    supabase
      .from("bills")
      .select(
        `
        *,
        diet_session:diet_sessions (
          name,
          slug
        ),
        proposer_member:members!bills_proposer_member_id_fkey (
          id,
          name,
          party,
          party_group
        )
      `
      )
      .eq("id", id)
      .eq("publish_status", "published")
      .single();

  const fallbackQuery = () =>
    supabase
      .from("bills")
      .select("*")
      .eq("id", id)
      .eq("publish_status", "published")
      .single();

  let {
    data,
    error,
  }: {
    data: BillWithOptionalProposer | null;
    error: { message: string } | null;
  } = (await query()) as unknown as {
    data: BillWithOptionalProposer | null;
    error: { message: string } | null;
  };

  const isMissingProposerRelation =
    error &&
    (error.message.includes("bills_proposer_member_id_fkey") ||
      error.message.includes("proposer_member_id") ||
      error.message.includes("members"));

  if (isMissingProposerRelation) {
    ({ data, error } = (await fallbackQuery()) as unknown as {
      data: BillWithOptionalProposer | null;
      error: { message: string } | null;
    });
  }

  if (error) {
    return null;
  }

  return data;
}

/**
 * 管理者用: ステータス問わず議案を1件取得
 */
export async function findBillById(id: string) {
  const supabase = createAdminClient();
  const query = () =>
    supabase
      .from("bills")
      .select(
        `
        *,
        diet_session:diet_sessions (
          name,
          slug
        ),
        proposer_member:members!bills_proposer_member_id_fkey (
          id,
          name,
          party,
          party_group
        )
      `
      )
      .eq("id", id)
      .single();

  const fallbackQuery = () =>
    supabase.from("bills").select("*").eq("id", id).single();

  let {
    data,
    error,
  }: {
    data: BillWithOptionalProposer | null;
    error: { message: string } | null;
  } = (await query()) as unknown as {
    data: BillWithOptionalProposer | null;
    error: { message: string } | null;
  };

  const isMissingProposerRelation =
    error &&
    (error.message.includes("bills_proposer_member_id_fkey") ||
      error.message.includes("proposer_member_id") ||
      error.message.includes("members"));

  if (isMissingProposerRelation) {
    ({ data, error } = (await fallbackQuery()) as unknown as {
      data: BillWithOptionalProposer | null;
      error: { message: string } | null;
    });
  }

  if (error) {
    return null;
  }

  return data;
}

export function normalizeProposerMember(
  proposerMember: BillProposerMember | BillProposerMember[] | null | undefined
): BillProposerMember | undefined {
  if (Array.isArray(proposerMember)) {
    return proposerMember[0];
  }

  return proposerMember ?? undefined;
}

export function normalizeDietSession(
  dietSession: BillDietSession | BillDietSession[] | null | undefined
): BillDietSession | undefined {
  if (Array.isArray(dietSession)) {
    return dietSession[0];
  }

  return dietSession ?? undefined;
}

/**
 * 議案のmirai_stanceを取得
 */
export async function findMiraiStanceByBillId(billId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mirai_stances")
    .select("*")
    .eq("bill_id", billId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * 議案のタグを取得
 */
export async function findTagsByBillId(billId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills_tags")
    .select("tags(id, label)")
    .eq("bill_id", billId);

  if (error) {
    return null;
  }

  return data;
}

// ============================================================
// Bill Contents
// ============================================================

/**
 * 指定された難易度の議案コンテンツを取得
 */
export async function findBillContentByDifficulty(
  billId: string,
  difficultyLevel: DifficultyLevelEnum
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bill_contents")
    .select("*")
    .eq("bill_id", billId)
    .eq("difficulty_level", difficultyLevel)
    .single();

  if (error) {
    console.error(`Failed to fetch bill content: ${error.message}`);
    return null;
  }

  return data;
}

type VoteDatabase = {
  public: {
    Tables: {
      bill_member_votes: {
        Row: {
          bill_id: string;
          member_id: string;
          seat_number: number;
          vote_type: "for" | "not_for" | "absent" | "left" | "chair";
          source_label: string | null;
          source_url: string | null;
        };
      };
      members: {
        Row: {
          id: string;
          name: string;
          party: string | null;
          party_group: string | null;
        };
      };
    };
  };
};

/**
 * 議案ごとの議員賛否を取得
 */
export async function findBillMemberVotesByBillId(
  billId: string
): Promise<BillMemberVote[]> {
  const supabase = createClient<VoteDatabase>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("bill_member_votes")
    .select(
      `
      member_id,
      seat_number,
      vote_type,
      source_label,
      source_url,
      members!inner (
        id,
        name,
        party,
        party_group
      )
    `
    )
    .eq("bill_id", billId)
    .order("seat_number", { ascending: true });

  if (error) {
    const isMissingVotesTable =
      error.message.includes(
        "Could not find the table 'public.bill_member_votes'"
      ) ||
      error.message.includes(
        'relation "public.bill_member_votes" does not exist'
      );

    if (isMissingVotesTable) {
      return [];
    }

    console.error(`Failed to fetch bill member votes: ${error.message}`);
    return [];
  }

  const voteRows = (data ?? []) as Array<{
    seat_number: number;
    vote_type: BillMemberVote["vote_type"];
    source_label: string | null;
    source_url: string | null;
    members:
      | {
          id: string;
          name: string;
          party: string | null;
          party_group: string | null;
        }
      | Array<{
          id: string;
          name: string;
          party: string | null;
          party_group: string | null;
        }>
      | null;
  }>;

  return voteRows.flatMap((row) => {
    const member = Array.isArray(row.members) ? row.members[0] : row.members;

    if (!member) {
      return [];
    }

    return [
      {
        vote_type: row.vote_type,
        source_label: row.source_label,
        source_url: row.source_url,
        member: {
          id: member.id,
          name: member.name,
          party: member.party,
          party_group: member.party_group,
          seat_number: row.seat_number,
        },
      },
    ];
  });
}

// ============================================================
// Tags (bulk)
// ============================================================

import { groupTagsByBillId } from "../../shared/utils/group-tags";

/**
 * 複数のbill_idに紐づくタグを一括取得し、bill_idごとにグループ化して返す
 */
export async function findTagsByBillIds(
  billIds: string[]
): Promise<Map<string, Array<{ id: string; label: string }>>> {
  if (billIds.length === 0) {
    return new Map();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills_tags")
    .select("bill_id, tags(id, label)")
    .in("bill_id", billIds);

  if (error) {
    throw new Error(`Failed to fetch tags: ${error.message}`);
  }

  return groupTagsByBillId(data ?? []);
}

// ============================================================
// Diet Session Bills
// ============================================================

/**
 * 議会会期IDに紐づく公開済み議案を取得
 */
export async function findPublishedBillsByDietSession(
  dietSessionId: string,
  difficultyLevel: DifficultyLevelEnum
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select(
      `
      *,
      diet_session:diet_sessions (
        name,
        slug
      ),
      bill_contents!inner (
        id,
        bill_id,
        title,
        summary,
        content,
        difficulty_level,
        created_at,
        updated_at
      )
    `
    )
    .eq("diet_session_id", dietSessionId)
    .eq("publish_status", "published")
    .eq("bill_contents.difficulty_level", difficultyLevel)
    .order("status_order", { ascending: true })
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch bills by diet session: ${error.message}`);
  }

  return data;
}

/**
 * 特定議員が提出者の公開済み議案を取得
 */
export async function findPublishedBillsByProposerMember(
  memberId: string,
  difficultyLevel: DifficultyLevelEnum
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select(
      `
      *,
      diet_session:diet_sessions (
        name,
        slug
      ),
      bill_contents!inner (
        id,
        bill_id,
        title,
        summary,
        content,
        difficulty_level,
        created_at,
        updated_at
      )
    `
    )
    .eq("publish_status", "published")
    .eq("proposer_member_id", memberId)
    .eq("bill_contents.difficulty_level", difficultyLevel)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch bills by proposer member:", error);
    return [];
  }

  return data ?? [];
}

/**
 * 前回の議会会期の公開済み議案を取得（成立議案を優先、件数制限あり）
 */
export async function findPreviousSessionBills(
  dietSessionId: string,
  difficultyLevel: DifficultyLevelEnum,
  limit: number
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bills")
    .select(
      `
      *,
      diet_session:diet_sessions (
        name,
        slug
      ),
      bill_contents!inner (
        id,
        bill_id,
        title,
        summary,
        content,
        difficulty_level,
        created_at,
        updated_at
      )
    `
    )
    .eq("diet_session_id", dietSessionId)
    .eq("publish_status", "published")
    .eq("bill_contents.difficulty_level", difficultyLevel)
    .order("status_order", { ascending: true })
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch previous session bills:", error);
    return [];
  }

  return data ?? [];
}

/**
 * 前回の議会会期の公開済み議案数を取得
 */
export async function countPublishedBillsByDietSession(
  dietSessionId: string,
  difficultyLevel: DifficultyLevelEnum
): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("bills")
    .select("*, bill_contents!inner(difficulty_level)", {
      count: "exact",
      head: true,
    })
    .eq("diet_session_id", dietSessionId)
    .eq("publish_status", "published")
    .eq("bill_contents.difficulty_level", difficultyLevel);

  if (error) {
    console.error("Failed to count previous session bills:", error);
    return 0;
  }

  return count ?? 0;
}

// ============================================================
// Featured
// ============================================================

/**
 * featured_priorityが設定されているタグを取得
 */
export async function findFeaturedTags() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, label, description, featured_priority")
    .not("featured_priority", "is", null)
    .order("featured_priority", { ascending: true });

  if (error) {
    console.error("Failed to fetch featured tags:", error);
    return [];
  }

  return data ?? [];
}

/**
 * 特定タグに紐づく公開済み議案を取得（bill_contents + タグ付き）
 */
export async function findPublishedBillsByTag(
  tagId: string,
  difficultyLevel: DifficultyLevelEnum,
  dietSessionId: string | null
) {
  const supabase = createAdminClient();
  let query = supabase
    .from("bills_tags")
    .select(
      `
      bill_id,
      bills!inner (
        *,
        diet_session:diet_sessions (
          name,
          slug
        ),
        bill_contents!inner (
          id,
          bill_id,
          title,
          summary,
          content,
          difficulty_level,
          created_at,
          updated_at
        ),
        bills_tags!inner (
          tags (
            id,
            label
          )
        )
      )
    `
    )
    .eq("tag_id", tagId)
    .eq("bills.publish_status", "published")
    .eq("bills.bill_contents.difficulty_level", difficultyLevel);

  if (dietSessionId) {
    query = query.eq("bills.diet_session_id", dietSessionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`Failed to fetch bills for tag:`, error);
    return null;
  }

  return data;
}

/**
 * 注目の議案を取得（is_featured = true）
 */
export async function findFeaturedBillsWithContents(
  difficultyLevel: DifficultyLevelEnum,
  dietSessionId: string | null
) {
  const supabase = createAdminClient();
  let query = supabase
    .from("bills")
    .select(
      `
      *,
      diet_session:diet_sessions (
        name,
        slug
      ),
      bill_contents (
        id,
        bill_id,
        title,
        summary,
        content,
        difficulty_level,
        created_at,
        updated_at
      ),
      tags:bills_tags(
        tag:tags(
          id,
          label
        )
      )
    `
    )
    .eq("is_featured", true)
    .eq("bill_contents.difficulty_level", difficultyLevel)
    .order("published_at", { ascending: false });

  if (dietSessionId) {
    query = query.eq("diet_session_id", dietSessionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch featured bills:", error);
    return [];
  }

  return data ?? [];
}

/**
 * 指定の議案IDリストに対して bill_contents を取得（フォールバック用）
 */
export async function findBillContentsByBillIds(
  billIds: string[],
  difficultyLevel: DifficultyLevelEnum
) {
  if (billIds.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bill_contents")
    .select("*")
    .in("bill_id", billIds)
    .eq("difficulty_level", difficultyLevel);

  if (error) {
    console.error("Failed to fetch bill contents by bill IDs:", error);
    return [];
  }

  return data ?? [];
}

// ============================================================
// Coming Soon
// ============================================================

/**
 * Coming Soon議案を取得
 */
export async function findComingSoonBills(dietSessionId: string | null) {
  const supabase = createAdminClient();
  let query = supabase
    .from("bills")
    .select(
      `
      id,
      name,
      originating_house,
      shugiin_url,
      bill_contents (
        title,
        difficulty_level
      )
    `
    )
    .eq("publish_status", "coming_soon")
    .order("created_at", { ascending: false });

  if (dietSessionId) {
    query = query.eq("diet_session_id", dietSessionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch coming soon bills:", error);
    return [];
  }

  return data ?? [];
}

// ============================================================
// Preview Tokens
// ============================================================

/**
 * プレビュートークンを検証
 */
export async function findPreviewToken(billId: string, token: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("preview_tokens")
    .select("expires_at")
    .eq("bill_id", billId)
    .eq("token", token)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// ============================================================
// Interview Status
// ============================================================

/**
 * 複数のbill_idに対して、公開中のインタビュー設定があるかを一括判定
 */
export async function findBillIdsWithPublicInterview(
  billIds: string[]
): Promise<Set<string>> {
  if (billIds.length === 0) {
    return new Set();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("interview_configs")
    .select("bill_id")
    .in("bill_id", billIds)
    .eq("status", "public");

  if (error) {
    console.error("Failed to fetch interview configs:", error);
    return new Set();
  }

  return new Set(data.map((row) => row.bill_id));
}
