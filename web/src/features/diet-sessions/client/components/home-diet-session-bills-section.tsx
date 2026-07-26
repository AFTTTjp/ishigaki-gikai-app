import { ArrowRight, CalendarDays } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { BillCard } from "@/features/bills/client/components/bill-list/bill-card";
import type { BillWithContent } from "@/features/bills/shared/types";
import { routes } from "@/lib/routes";
import { formatDateWithDots } from "@/lib/utils/date";
import type { DietSession } from "../../shared/types";

type Props = {
  session: DietSession | null;
  bills: BillWithContent[];
  closed: boolean;
};

export function HomeDietSessionBillsSection({ session, bills, closed }: Props) {
  if (!session?.slug) return null;

  return (
    <section className="border-b border-mirai-border bg-white py-10">
      <Container>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-bold text-primary-accent">
                今会期の議案
              </p>
              <span className="rounded-full bg-mirai-surface-muted px-3 py-1 text-xs font-semibold text-mirai-text-secondary">
                {closed ? "閉会" : "開催中"}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="text-2xl font-bold leading-tight text-mirai-text">
                  {session.name}
                </h2>
                <span className="text-sm font-semibold text-mirai-text-secondary">
                  公開中 {bills.length}件
                </span>
              </div>
              <p className="flex items-center gap-2 text-sm text-mirai-text-muted">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {formatDateWithDots(session.start_date)}〜
                {formatDateWithDots(session.end_date)}
              </p>
            </div>
          </div>

          {bills.length === 0 ? (
            <p className="rounded-2xl bg-mirai-surface-muted px-6 py-10 text-center text-sm text-mirai-text-muted">
              公開中の議案はまだありません
            </p>
          ) : (
            <div
              className="flex flex-col gap-4"
              data-testid="current-session-bill-list"
            >
              {bills.map((bill) => (
                <Link
                  key={bill.id}
                  href={routes.billDetail(bill.id) as Route}
                  className="block"
                >
                  <BillCard bill={bill} />
                </Link>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-mirai-border pt-6 sm:flex-row sm:items-center">
            <Link
              href={routes.kokkaiSessionBills(session.slug)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-accent"
            >
              今会期の詳細を見る
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={routes.generalQuestionsSession(session.slug)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-accent sm:ml-auto"
            >
              一般質問を見る
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
