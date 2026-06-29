import { Calendar, ExternalLink } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { routes } from "@/lib/routes";
import { SESSION_OVERVIEWS } from "../../shared/data/session-overviews";
import type { DietSession } from "../../shared/types";

type Props = {
  session: DietSession | null;
  /**
   * true のとき全カテゴリを表示。
   * false（デフォルト）のとき overview.topPageCount 件に絞る。
   */
  showAll?: boolean;
  /**
   * 議案番号（「議案第45号」等）→ 議案id の対応表。
   * 渡された番号は議案詳細へのリンクに、無い番号は従来どおりバッジ表示にする。
   * 省略時は全番号がバッジ表示（後方互換）。
   */
  billIdByNumber?: Record<string, string>;
};

export function DietSessionOverviewSection({
  session,
  showAll = false,
  billIdByNumber,
}: Props) {
  if (!session?.slug) return null;

  const overview = SESSION_OVERVIEWS[session.slug];
  if (!overview) return null;

  const categoryLimit =
    !showAll && overview.topPageCount !== undefined
      ? overview.topPageCount
      : undefined;
  const displayedCategories = categoryLimit
    ? overview.categories.slice(0, categoryLimit)
    : overview.categories;
  const hasMore =
    categoryLimit !== undefined && overview.categories.length > categoryLimit;

  return (
    <section className="bg-white py-8 border-b border-mirai-border">
      <Container>
        <div className="flex flex-col gap-6">
          {/* ヘッダー */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-bold text-mirai-text">
              {showAll ? "テーマ別に詳しく見る" : "今会期の議案テーマ一覧"}
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

          {/*
            概要文は会期ページ（showAll）のみ表示。
            トップは「現在地の一言（論点セクション）＋論点カード」で伝えるため、
            重い概要文と現在地の一言はここでは出さない（二重表示の防止）。
          */}
          {showAll && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-mirai-text-secondary leading-relaxed">
                ここからは、提出議案や請願をテーマごとに見ていけます。気になる分野から、内容や関連する議案の詳細をたどれます。
              </p>
              <details className="rounded-lg border border-mirai-border bg-mirai-surface px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-mirai-text marker:hidden">
                  会期全体の詳しい説明を読む
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-mirai-text-secondary whitespace-pre-line">
                  {overview.summary}
                </p>
              </details>
            </div>
          )}

          {/* トップでは会期全体の索引としての位置づけを一言で示す */}
          {!showAll && (
            <p className="text-xs text-mirai-text-secondary leading-relaxed">
              この会期で話し合われる議案を、テーマごとに一覧で確認できます。公開済みの議案番号から詳細を開けます。
            </p>
          )}

          {/* カテゴリグリッド */}
          <div className="flex flex-col gap-3">
            {displayedCategories.map((category) => (
              <div
                key={category.title}
                className="bg-mirai-surface rounded-lg p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-mirai-text leading-snug">
                    {category.title}
                  </h3>
                  <div className="flex flex-wrap justify-end gap-1 shrink-0">
                    {category.billNumbers.map((num) => {
                      const billId = billIdByNumber?.[num];
                      const badgeClass =
                        "text-xs text-mirai-text-muted bg-mirai-surface-muted px-1.5 py-0.5 rounded";
                      // 公開済み＋本文ありの議案だけ詳細へリンク。
                      // 未公開・本文なし（id 未解決）は従来どおりバッジ表示。
                      if (billId) {
                        return (
                          <Link
                            key={num}
                            href={routes.billDetail(billId) as Route}
                            className={`${badgeClass} hover:text-mirai-text hover:bg-mirai-surface transition-colors`}
                          >
                            {num}
                          </Link>
                        );
                      }
                      return (
                        <span key={num} className={badgeClass}>
                          {num}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <p className="text-xs text-mirai-text-secondary leading-relaxed">
                  {category.description}
                </p>
              </div>
            ))}
          </div>

          {/* 件数制限時：全件リンク */}
          {hasMore && (
            <div className="text-center">
              <Link
                href={routes.kokkaiSessionBills(session.slug)}
                className="text-sm text-primary hover:text-primary-accent transition-colors"
              >
                他 {overview.categories.length - (categoryLimit ?? 0)}{" "}
                件のテーマを見る →
              </Link>
            </div>
          )}

          {/* スケジュール + 議案一覧・一般質問リンク */}
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
            <div className="flex flex-col items-start gap-2 shrink-0 sm:items-end">
              {showAll && (
                <p className="max-w-xs text-xs text-mirai-text-secondary leading-relaxed sm:text-right">
                  議案だけでなく、議員ごとの一般質問からも、この会期で話し合われたテーマを確認できます。
                </p>
              )}
              <Link
                href={routes.kokkaiSessionBills(session.slug)}
                className="text-sm font-medium text-primary hover:text-primary-accent transition-colors"
              >
                議案一覧を見る →
              </Link>
              <Link
                href={
                  showAll
                    ? routes.generalQuestionsSession(session.slug)
                    : routes.generalQuestions()
                }
                className="text-sm font-medium text-primary hover:text-primary-accent transition-colors"
              >
                {showAll ? "この会期の一般質問を見る →" : "一般質問を見る →"}
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
