import "server-only";
import { createAdminClient } from "@mirai-gikai/supabase";
import type {
  DietSessionInfo,
  GeneralQuestion,
  GeneralQuestionItem,
} from "../../shared/types";

function normalizeGeneralQuestionItem(
  item: Partial<GeneralQuestionItem> & {
    id: string;
    general_question_id: string;
    item_number: number;
    title: string;
  }
): GeneralQuestionItem {
  return {
    id: item.id,
    general_question_id: item.general_question_id,
    item_number: item.item_number,
    title: item.title,
    sub_items: Array.isArray(item.sub_items) ? item.sub_items : [],
    confirmed_facts: Array.isArray(item.confirmed_facts)
      ? item.confirmed_facts
      : [],
  };
}

export async function findPublishedGeneralQuestionsBySessionSlug(
  sessionSlug: string
): Promise<GeneralQuestion[]> {
  const supabase = createAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("diet_sessions")
    .select("id")
    .eq("slug", sessionSlug)
    .single();

  if (sessionError || !session) {
    return [];
  }

  const { data, error } = await supabase
    .from("general_questions")
    .select(
      `
      id,
      slug,
      diet_session_id,
      member_id,
      question_number,
      question_date,
      seat_type,
      source_kind,
      member_name_raw,
      status,
      general_question_items (
        id,
        general_question_id,
        item_number,
        title,
        sub_items,
        confirmed_facts
      )
    `
    )
    .eq("diet_session_id", session.id)
    .eq("status", "published")
    .order("question_number", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to fetch general questions for session ${sessionSlug}: ${error.message}`
    );
  }

  return (data ?? []).map((row) => ({
    ...row,
    seat_type: row.seat_type as "floor" | "seat",
    items: (row.general_question_items ?? [])
      .map(normalizeGeneralQuestionItem)
      .sort((a, b) => a.item_number - b.item_number),
  }));
}

export async function findLatestGeneralQuestionSession(): Promise<DietSessionInfo | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("diet_sessions")
    .select("id, name, slug")
    .not("slug", "is", null)
    .order("start_date", { ascending: false })
    .limit(1)
    .single();

  if (error || !data || !data.slug) {
    return null;
  }

  const { count } = await supabase
    .from("general_questions")
    .select("id", { count: "exact", head: true })
    .eq("diet_session_id", data.id)
    .eq("status", "published");

  if (!count || count === 0) {
    return null;
  }

  return { id: data.id, name: data.name, slug: data.slug };
}

export async function findDietSessionBySlug(
  slug: string
): Promise<DietSessionInfo | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("diet_sessions")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (error || !data || !data.slug) {
    return null;
  }

  return { id: data.id, name: data.name, slug: data.slug };
}
