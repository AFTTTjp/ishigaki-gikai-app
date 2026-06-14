import "server-only";
import { unstable_cache } from "next/cache";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { TopicWithRelatedBills } from "../../shared/types";
import { findActiveTopicWithRelatedBills } from "../repositories/topic-repository";

export async function getTopicBySlug(
  slug: string
): Promise<TopicWithRelatedBills | null> {
  const difficultyLevel = await getDifficultyLevel();
  return _getCachedTopicBySlug(slug, difficultyLevel);
}

const _getCachedTopicBySlug = unstable_cache(
  async (
    slug: string,
    difficultyLevel: DifficultyLevelEnum
  ): Promise<TopicWithRelatedBills | null> => {
    try {
      return await findActiveTopicWithRelatedBills(slug, difficultyLevel);
    } catch (error) {
      console.error("[topics] Failed to load topic:", slug, error);
      return null;
    }
  },
  ["topic-detail"],
  {
    revalidate: 600,
    tags: [
      CACHE_TAGS.TOPICS,
      CACHE_TAGS.BILLS,
      CACHE_TAGS.COUNCIL_ACTIONS,
      CACHE_TAGS.GENERAL_QUESTIONS,
    ],
  }
);
