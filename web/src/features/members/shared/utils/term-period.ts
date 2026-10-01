const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value: string): void {
  const parsed = new Date(`${value}T00:00:00Z`);
  const isRealDate =
    ISO_DATE_PATTERN.test(value) &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().startsWith(value);
  if (!isRealDate) {
    throw new Error(`日付は YYYY-MM-DD 形式で指定してください: ${value}`);
  }
}

/**
 * 指定日が期間内かを判定する（開始日・終了日を含む）。
 * 日付は DB の date 型と同じ YYYY-MM-DD 文字列で扱い、タイムゾーンの影響を受けない。
 * end が null の場合は終了日なし（継続中）として扱う。
 */
export function isDateInPeriod(
  date: string,
  start: string,
  end: string | null
): boolean {
  assertIsoDate(date);
  assertIsoDate(start);
  if (end !== null) assertIsoDate(end);

  return date >= start && (end === null || date <= end);
}

/** 議会任期（council_terms）の期間内か */
export function isDateInCouncilTerm(
  date: string,
  term: { start_date: string; end_date: string }
): boolean {
  return isDateInPeriod(date, term.start_date, term.end_date);
}

/** 所属（member_affiliations）が指定日に有効か */
export function isAffiliationActiveOn(
  date: string,
  affiliation: { valid_from: string; valid_to: string | null }
): boolean {
  return isDateInPeriod(date, affiliation.valid_from, affiliation.valid_to);
}
