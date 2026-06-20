const BILL_TITLE_PREFIX_PATTERN = /^(?:議員提出議案第\d+号|議案第\d+号)\s*/;
const BILL_TITLE_SUFFIX_PATTERN = /\s*（第\d+号）\s*$/;

/** 先頭の議案番号接頭辞を抽出する（capture 版） */
const BILL_NUMBER_PREFIX_PATTERN = /^(議員提出議案第\d+号|議案第\d+号)/;

/**
 * 議案名の先頭から議案番号接頭辞（「議案第42号」「議員提出議案第1号」）を
 * 厳密に抽出する純粋関数。接頭辞が無ければ null。
 * 委員会セクションの番号文字列との完全一致用（fuzzy matching はしない）。
 */
export function extractBillTitlePrefix(
  name: string | null | undefined
): string | null {
  if (!name) {
    return null;
  }
  const match = name.trim().match(BILL_NUMBER_PREFIX_PATTERN);
  return match ? match[1] : null;
}

export function stripBillTitlePrefix(
  title: string | null | undefined
): string | null {
  if (!title) {
    return null;
  }

  const normalizedTitle = title
    .trim()
    .replace(BILL_TITLE_PREFIX_PATTERN, "")
    .replace(BILL_TITLE_SUFFIX_PATTERN, "")
    .trim();
  return normalizedTitle.length > 0 ? normalizedTitle : title.trim();
}

export function getBillDisplayTitle(bill: {
  name: string;
  bill_content?: {
    title: string | null;
  } | null;
}): string {
  return (
    stripBillTitlePrefix(bill.bill_content?.title) ??
    stripBillTitlePrefix(bill.name) ??
    bill.name
  );
}
