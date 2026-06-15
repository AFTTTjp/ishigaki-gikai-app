import type { BillStatusEnum, HouseEnum } from "../types";

// ステップ番号マッピング
const STATUS_TO_STEP: Record<BillStatusEnum, number> = {
  preparing: 0,
  introduced: 1,
  in_originating_house: 2,
  in_receiving_house: 2,
  enacted: 3,
  rejected: 3,
} as const;

// プログレス比率
const PROGRESS_RATIOS = [0, 1 / 6, 1 / 2, 1] as const;

/**
 * ステータスとステータスノートからメッセージを生成する
 */
export function getStatusMessage(
  status: BillStatusEnum,
  statusNote: string | null | undefined
): string {
  if (status === "preparing") return "議案提出前";
  return statusNote || "";
}

/**
 * ステップ番号と現在のステップからステップの状態を判定する
 */
export function getStepState(
  stepNumber: number,
  currentStep: number,
  isPreparing: boolean
): "active" | "inactive" {
  if (isPreparing) return "inactive";
  return stepNumber <= currentStep ? "active" : "inactive";
}

/**
 * 発議院に応じてステップ順序を調整する
 */
export function getOrderedSteps(
  // biome-ignore lint/correctness/noUnusedFunctionParameters: 上流国会版の発議院別ステップ順序対応のためのプレースホルダ。石垣市議会向け表示では順序を変えない
  originatingHouse: HouseEnum,
  baseSteps: readonly { readonly label: string }[]
): { label: string }[] {
  return baseSteps.map((s) => ({ label: s.label }));
}

/**
 * 現在のステップからプログレスバーの幅(%)を計算する
 */
export function calculateProgressWidth(currentStep: number): number {
  const ratio = PROGRESS_RATIOS[currentStep] ?? 0;
  return ratio * 100;
}

/**
 * ステータスからステップ番号を取得する
 */
export function getCurrentStep(status: BillStatusEnum): number {
  return STATUS_TO_STEP[status] ?? 0;
}
