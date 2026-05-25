import "server-only";
import { createAdminClient } from "@mirai-gikai/supabase";
import type { CouncilAction } from "../../shared/types";

/**
 * topic_id に紐づく published な council_actions を取得する。
 *
 * 経路: topic_bills → council_action_bills → council_actions
 *
 * topic_bills から取得した bill_ids を使うことで、publish_status や
 * difficulty_level によるフィルタを経ていない全 bill を対象にできる。
 * status = 'draft' の council_action は除外する。
 */
export async function findPublishedCouncilActionsByTopicId(
  topicId: string
): Promise<CouncilAction[]> {
  const supabase = createAdminClient();

  // Step 1: topic に紐づく全 bill_id を取得
  const { data: topicBillRows, error: topicBillsError } = await supabase
    .from("topic_bills")
    .select("bill_id")
    .eq("topic_id", topicId);

  if (topicBillsError) {
    throw new Error(
      `Failed to fetch topic bills for council actions: ${topicBillsError.message}`
    );
  }

  const billIds = (topicBillRows ?? []).map((r) => r.bill_id);
  if (billIds.length === 0) {
    return [];
  }

  return findPublishedCouncilActionsByBillIds(billIds);
}

/**
 * bill_id に紐づく published な council_actions を取得する。
 *
 * 経路: council_action_bills → council_actions
 *
 * status = 'draft' の council_action は除外する。
 */
export async function findPublishedCouncilActionsByBillId(
  billId: string
): Promise<CouncilAction[]> {
  return findPublishedCouncilActionsByBillIds([billId]);
}

/**
 * 複数の bill_ids に紐づく published な council_actions を取得する（内部共通処理）。
 */
async function findPublishedCouncilActionsByBillIds(
  billIds: string[]
): Promise<CouncilAction[]> {
  const supabase = createAdminClient();

  // Step 1: bill_ids に紐づく council_action_id を取得
  const { data: cabRows, error: cabError } = await supabase
    .from("council_action_bills")
    .select("council_action_id")
    .in("bill_id", billIds);

  if (cabError) {
    throw new Error(
      `Failed to fetch council action bills: ${cabError.message}`
    );
  }

  const actionIds = [
    ...new Set((cabRows ?? []).map((r) => r.council_action_id)),
  ];
  if (actionIds.length === 0) {
    return [];
  }

  // Step 2: published な council_actions を取得（draft は除外）
  const { data: actions, error: actionsError } = await supabase
    .from("council_actions")
    .select(
      "id, slug, kind, title, action_date, destination_name, destination_role, destination_body, description, official_url, source_url, image_url, status, created_at, updated_at"
    )
    .in("id", actionIds)
    .eq("status", "published")
    .order("action_date", { ascending: false });

  if (actionsError) {
    throw new Error(`Failed to fetch council actions: ${actionsError.message}`);
  }

  return actions ?? [];
}
