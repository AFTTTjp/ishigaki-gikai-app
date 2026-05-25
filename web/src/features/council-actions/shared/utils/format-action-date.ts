/**
 * council_actions.action_date（YYYY-MM-DD 形式の日付文字列）を
 * 日本語の「YYYY年M月D日」形式にフォーマットする。
 *
 * 無効な日付文字列の場合はそのまま返す。
 */
export function formatActionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
