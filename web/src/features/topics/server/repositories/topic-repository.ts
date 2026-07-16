import "server-only";
import { createAdminClient, type Database } from "@mirai-gikai/supabase";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { normalizeDietSession } from "@/features/bills/server/repositories/bill-repository";
import type { BillWithContent } from "@/features/bills/shared/types";
import { findPublishedCouncilActionsByTopicId } from "@/features/council-actions/server/repositories/council-action-repository";
import type {
  CityAnswerSummary,
  GeneralQuestionItem,
} from "@/features/general-questions/shared/types";
import type {
  GeneralQuestionForTopic,
  TopicListItem,
  TopicWithRelatedBills,
} from "../../shared/types";

type TopicRow = Database["public"]["Tables"]["topics"]["Row"];

function normalizeCityAnswerSummaries(value: unknown): CityAnswerSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const summary = (entry as { summary?: unknown }).summary;
    const sourceUtteranceId = (entry as { source_utterance_id?: unknown })
      .source_utterance_id;

    if (typeof summary !== "string" || summary.trim().length === 0) {
      return [];
    }

    if (
      typeof sourceUtteranceId !== "string" ||
      sourceUtteranceId.trim().length === 0
    ) {
      return [];
    }

    return [{ summary, source_utterance_id: sourceUtteranceId }];
  });
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeGeneralQuestionItem(item: {
  id: string;
  general_question_id: string;
  item_number: number;
  title: string;
  sub_items?: unknown;
  city_answer_summaries?: unknown;
  confirmed_facts?: unknown;
}): GeneralQuestionItem {
  return {
    id: item.id,
    general_question_id: item.general_question_id,
    item_number: item.item_number,
    title: item.title,
    sub_items: normalizeStringArray(item.sub_items),
    city_answer_summaries: normalizeCityAnswerSummaries(
      item.city_answer_summaries
    ),
    confirmed_facts: normalizeStringArray(item.confirmed_facts),
  };
}

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

export async function findRelatedPublishedGeneralQuestionsByTopicId(
  topicId: string
): Promise<GeneralQuestionForTopic[]> {
  const supabase = createAdminClient();

  const { data: tgqRows, error: tgqError } = await supabase
    .from("topic_general_questions")
    .select("general_question_id")
    .eq("topic_id", topicId);

  if (tgqError) {
    throw new Error(
      `Failed to fetch topic general question relations: ${tgqError.message}`
    );
  }

  const gqIds = [...new Set((tgqRows ?? []).map((r) => r.general_question_id))];
  if (gqIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("general_questions")
    .select(
      `
      *,
      diet_session:diet_sessions ( slug, name ),
      items:general_question_items (
        id,
        general_question_id,
        item_number,
        title,
        sub_items,
        city_answer_summaries,
        confirmed_facts
      )
    `
    )
    .in("id", gqIds)
    .eq("status", "published")
    .order("question_number", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to fetch related general questions: ${error.message}`
    );
  }

  return (data ?? []).flatMap((row) => {
    const { diet_session, items, ...rest } = row;
    const session = Array.isArray(diet_session)
      ? diet_session[0]
      : diet_session;
    if (!session) {
      return [];
    }
    return [
      {
        ...rest,
        diet_session: { slug: session.slug, name: session.name },
        items: (items ?? [])
          .map(normalizeGeneralQuestionItem)
          .sort((a, b) => a.item_number - b.item_number),
      } as GeneralQuestionForTopic,
    ];
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
  const [relatedBills, relatedGeneralQuestions, councilActions, updatesResult] =
    await Promise.all([
      findRelatedPublishedBillsByTopicId(topic.id, difficultyLevel),
      findRelatedPublishedGeneralQuestionsByTopicId(topic.id),
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
    relatedGeneralQuestions,
    updates: updatesResult.data ?? [],
    councilActions,
  };
}
