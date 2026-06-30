import { ExternalLink } from "lucide-react";
import type { BillWithContent } from "@/features/bills/shared/types";
import type { DietSession } from "../../shared/types";
import { BillListWithStatusFilter } from "./bill-list-with-status-filter";

type Props = {
  session: DietSession;
  bills: BillWithContent[];
};

export function DietSessionBillList({ session, bills }: Props) {
  const startDate = new Date(session.start_date);
  const endDate = new Date(session.end_date);
  const sessionDescription = `${startDate.getFullYear()}.${startDate.getMonth() + 1}月〜${endDate.getMonth() + 1}月に実施された${session.name}`;

  return (
    <div className="flex flex-col gap-8">
      {/* セクション導入 */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold text-primary-accent">この会期の議案</p>
        <p className="text-sm leading-7 text-mirai-text-muted">
          この会期に提出・審議された議案を一覧できます。気になる議案から詳しい内容を確認できます。
        </p>
      </div>

      {/* セクションヘッダー */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[22px] font-bold text-black leading-[1.48] flex items-center gap-4">
          <span>
            {startDate.getFullYear()}年 {session.name}の提出議案
          </span>
          <span className="shrink-0">{bills.length}件</span>
        </h2>
        <p className="text-xs font-medium text-mirai-text">
          {sessionDescription}
        </p>
      </div>

      {/* フィルター付き議案リスト */}
      {bills.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">
          この会期の議案はまだありません
        </p>
      ) : (
        <BillListWithStatusFilter bills={bills} />
      )}

      {/* 石垣市議会リンク */}
      {session.shugiin_url && (
        <div className="flex items-center gap-1 text-[13px] font-medium text-mirai-text">
          {startDate.getFullYear()}年{session.name}に提出された全ての議案は
          <a
            href={session.shugiin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
          >
            議会議案情報へ
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
