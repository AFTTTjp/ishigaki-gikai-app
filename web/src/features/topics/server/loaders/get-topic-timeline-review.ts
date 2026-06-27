import "server-only";
import type { TopicTimelineReview } from "../../shared/types";
import ritoKoshienTimelineReview from "../fixtures/timeline-reviews/r8-dai4-teireikai.timeline-review-rito-koshien.json";

// Runtime-safe copy for the Topic UI PoC.
// The review-source canonical artifact remains under docs/general_questions_minutes/.
const REVIEW_TIMELINES: Record<string, TopicTimelineReview> = {
  "rito-koshien-r8-dai4": ritoKoshienTimelineReview as TopicTimelineReview,
};

export async function getTopicTimelineReview(
  topicSlug: string
): Promise<TopicTimelineReview | null> {
  const timelineReview = REVIEW_TIMELINES[topicSlug];
  if (!timelineReview) {
    return null;
  }

  if (
    timelineReview.schema !== "timeline-review/v1" ||
    timelineReview.topic_slug !== topicSlug ||
    !Array.isArray(timelineReview.timeline_items)
  ) {
    console.error("[topics] Invalid timeline review fixture:", topicSlug);
    return null;
  }

  return timelineReview;
}
