import { extractBillTitlePrefix } from "@/features/bills/shared/utils/bill-title";

/** 議案番号で議案を指定する分野グループの入力型（session-overviews の FeaturedBillGroup と構造一致） */
export type FeaturedBillGroupInput = {
  category: string;
  description?: string;
  billNumbers: readonly string[];
};

/** 議案番号を実際の議案へ解決した後の分野グループ */
export type ResolvedBillGroup<T> = {
  category: string;
  description?: string;
  bills: T[];
};

/**
 * 議案名の先頭接頭辞（「議案第45号」等）をキーに、最初の1件だけを引く Map を作る。
 * extractBillTitlePrefix による完全一致のみ（fuzzy マッチはしない）。
 */
function buildBillByNumber<T extends { name: string }>(
  bills: readonly T[]
): Map<string, T> {
  const billByNumber = new Map<string, T>();
  for (const bill of bills) {
    const number = extractBillTitlePrefix(bill.name);
    if (number && !billByNumber.has(number)) {
      billByNumber.set(number, bill);
    }
  }
  return billByNumber;
}

/**
 * トップページ「分野別に見る 今会期の議案」に出す議案を、分野グループ単位で解決する純粋関数。
 *
 * - 各グループの `billNumbers`（例「議案第45号」）と `bills[].name` 先頭の議案番号接頭辞を
 *   完全一致で対応付ける（extractBillTitlePrefix を使用。fuzzy マッチはしない）。
 * - 並びは `groups` および各 `billNumbers` の記述順を維持する。
 * - 解決できない番号（DBに無い／未公開・本文なしで bills に含まれない）は除外する。
 * - 同一番号が複数 bill にあっても最初の1件のみ採用する。
 * - 解決後の議案が0件になったグループは結果から除外する（空見出しを出さない）。
 */
export function selectFeaturedBillGroups<T extends { name: string }>(
  groups: readonly FeaturedBillGroupInput[] | undefined,
  bills: readonly T[]
): ResolvedBillGroup<T>[] {
  if (!groups || groups.length === 0) {
    return [];
  }

  const billByNumber = buildBillByNumber(bills);

  return groups.flatMap((group) => {
    const resolved = group.billNumbers.flatMap((number) => {
      const bill = billByNumber.get(number);
      return bill ? [bill] : [];
    });

    if (resolved.length === 0) {
      return [];
    }

    return [
      {
        category: group.category,
        description: group.description,
        bills: resolved,
      },
    ];
  });
}
