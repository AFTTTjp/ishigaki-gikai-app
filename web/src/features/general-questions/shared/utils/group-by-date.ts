import type { GeneralQuestion, GeneralQuestionsByDate } from "../types";

export function groupByDate(
  questions: GeneralQuestion[]
): GeneralQuestionsByDate[] {
  const map = new Map<string, GeneralQuestion[]>();
  for (const q of questions) {
    const list = map.get(q.question_date) ?? [];
    list.push(q);
    map.set(q.question_date, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, qs]) => ({ date, questions: qs }));
}
