import { describe, expect, it } from "vitest";
import type { GeneralQuestion } from "../types";
import { groupByDate } from "./group-by-date";

function makeQuestion(
  id: string,
  question_date: string,
  question_number: number
): GeneralQuestion {
  return {
    id,
    slug: id,
    diet_session_id: "session-1",
    member_id: "member-1",
    question_number,
    question_date,
    seat_type: "floor",
    source_kind: "official",
    member_name_raw: "テスト議員",
    status: "published",
    items: [],
  };
}

describe("groupByDate", () => {
  it("空配列を渡すと空配列を返す", () => {
    expect(groupByDate([])).toEqual([]);
  });

  it("1日付のみの場合、その日付のグループを1つ返す", () => {
    const questions = [makeQuestion("q1", "2026-06-15", 1)];
    const result = groupByDate(questions);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-06-15");
    expect(result[0].questions).toHaveLength(1);
  });

  it("同じ日付の質問を1グループにまとめる", () => {
    const questions = [
      makeQuestion("q1", "2026-06-15", 1),
      makeQuestion("q2", "2026-06-15", 2),
      makeQuestion("q3", "2026-06-15", 3),
    ];
    const result = groupByDate(questions);
    expect(result).toHaveLength(1);
    expect(result[0].questions).toHaveLength(3);
  });

  it("複数日付の場合、日付昇順でソートされる", () => {
    const questions = [
      makeQuestion("q3", "2026-06-17", 1),
      makeQuestion("q1", "2026-06-15", 1),
      makeQuestion("q2", "2026-06-16", 1),
    ];
    const result = groupByDate(questions);
    expect(result.map((g) => g.date)).toEqual([
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
    ]);
  });

  it("各グループの質問数が正しい", () => {
    const questions = [
      makeQuestion("q1", "2026-06-15", 1),
      makeQuestion("q2", "2026-06-15", 2),
      makeQuestion("q3", "2026-06-16", 1),
    ];
    const result = groupByDate(questions);
    expect(result[0].questions).toHaveLength(2);
    expect(result[1].questions).toHaveLength(1);
  });
});
