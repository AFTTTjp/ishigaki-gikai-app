import type { Database } from "@mirai-gikai/supabase";
import type { BillWithContent } from "@/features/bills/shared/types";
import type { CouncilAction } from "@/features/council-actions/shared/types";
import type { GeneralQuestion } from "@/features/general-questions/shared/types";
export type { CouncilAction };

export type Topic = Database["public"]["Tables"]["topics"]["Row"];
export type TopicBill = Database["public"]["Tables"]["topic_bills"]["Row"];
export type TopicUpdate = Database["public"]["Tables"]["topic_updates"]["Row"];

export type TopicUpdateKind =
  | "news"
  | "council"
  | "progress"
  | "decision"
  | "question";

export type TopicListItem = Pick<
  Topic,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "updated_at"
  | "current_status_label"
> & {
  relatedBillCount: number;
};

export type GeneralQuestionForTopic = GeneralQuestion & {
  diet_session: { slug: string; name: string };
};

export type TopicWithRelatedBills = Topic & {
  relatedBills: BillWithContent[];
  relatedGeneralQuestions: GeneralQuestionForTopic[];
  updates: TopicUpdate[];
  councilActions: CouncilAction[];
};

export interface TopicTimelineReviewSourceRef {
  source_kind: string;
  source_path: string;
  source_locator: string;
}

export interface TopicTimelineReviewItem {
  date: string;
  label: string;
  title: string;
  summary: string;
  event_type: string;
  status: "candidate" | "confirmed" | "unresolved";
  source_refs: TopicTimelineReviewSourceRef[];
  evidence_ids: string[];
}

export interface TopicTimelineReview {
  schema: "timeline-review/v1";
  topic_slug: string;
  issue_id: string;
  source_event_graph: string;
  timeline_items: TopicTimelineReviewItem[];
  review_required: string[];
}
