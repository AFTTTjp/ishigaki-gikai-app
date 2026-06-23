import { extractBillTitlePrefix } from "@/features/bills/shared/utils/bill-title";

/**
 * トップページ「今会期の注目議案」に出す議案を、議案番号で抽出する純粋関数。
 *
 * - `billNumbers`（例「議案第45号」）と `bills[].name` 先頭の議案番号接頭辞を
 *   完全一致で対応付ける（extractBillTitlePrefix を使用。fuzzy マッチはしない）。
 * - 並びは `billNumbers` の記述順を維持する。
 * - 一致しない番号は無視する（DBに無い／本文未投入で渡ってこない場合も安全）。
 * - 同一番号が複数 bill にあっても最初の1件のみ採用する。
 */
export function selectFeaturedBills<T extends { name: string }>(
  billNumbers: readonly string[] | undefined,
  bills: readonly T[]
): T[] {
  if (!billNumbers || billNumbers.length === 0) {
    return [];
  }

  const billByNumber = new Map<string, T>();
  for (const bill of bills) {
    const number = extractBillTitlePrefix(bill.name);
    if (number && !billByNumber.has(number)) {
      billByNumber.set(number, bill);
    }
  }

  return billNumbers.flatMap((number) => {
    const bill = billByNumber.get(number);
    return bill ? [bill] : [];
  });
}
