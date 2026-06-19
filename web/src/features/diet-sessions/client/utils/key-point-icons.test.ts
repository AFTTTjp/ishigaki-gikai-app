import { Baby, MessagesSquare, Ship } from "lucide-react";
import { describe, expect, it } from "vitest";
import { DEFAULT_KEY_POINT_ICON, resolveKeyPointIcon } from "./key-point-icons";

describe("resolveKeyPointIcon", () => {
  it("許可リストの iconName を対応する lucide アイコンに解決する", () => {
    expect(resolveKeyPointIcon("Ship")).toBe(Ship);
    expect(resolveKeyPointIcon("Baby")).toBe(Baby);
  });

  it("未指定（undefined）のときは既定アイコンを返す", () => {
    expect(resolveKeyPointIcon(undefined)).toBe(DEFAULT_KEY_POINT_ICON);
    expect(resolveKeyPointIcon(undefined)).toBe(MessagesSquare);
  });

  it("許可リスト外の文字列は既定アイコンにフォールバックする", () => {
    // 型安全を破って未知の値が来ても落ちないことを確認する
    expect(
      resolveKeyPointIcon(
        "Unknown" as Parameters<typeof resolveKeyPointIcon>[0]
      )
    ).toBe(DEFAULT_KEY_POINT_ICON);
  });
});
