import type { Route } from "next";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { BillCard } from "@/features/bills/client/components/bill-list/bill-card";
import type { BillWithContent } from "@/features/bills/shared/types";
import type { ResolvedBillGroup } from "@/features/diet-sessions/shared/utils/select-featured-bills";
import { routes } from "@/lib/routes";

type Props = {
  /** 番号一致で解決済みの分野グループ（空グループは事前に除外済み） */
  groups: ResolvedBillGroup<BillWithContent>[];
};

/**
 * トップページ「分野別に見る 今会期の議案」セクション。
 * 現会期の議案を暮らしの分野ごとにまとめ、既存の BillCard で表示して
 * 議案詳細（/bills/:id）へリンクする。
 * 表示できるグループが無ければ何も表示しない（追加のみ・既存構成は不変）。
 */
export function DietSessionBillGroupsSection({ groups }: Props) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-8 border-b border-mirai-border">
      <Container>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-mirai-text">
              分野別に見る 今会期の議案
            </h2>
            <p className="text-xs text-mirai-text-secondary leading-relaxed">
              いま議会で審議されている議案を、暮らしの分野ごとに紹介します。
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.category} className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-sm font-semibold text-mirai-text leading-snug">
                    {group.category}
                  </h3>
                  {group.description && (
                    <p className="text-xs text-mirai-text-secondary leading-relaxed">
                      {group.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  {group.bills.map((bill) => (
                    <Link
                      key={bill.id}
                      href={routes.billDetail(bill.id) as Route}
                    >
                      <BillCard bill={bill} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
