import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TopicTimelineReview } from "../../shared/types";

const REVIEW_TIMELINE_PATHS: Record<string, string> = {
  "rito-koshien-r8-dai4":
    "docs/general_questions_minutes/r8-dai4-teireikai.timeline-review-rito-koshien.json",
};

export async function getTopicTimelineReview(
  topicSlug: string
): Promise<TopicTimelineReview | null> {
  const relativePath = REVIEW_TIMELINE_PATHS[topicSlug];
  if (!relativePath) {
    return null;
  }

  try {
    const absolutePath = resolve(process.cwd(), "..", relativePath);
    const raw = await readFile(absolutePath, "utf-8");
    const parsed = JSON.parse(raw) as TopicTimelineReview;

    if (
      parsed.schema !== "timeline-review/v1" ||
      parsed.topic_slug !== topicSlug ||
      !Array.isArray(parsed.timeline_items)
    ) {
      console.error("[topics] Invalid timeline review artifact:", relativePath);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error(
      "[topics] Failed to load timeline review artifact:",
      topicSlug,
      error
    );
    return null;
  }
}
