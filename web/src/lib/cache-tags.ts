/**
 * Next.js cache tags for revalidation
 */
export const CACHE_TAGS = {
  BILLS: "bills",
  COUNCIL_ACTIONS: "council-actions",
  DIET_SESSIONS: "diet-sessions",
  GENERAL_QUESTIONS: "general-questions",
  INTERVIEW_CONFIGS: "interview-configs",
  TOPICS: "topics",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

export const ALL_CACHE_TAGS = Object.values(CACHE_TAGS);
