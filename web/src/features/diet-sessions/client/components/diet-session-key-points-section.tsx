import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { routes } from "@/lib/routes";
import { SESSION_OVERVIEWS } from "../../shared/data/session-overviews";
import type { DietSession } from "../../shared/types";

type Props = {
  session: DietSession | null;
};

/**
 * トップページ向けの軽量な論点カードセクション。
 * oneLine と status を中心に topPageKeyPointCount 件だけ表示し、
 * 詳細は会期ページ（議案一覧）へ誘導する。
 */
export function DietSessionKeyPointsSection({ session }: Props) {
  if (!session?.slug) return null;

  const overview = SESSION_OVERVIEWS[session.slug];
  if (!overview?.keyPoints || overview.keyPoints.length === 0) return null;

  const limit = overview.topPageKeyPointCount ?? overview.keyPoints.length;
  const displayed = overview.keyPoints.slice(0, limit);
  const hasMore = overview.keyPoints.length > displayed.length;

  return (
    <section className="bg-white py-8 border-b border-mirai-border">
      <Container>
        <div className="flex flex-col gap-6">
          <h2 className="text-base font-bold text-mirai-text">
            今会期で議論されていること
          </h2>

          <div className="flex flex-col gap-3">
            {displayed.map((keyPoint) => (
              <div
                key={keyPoint.title}
                className="bg-mirai-surface rounded-lg p-4 flex flex-col gap-2"
              >
                <h3 className="text-sm font-bold text-mirai-text leading-snug">
                  {keyPoint.title}
                </h3>
                <p className="text-xs text-mirai-text-secondary leading-relaxed">
                  {keyPoint.oneLine}
                </p>
                <p className="text-xs text-mirai-text-muted">
                  {keyPoint.status}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href={routes.kokkaiSessionBills(session.slug)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-accent transition-colors"
            >
              {hasMore ? "他の論点を見る" : "今会期の議案・論点を見る"}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
