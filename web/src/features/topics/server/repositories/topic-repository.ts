import "server-only";
import { createAdminClient, type Database } from "@mirai-gikai/supabase";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { normalizeDietSession } from "@/features/bills/server/repositories/bill-repository";
import type { BillWithContent } from "@/features/bills/shared/types";
import type { TopicListItem, TopicWithRelatedBills } from "../../shared/types";
import { findPublishedCouncilActionsByTopicId } from "@/features/council-actions/server/repositories/council-action-repository";

type TopicRow = Database["public"]["Tables"]["topics"]["Row"];

export async function findActiveTopicsWithBillCounts(): Promise<
  TopicListItem[]
> {
  const supabase = createAdminClient();
  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, slug, title, description, updated_at, current_status_label")
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (topicsError) {
    throw new Error(`Failed to fetch topics: ${topicsError.message}`);
  }

  if (!topics || topics.length === 0) {
    return [];
  }

  const topicIds = topics.map((topic) => topic.id);
  const { data: topicBills, error: topicBillsError } = await supabase
    .from("topic_bills")
    .select("topic_id, bill_id")
    .in("topic_id", topicIds);

  if (topicBillsError) {
    throw new Error(
      `Failed to fetch topic bill counts: ${topicBillsError.message}`
    );
  }

  const publishedBillIds = [
    ...new Set((topicBills ?? []).map((row) => row.bill_id)),
  ];
  const { data: publishedBills, error: publishedBillsError } =
    publishedBillIds.length > 0
      ? await supabase
          .from("bills")
          .select("id")
          .in("id", publishedBillIds)
          .eq("publish_status", "published")
      : { data: [], error: null };

  if (publishedBillsError) {
    throw new Error(
      `Failed to fetch published bills for topics: ${publishedBillsError.message}`
    );
  }

  const publishedBillIdSet = new Set(
    (publishedBills ?? []).map((bill) => bill.id)
  );
  const countByTopicId = new Map<string, number>();
  for (const row of topicBills ?? []) {
    if (!publishedBillIdSet.has(row.bill_id)) {
      continue;
    }
    countByTopicId.set(
      row.topic_id,
      (countByTopicId.get(row.topic_id) ?? 0) + 1
    );
  }

  return topics.map((topic) => ({
    ...topic,
    relatedBillCount: countByTopicId.get(topic.id) ?? 0,
  }));
}

export async function findActiveTopicBySlug(
  slug: string
): Promise<TopicRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch topic by slug: ${error.message}`);
  }

  return data;
}

export async function findRelatedPublishedBillsByTopicId(
  topicId: string,
  difficultyLevel: DifficultyLevelEnum
): Promise<BillWithContent[]> {
  const supabase = createAdminClient();
  const { data: topicBills, error: topicBillsError } = await supabase
    .from("topic_bills")
    .select("bill_id")
    .eq("topic_id", topicId);

  if (topicBillsError) {
    throw new Error(
      `Failed to fetch topic bill relations: ${topicBillsError.message}`
    );
  }

  const billIds = [...new Set((topicBills ?? []).map((row) => row.bill_id))];
  if (billIds.length === 0) {
    return [];
  }

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
    .in("id", billIds)
    .eq("publish_status", "published")
    .eq("bill_contents.difficulty_level", difficultyLevel)
    .order("status_order", { ascending: true })
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch related bills: ${error.message}`);
  }

  return (data ?? []).map((item) => {
    const { bill_contents, ...bill } = item;
    return {
      ...bill,
      bill_content: Array.isArray(bill_contents) ? bill_contents[0] : undefined,
      tags: [],
      diet_session: normalizeDietSession(item.diet_session),
      hasPublicInterview: false,
    };
  });
}

export async function findActiveTopicWithRelatedBills(
  slug: string,
  difficultyLevel: DifficultyLevelEnum
): Promise<TopicWithRelatedBills | null> {
  const topic = await findActiveTopicBySlug(slug);
  if (!topic) {
    return null;
  }

  const supabase = createAdminClient();
  const [relatedBills, councilActions, updatesResult] = await Promise.all([
    findRelatedPublishedBillsByTopicId(topic.id, difficultyLevel),
    findPublishedCouncilActionsByTopicId(topic.id),
    supabase
      .from("topic_updates")
      .select("*")
      .eq("topic_id", topic.id)
      .order("published_at", { ascending: false }),
  ]);

  if (updatesResult.error) {
    throw new Error(
      `Failed to fetch topic updates: ${updatesResult.error.message}`
    );
  }

  return {
    ...topic,
    relatedBills,
    updates: updatesResult.data ?? [],
    councilActions,
  };
}
