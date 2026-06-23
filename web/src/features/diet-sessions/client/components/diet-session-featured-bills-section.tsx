import type { Route } from "next";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { BillCard } from "@/features/bills/client/components/bill-list/bill-card";
import type { BillWithContent } from "@/features/bills/shared/types";
import { routes } from "@/lib/routes";

type Props = {
  /** 注目議案（番号一致で解決済み・published＋本文ありのみ） */
  bills: BillWithContent[];
};

/**
 * トップページ「今会期の注目議案」セクション。
 * 現会期の議案から featuredBillNumbers で抽出した議案を、
 * 既存の BillCard で表示し、議案詳細（/bills/:id）へリンクする。
 * 対象が無ければ何も表示しない（追加のみ・既存構成は不変）。
 */
export function DietSessionFeaturedBillsSection({ bills }: Props) {
  if (bills.length === 0) {
    return null;
  }

  return (
    <section className="bg-white py-8 border-b border-mirai-border">
      <Container>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-mirai-text">
              今会期の注目議案
            </h2>
            <p className="text-xs text-mirai-text-secondary leading-relaxed">
              今、議会で実際に議論されている議案をピックアップしています。
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {bills.map((bill) => (
              <Link key={bill.id} href={routes.billDetail(bill.id) as Route}>
                <BillCard bill={bill} />
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
