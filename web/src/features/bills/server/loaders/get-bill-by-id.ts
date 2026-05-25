import { unstable_cache } from "next/cache";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { findPublishedCouncilActionsByBillId } from "@/features/council-actions/server/repositories/council-action-repository";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { BillWithContent } from "../../shared/types";
import {
  findBillMemberVotesByBillId,
  findPublishedBillById,
  findMiraiStanceByBillId,
  findTagsByBillId,
  normalizeDietSession,
  normalizeProposerMember,
} from "../repositories/bill-repository";
import { getBillContentWithDifficulty } from "./helpers/get-bill-content";

export async function getBillById(id: string): Promise<BillWithContent | null> {
  // キャッシュ外でcookiesにアクセス
  const difficultyLevel = await getDifficultyLevel();
  return _getCachedBillById(id, difficultyLevel);
}

const _getCachedBillById = unstable_cache(
  async (
    id: string,
    difficultyLevel: DifficultyLevelEnum
  ): Promise<BillWithContent | null> => {
    // 基本的なbill情報、見解、コンテンツ、タグを並列取得
    // 公開ステータスの議案のみを取得
    const [
      bill,
      miraiStance,
      billContent,
      billTags,
      billMemberVotes,
      councilActions,
    ] = await Promise.all([
      findPublishedBillById(id),
      findMiraiStanceByBillId(id),
      getBillContentWithDifficulty(id, difficultyLevel),
      findTagsByBillId(id),
      findBillMemberVotesByBillId(id),
      findPublishedCouncilActionsByBillId(id),
    ]);

    if (!bill) {
      console.error("Failed to fetch bill");
      return null;
    }

    // タグデータを整形
    const tags =
      billTags
        ?.map((bt) => bt.tags)
        .filter((tag): tag is { id: string; label: string } => tag !== null) ||
      [];

    return {
      ...bill,
      mirai_stance: miraiStance || undefined,
      bill_content: billContent || undefined,
      tags,
      diet_session: normalizeDietSession(
        (
          bill as typeof bill & {
            diet_session?:
              | {
                  name: string;
                  slug: string | null;
                }
              | Array<{
                  name: string;
                  slug: string | null;
                }>
              | null;
          }
        ).diet_session
      ),
      bill_member_votes: billMemberVotes,
      councilActions,
      proposer_member: normalizeProposerMember(
        (
          bill as typeof bill & {
            proposer_member?:
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
          }
        ).proposer_member
      ),
    };
  },
  ["bill-by-id"],
  {
    revalidate: 600, // 10分（600秒）
    tags: [CACHE_TAGS.BILLS, CACHE_TAGS.COUNCIL_ACTIONS],
  }
);
