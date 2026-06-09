import { Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { routes } from "@/lib/routes";
import { SESSION_OVERVIEWS } from "../../shared/data/session-overviews";
import type { DietSession } from "../../shared/types";

type Props = {
  session: DietSession | null;
};

export function DietSessionOverviewSection({ session }: Props) {
  if (!session?.slug) return null;

  const overview = SESSION_OVERVIEWS[session.slug];
  if (!overview) return null;

  return (
    <section className="bg-white py-8 border-b border-mirai-border">
      <Container>
        <div className="flex flex-col gap-6">
          {/* ヘッダー */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-bold text-mirai-text">
              今会期のテーマ
            </h2>
            <a
              href={overview.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-mirai-text-muted hover:text-mirai-text transition-colors shrink-0"
            >
              公式ページ
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* 概要文 */}
          <p className="text-sm leading-relaxed text-mirai-text-secondary whitespace-pre-line">
            {overview.summary}
          </p>

          {/* カテゴリグリッド */}
          <div className="grid grid-cols-1 sm:grid-cols-2 pc:grid-cols-3 gap-3">
            {overview.categories.map((category) => (
              <div
                key={category.title}
                className="bg-mirai-surface rounded-lg p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-mirai-text leading-snug">
                    {category.title}
                  </h3>
                  <div className="flex flex-wrap justify-end gap-1 shrink-0">
                    {category.billNumbers.map((num) => (
                      <span
                        key={num}
                        className="text-xs text-mirai-text-muted bg-mirai-surface-muted px-1.5 py-0.5 rounded"
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-mirai-text-secondary leading-relaxed">
                  {category.description}
                </p>
              </div>
            ))}
          </div>

          {/* スケジュール + 議案一覧リンク */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-mirai-border pt-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-mirai-text-muted shrink-0" />
                <h3 className="text-sm font-semibold text-mirai-text">
                  会期スケジュール
                </h3>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {overview.schedule.map((item) => (
                  <div key={item.label} className="flex items-baseline gap-1.5">
                    <span className="text-xs text-mirai-text-muted">
                      {item.label}
                    </span>
                    <span className="text-sm font-medium text-mirai-text">
                      {item.dates}
                    </span>
                    {item.note && (
                      <span className="text-xs text-mirai-text-muted">
                        （{item.note}）
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <Link
              href={routes.kokkaiSessionBills(session.slug)}
              className="text-sm font-medium text-primary hover:text-primary-accent transition-colors shrink-0"
            >
              議案一覧を見る →
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
