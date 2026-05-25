import { Container } from "@/components/layouts/container";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { InterviewLandingSection } from "@/features/interview-config/client/components/interview-landing-section";
import { getInterviewConfig } from "@/features/interview-config/server/loaders/get-interview-config";
import { BillInterviewOpinionsSection } from "@/features/interview-report/server/components/bill-interview-opinions-section";
import { getPublicReportsByBillId } from "@/features/interview-report/server/loaders/get-public-reports-by-bill-id";
import { BillDetailClient } from "../../../client/components/bill-detail/bill-detail-client";
import { BillDisclaimer } from "../../../client/components/bill-detail/bill-disclaimer";
import { BillStatusProgress } from "../../../client/components/bill-detail/bill-status-progress";
import { MiraiStanceCard } from "../../../client/components/bill-detail/mirai-stance-card";
import {
  DOCUMENT_TYPE_LABELS,
  getBillStatusLabel,
  type BillWithContent,
} from "../../../shared/types";
import { BillShareButtons } from "../share/bill-share-buttons";
import { BillCouncilActions } from "./bill-council-actions";
import { BillVoteSection } from "./bill-vote-section";
import { BillContent } from "./bill-content";
import { BillDetailHeader } from "./bill-detail-header";

interface BillDetailLayoutProps {
  bill: BillWithContent;
  currentDifficulty: DifficultyLevelEnum;
}

export async function BillDetailLayout({
  bill,
  currentDifficulty,
}: BillDetailLayoutProps) {
  const showMiraiStance = bill.status === "preparing" || bill.mirai_stance;
  const showBillStatusProgress = bill.document_type === "bill";
  const statusLabel = getBillStatusLabel(
    bill.status,
    bill.originating_house,
    bill.document_type
  );
  const [interviewConfigResult, publicReportsResultSettled] =
    await Promise.allSettled([
      getInterviewConfig(bill.id),
      getPublicReportsByBillId(bill.id),
    ]);

  const interviewConfig =
    interviewConfigResult.status === "fulfilled"
      ? interviewConfigResult.value
      : null;

  const publicReportsResult =
    publicReportsResultSettled.status === "fulfilled"
      ? publicReportsResultSettled.value
      : { reports: [], totalCount: 0 };

  if (interviewConfigResult.status === "rejected") {
    console.error(
      "Failed to load interview config on bill detail:",
      interviewConfigResult.reason
    );
  }

  if (publicReportsResultSettled.status === "rejected") {
    console.error(
      "Failed to load public reports on bill detail:",
      publicReportsResultSettled.reason
    );
  }

  return (
    <div className="container mx-auto pb-8 max-w-4xl">
      {/*
        テキスト選択機能とチャット連携の実装パターン:
        - BillContentはServer Componentのまま保持（SSRによる高速な初期レンダリング）
        - BillDetailClientでクライアントサイド機能（テキスト選択、チャット連携）を提供
        - このパターンによりSSRを保持しつつインタラクティブ機能を実装
      */}
      <BillDetailClient
        bill={bill}
        currentDifficulty={currentDifficulty}
        hasInterviewConfig={interviewConfig != null}
      >
        <BillDetailHeader
          bill={bill}
          hasInterviewConfig={interviewConfig != null}
          opinionCount={publicReportsResult.totalCount}
        />
        <Container>
          {/* 種別に応じたステータス表示 */}
          <div className="my-8">
            {showBillStatusProgress ? (
              <BillStatusProgress
                documentType={bill.document_type}
                status={bill.status}
                originatingHouse={bill.originating_house}
                statusNote={bill.status_note}
              />
            ) : (
              <>
                <h2 className="text-[22px] font-bold mb-4">👉 ステータス</h2>
                <div className="bg-white rounded-lg border p-6">
                  <div className="flex flex-col gap-3">
                    <div className="text-sm font-medium text-gray-500">
                      {DOCUMENT_TYPE_LABELS[bill.document_type]}
                    </div>
                    <div className="text-lg font-bold text-black">
                      {statusLabel}
                    </div>
                    {bill.status_note ? (
                      <p className="text-sm leading-7 text-gray-700 whitespace-pre-wrap">
                        {bill.status_note}
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </div>

          <BillContent bill={bill} />
          <BillVoteSection bill={bill} />
        </Container>
      </BillDetailClient>

      <Container>
        {/* 議会のアクション（投票結果の後） */}
        {bill.councilActions && bill.councilActions.length > 0 && (
          <div className="my-8">
            <BillCouncilActions councilActions={bill.councilActions} />
          </div>
        )}
        {publicReportsResult.totalCount > 0 && (
          <div className="my-8">
            <BillInterviewOpinionsSection
              billId={bill.id}
              reports={publicReportsResult.reports}
              totalCount={publicReportsResult.totalCount}
            />
          </div>
        )}
        {interviewConfig != null && (
          <div className="my-8">
            <InterviewLandingSection billId={bill.id} />
          </div>
        )}
        {showMiraiStance && (
          <div className="my-8">
            <MiraiStanceCard
              stance={bill.mirai_stance}
              billStatus={bill.status}
            />
          </div>
        )}
        {/* シェアボタン */}
        <div className="my-8">
          <BillShareButtons bill={bill} />
        </div>

        {/* データの出典と免責事項 */}
        <div className="my-8">
          <BillDisclaimer />
        </div>
      </Container>
    </div>
  );
}
