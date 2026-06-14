const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  return `${month}月${day}日（${weekday}）`;
}
