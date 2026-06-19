/**
 * 論点カード（keyPoint）に表示する「関連する一般質問」を選ぶ純粋関数。
 *
 * - keyPoint.relatedGeneralQuestionSlugs（手動マッピング）に一致する質問だけを返す。
 * - DBに存在する質問（published のみが渡される前提）だけが `questions` に入るため、
 *   存在しない slug は自然に無視される。
 * - 一致が無ければ空配列を返す（呼び出し側で見出しごと非表示にする）。
 */

/** 論点カードに軽量表示するための一般質問データ */
export type KeyPointRelatedQuestion = {
  slug: string;
  memberName: string;
  questionDate: string;
};

export function selectRelatedGeneralQuestions(
  relatedSlugs: readonly string[] | undefined,
  questions: readonly KeyPointRelatedQuestion[]
): KeyPointRelatedQuestion[] {
  if (!relatedSlugs || relatedSlugs.length === 0) {
    return [];
  }
  const wanted = new Set(relatedSlugs);
  // questions 側の並び（question_number 昇順）を保ったまま抽出する
  return questions.filter((question) => wanted.has(question.slug));
}
