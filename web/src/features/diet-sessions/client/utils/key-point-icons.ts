import {
  Baby,
  Building2,
  type LucideIcon,
  MessagesSquare,
  Plane,
  Scale,
  Ship,
  Trophy,
  Waves,
} from "lucide-react";
import type { KeyPointIconName } from "../../shared/utils/key-point-icon-names";

/** 論点カードの既定アイコン（iconName 未指定・未知のとき） */
export const DEFAULT_KEY_POINT_ICON: LucideIcon = MessagesSquare;

/**
 * iconName → lucide コンポーネントの controlled map。
 * 動的 import はしない（許可リストの静的 import のみ）。
 */
const KEY_POINT_ICON_MAP: Record<KeyPointIconName, LucideIcon> = {
  Plane,
  Building2,
  Baby,
  Trophy,
  Ship,
  Waves,
  Scale,
};

/**
 * iconName から lucide アイコンを解決する。
 * 未指定・許可リスト外は既定アイコンにフォールバックする。
 */
export function resolveKeyPointIcon(
  iconName: KeyPointIconName | undefined
): LucideIcon {
  if (!iconName) {
    return DEFAULT_KEY_POINT_ICON;
  }
  return KEY_POINT_ICON_MAP[iconName] ?? DEFAULT_KEY_POINT_ICON;
}
