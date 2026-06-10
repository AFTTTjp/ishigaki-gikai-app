import { unstable_cache } from "next/cache";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { getActiveDietSession } from "@/features/diet-sessions/server/loaders/get-active-diet-session";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { BillWithContent } from "../../shared/types";
import {
  findBillContentsByBillIds,
  findFeaturedBillsWithContents,
  findTagsByBillIds,
  findBillIdsWithPublicInterview,
  normalizeDietSession,
} from "../repositories/bill-repository";

type FeaturedBillsOptions = {
  difficultyLevel?: DifficultyLevelEnum;
  activeDietSessionId?: string | null;
};

/**
 * 注目の議案を取得する
 * is_featured = true でアクティブな議会会期の公開済み議案を最新順に取得
 * アクティブな議会会期がない場合は全件取得
 */
export async function getFeaturedBills(
  options: FeaturedBillsOptions = {}
): Promise<BillWithContent[]> {
  const difficultyLevel =
    options.difficultyLevel ?? (await getDifficultyLevel());
  const activeDietSessionId =
    options.activeDietSessionId ?? (await getActiveDietSession())?.id ?? null;

  return _getCachedFeaturedBills(difficultyLevel, activeDietSessionId);
}

const _getCachedFeaturedBills = unstable_cache(
  async (
    difficultyLevel: DifficultyLevelEnum,
    dietSessionId: string | null
  ): Promise<BillWithContent[]> => {
    const data = await findFeaturedBillsWithContents(
      difficultyLevel,
      dietSessionId
    );

    if (data.length === 0) {
      return [];
    }

    // タグ情報とインタビュー状態を一括取得
    const billIds = data.map((item: { id: string }) => item.id);

    // hard content がない議案を特定してフォールバック用 normal content を取得
    const missingContentBillIds = data
      .filter(
        (item) =>
          !Array.isArray(item.bill_contents) || item.bill_contents.length === 0
      )
      .map((item: { id: string }) => item.id);

    const [tagsByBillId, interviewBillIds, fallbackContentsData] =
      await Promise.all([
        findTagsByBillIds(billIds),
        findBillIdsWithPublicInterview(billIds),
        // normal は常にコンテンツが存在する前提のためフォールバック不要
        missingContentBillIds.length > 0 && difficultyLevel !== "normal"
          ? findBillContentsByBillIds(missingContentBillIds, "normal")
          : Promise.resolve([]),
      ]);

    const fallbackByBillId = new Map(
      fallbackContentsData.map((bc) => [bc.bill_id, bc])
    );

    // データ構造を整形
    return data.map((item) => {
      const { bill_contents, ...bill } = item;
      const primaryContent = Array.isArray(bill_contents)
        ? bill_contents[0]
        : undefined;
      return {
        ...bill,
        bill_content: primaryContent ?? fallbackByBillId.get(item.id),
        tags: tagsByBillId.get(item.id) || [],
        diet_session: normalizeDietSession(item.diet_session),
        hasPublicInterview: interviewBillIds.has(item.id),
      };
    }) as BillWithContent[];
  },
  ["featured-bills-list"],
  {
    revalidate: 600, // 10分（600秒）
    tags: [CACHE_TAGS.BILLS, CACHE_TAGS.INTERVIEW_CONFIGS],
  }
);
