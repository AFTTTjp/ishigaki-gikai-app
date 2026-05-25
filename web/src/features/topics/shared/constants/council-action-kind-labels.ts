/**
 * council_actions.kind の表示ラベル定義。
 * badge・filter・search・一覧ページなど複数箇所で再利用する。
 */
export const COUNCIL_ACTION_KIND_LABELS = {
  advocacy: "要請活動",
  request: "申し入れ",
  inspection: "現地視察",
  submission: "意見書提出",
  resolution_delivery: "抗議決議送付",
} as const satisfies Record<string, string>;

export type CouncilActionKind = keyof typeof COUNCIL_ACTION_KIND_LABELS;

export function getCouncilActionKindLabel(kind: string): string {
  if (kind in COUNCIL_ACTION_KIND_LABELS) {
    return COUNCIL_ACTION_KIND_LABELS[kind as CouncilActionKind];
  }
  return kind;
}
