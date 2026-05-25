import { describe, expect, it } from "vitest";
import {
  COUNCIL_ACTION_KIND_LABELS,
  getCouncilActionKindLabel,
} from "./council-action-kind-labels";

describe("COUNCIL_ACTION_KIND_LABELS", () => {
  it("すべての kind に日本語ラベルが定義されている", () => {
    expect(COUNCIL_ACTION_KIND_LABELS.advocacy).toBe("要請活動");
    expect(COUNCIL_ACTION_KIND_LABELS.request).toBe("申し入れ");
    expect(COUNCIL_ACTION_KIND_LABELS.inspection).toBe("現地視察");
    expect(COUNCIL_ACTION_KIND_LABELS.submission).toBe("意見書提出");
    expect(COUNCIL_ACTION_KIND_LABELS.resolution_delivery).toBe("抗議決議送付");
  });
});

describe("getCouncilActionKindLabel", () => {
  it("既知の kind に対して日本語ラベルを返す", () => {
    expect(getCouncilActionKindLabel("advocacy")).toBe("要請活動");
    expect(getCouncilActionKindLabel("request")).toBe("申し入れ");
    expect(getCouncilActionKindLabel("inspection")).toBe("現地視察");
    expect(getCouncilActionKindLabel("submission")).toBe("意見書提出");
    expect(getCouncilActionKindLabel("resolution_delivery")).toBe(
      "抗議決議送付"
    );
  });

  it("未知の kind はそのまま返す（フォールバック）", () => {
    expect(getCouncilActionKindLabel("unknown_kind")).toBe("unknown_kind");
    expect(getCouncilActionKindLabel("")).toBe("");
  });
});
