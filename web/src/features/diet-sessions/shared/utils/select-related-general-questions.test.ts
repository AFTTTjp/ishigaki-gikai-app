import { describe, expect, it } from "vitest";
import {
  type KeyPointRelatedQuestion,
  selectRelatedGeneralQuestions,
} from "./select-related-general-questions";

const questions: KeyPointRelatedQuestion[] = [
  { slug: "gq-1", memberName: "友寄永三", questionDate: "2026-06-15" },
  { slug: "gq-2", memberName: "後上里厚司", questionDate: "2026-06-15" },
  { slug: "gq-3", memberName: "宮良操", questionDate: "2026-06-17" },
];

describe("selectRelatedGeneralQuestions", () => {
  it("マッピングされた slug に一致する質問だけを返す", () => {
    const result = selectRelatedGeneralQuestions(["gq-1", "gq-3"], questions);
    expect(result.map((q) => q.slug)).toEqual(["gq-1", "gq-3"]);
  });

  it("questions 側の並び（question_number 昇順）を保つ", () => {
    // relatedSlugs の並びが逆でも questions の並びを優先する
    const result = selectRelatedGeneralQuestions(["gq-3", "gq-1"], questions);
    expect(result.map((q) => q.slug)).toEqual(["gq-1", "gq-3"]);
  });

  it("存在しない slug は無視する", () => {
    const result = selectRelatedGeneralQuestions(
      ["gq-1", "gq-not-imported"],
      questions
    );
    expect(result.map((q) => q.slug)).toEqual(["gq-1"]);
  });

  it("relatedSlugs が undefined のときは空配列を返す", () => {
    expect(selectRelatedGeneralQuestions(undefined, questions)).toEqual([]);
  });

  it("relatedSlugs が空配列のときは空配列を返す", () => {
    expect(selectRelatedGeneralQuestions([], questions)).toEqual([]);
  });

  it("一致が無いときは空配列を返す", () => {
    expect(selectRelatedGeneralQuestions(["gq-unknown"], questions)).toEqual(
      []
    );
  });

  it("質問リストが空でも安全に空配列を返す", () => {
    expect(selectRelatedGeneralQuestions(["gq-1"], [])).toEqual([]);
  });
});
