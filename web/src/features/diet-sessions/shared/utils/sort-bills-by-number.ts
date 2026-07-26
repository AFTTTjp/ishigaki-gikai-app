type NumberedBill = {
  name: string;
};

const BILL_NUMBER_PATTERN = /第(\d+)号/;
const japaneseCollator = new Intl.Collator("ja");

function getBillNumber(name: string): number | null {
  const match = name.match(BILL_NUMBER_PATTERN);
  return match ? Number(match[1]) : null;
}

/**
 * 議案名に含まれる「第N号」を基準に並べ、番号がない資料は末尾へ送る。
 */
export function sortBillsByNumber<T extends NumberedBill>(bills: T[]): T[] {
  return bills.toSorted((left, right) => {
    const leftNumber = getBillNumber(left.name);
    const rightNumber = getBillNumber(right.name);

    if (leftNumber !== null && rightNumber !== null) {
      return (
        leftNumber - rightNumber ||
        japaneseCollator.compare(left.name, right.name)
      );
    }

    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;

    return japaneseCollator.compare(left.name, right.name);
  });
}
