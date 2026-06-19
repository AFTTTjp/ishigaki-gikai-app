/**
 * 論点カード見出しに使えるアイコン名の許可リスト（controlled）。
 * lucide-react のコンポーネントへの解決は client/utils/key-point-icons.ts で行う。
 * ここは lucide に依存しない純粋な定義のみ（shared 層）。
 */
export const KEY_POINT_ICON_NAMES = [
  "Plane",
  "Building2",
  "Baby",
  "Trophy",
  "Ship",
  "Waves",
  "Scale",
] as const;

export type KeyPointIconName = (typeof KEY_POINT_ICON_NAMES)[number];
