/**
 * 論点カード（keyPoint）に表示する「関連する一般質問」を item 単位で解決する純粋関数。
 *
 * - keyPoint.relatedGeneralQuestionItems（手動マッピング）に一致する item だけを返す。
 * - DBに存在する質問（published のみが渡される前提）だけが `questions` に入るため、
 *   存在しない slug / itemNumber は自然に無視される。
 * - subItemIndex が有効なら sub_items[subItemIndex] を、範囲外なら item title を表示する。
 * - subItemsPreview には、表示中テキストと重複しない sub_item を最大2件添える。
 * - 一致が無ければ空配列を返す（呼び出し側で見出しごと非表示にする）。
 */

/** 補足表示する sub_item の最大件数 */
const SUB_ITEMS_PREVIEW_LIMIT = 2;

/** keyPoint 側の手動マッピング（質問 slug + item 番号 + 任意の sub_item index） */
export type KeyPointQuestionItemRef = {
  questionSlug: string;
  itemNumber: number;
  subItemIndex?: number;
};

/** 解決に必要な一般質問データ（loader が渡す軽量形） */
export type KeyPointQuestionSource = {
  slug: string;
  memberName: string;
  questionDate: string;
  items: {
    itemNumber: number;
    title: string;
    subItems: string[];
  }[];
};

/** 表示用に解決された関連一般質問 */
export type ResolvedKeyPointQuestion = {
  /** React key 用の安定キー */
  key: string;
  memberName: string;
  /** item title または sub_item テキスト */
  displayTitle: string;
  questionDate: string;
  /** displayTitle の補足。表示中テキストと重複しない sub_item を最大2件。空なら省略 */
  subItemsPreview?: string[];
};

export function selectRelatedGeneralQuestionItems(
  refs: readonly KeyPointQuestionItemRef[] | undefined,
  questions: readonly KeyPointQuestionSource[]
): ResolvedKeyPointQuestion[] {
  if (!refs || refs.length === 0) {
    return [];
  }
  const bySlug = new Map(questions.map((q) => [q.slug, q]));
  const resolved: ResolvedKeyPointQuestion[] = [];

  // refs の並び（マッピング記述順）を保ったまま解決する
  for (const ref of refs) {
    const question = bySlug.get(ref.questionSlug);
    if (!question) {
      continue; // slug が DB に存在しない → スキップ
    }
    const item = question.items.find((i) => i.itemNumber === ref.itemNumber);
    if (!item) {
      continue; // itemNumber が存在しない → スキップ
    }

    // 既定は item title。subItemIndex が有効なら sub_item を優先表示。
    let displayTitle = item.title;
    if (ref.subItemIndex !== undefined) {
      const subItem = item.subItems[ref.subItemIndex];
      if (subItem !== undefined) {
        displayTitle = subItem;
      }
      // 範囲外なら item title のままフォールバック
    }

    // 補足表示: 表示中テキストと重複しない sub_item を最大2件
    const subItemsPreview = item.subItems
      .filter((subItem) => subItem !== displayTitle)
      .slice(0, SUB_ITEMS_PREVIEW_LIMIT);

    resolved.push({
      key: `${ref.questionSlug}-${ref.itemNumber}-${ref.subItemIndex ?? "title"}`,
      memberName: question.memberName,
      displayTitle,
      questionDate: question.questionDate,
      ...(subItemsPreview.length > 0 ? { subItemsPreview } : {}),
    });
  }

  return resolved;
}
