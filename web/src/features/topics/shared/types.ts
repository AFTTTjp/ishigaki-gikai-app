import type { Database } from "@mirai-gikai/supabase";
import type { BillWithContent } from "@/features/bills/shared/types";
import type { CouncilAction } from "@/features/council-actions/shared/types";
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

export type TopicWithRelatedBills = Topic & {
  relatedBills: BillWithContent[];
  updates: TopicUpdate[];
  councilActions: CouncilAction[];
};
