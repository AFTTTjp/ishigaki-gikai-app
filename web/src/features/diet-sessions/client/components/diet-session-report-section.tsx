import {
  CalendarClock,
  ChevronRight,
  Info,
  MessagesSquare,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { routes } from "@/lib/routes";
import { SESSION_OVERVIEWS } from "../../shared/data/session-overviews";
import type { DietSession } from "../../shared/types";

type RelatedTopic = {
  slug: string;
  title: string;
};

type Props = {
  session: DietSession | null;
  /** サイト全体の難易度状態（ヘッダーの「説明をもっと詳しく」に連動） */
  currentDifficulty: DifficultyLevelEnum;
  /** 関連 Topic（公開済みのもののみ、サーバー側で解決して渡す） */
  relatedTopics?: RelatedTopic[];
};

export function DietSessionReportSection({
  session,
  currentDifficulty,
  relatedTopics = [],
}: Props) {
  if (!session?.slug) return null;

  const overview = SESSION_OVERVIEWS[session.slug];
  if (!overview) return null;

  const hasReport =
    Boolean(overview.currentStatus) ||
    Boolean(overview.reportEasy) ||
    Boolean(overview.reportDetailed);
  if (!hasReport) return null;

  // ヘッダーの「説明をもっと詳しく」（hard）に連動して本文を切り替える
  const body =
    currentDifficulty === "hard"
      ? (overview.reportDetailed ?? overview.reportEasy)
      : (overview.reportEasy ?? overview.reportDetailed);

  return (
    <section className="bg-white py-8 border-b border-mirai-border">
      <Container>
        <div className="flex flex-col gap-6">
          {/* 見出し */}
          <h2 className="text-base font-bold text-mirai-text">
            今会期で議論されていること
          </h2>

          {/* 現在地の一言 */}
          {overview.currentStatus && (
            <div className="bg-mirai-surface rounded-lg p-4">
              <p className="text-sm font-semibold text-mirai-text leading-relaxed">
                {overview.currentStatus}
              </p>
            </div>
          )}

          {/* 本文（サイト全体の難易度状態に連動） */}
          {body && (
            <p className="text-sm leading-relaxed text-mirai-text-secondary whitespace-pre-line">
              {body}
            </p>
          )}

          {/* 主な論点（市民目線の論点カード・難易度に連動） */}
          {overview.keyPoints && overview.keyPoints.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <MessagesSquare className="h-4 w-4 text-mirai-text-muted shrink-0" />
                <h3 className="text-sm font-semibold text-mirai-text">
                  主な論点
                </h3>
              </div>
              <div className="flex flex-col gap-3">
                {overview.keyPoints.map((keyPoint) => {
                  const description =
                    currentDifficulty === "hard"
                      ? keyPoint.detailedDescription
                      : keyPoint.easyDescription;
                  const keyPointTopics = (
                    keyPoint.relatedTopicSlugs ?? []
                  ).flatMap((slug) => {
                    const topic = relatedTopics.find((t) => t.slug === slug);
                    return topic ? [topic] : [];
                  });
                  return (
                    <div
                      key={keyPoint.title}
                      className="bg-mirai-surface rounded-lg p-4 flex flex-col gap-2"
                    >
                      <h4 className="text-sm font-bold text-mirai-text leading-snug">
                        {keyPoint.title}
                      </h4>
                      <p className="text-xs font-semibold text-mirai-text-secondary leading-relaxed">
                        {keyPoint.oneLine}
                      </p>
                      <p className="text-sm text-mirai-text-secondary leading-relaxed">
                        {description}
                      </p>
                      <p className="text-xs text-mirai-text-secondary leading-relaxed">
                        <span className="font-semibold text-mirai-text">
                          暮らしとの関係：
                        </span>
                        {keyPoint.citizenRelevance}
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-xs text-mirai-text-muted bg-mirai-surface-muted px-1.5 py-0.5 rounded">
                          {keyPoint.committee}
                        </span>
                        {keyPoint.relatedBills.map((bill) => (
                          <span
                            key={bill}
                            className="text-xs text-mirai-text-muted bg-mirai-surface-muted px-1.5 py-0.5 rounded"
                          >
                            {bill}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-mirai-text-muted">
                        {keyPoint.status}
                      </p>
                      {keyPointTopics.map((topic) => (
                        <Link
                          key={topic.slug}
                          href={routes.topicDetail(topic.slug)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-accent transition-colors"
                        >
                          {topic.title}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 初日に起きたこと */}
          {overview.timeline && overview.timeline.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-mirai-text-muted shrink-0" />
                <h3 className="text-sm font-semibold text-mirai-text">
                  初日に起きたこと
                </h3>
              </div>
              <ol className="flex flex-col gap-2">
                {overview.timeline.map((item) => (
                  <li
                    key={item.label}
                    className="bg-mirai-surface rounded-lg p-3 flex flex-col gap-1"
                  >
                    <span className="text-xs font-semibold text-mirai-text">
                      {item.label}
                    </span>
                    <span className="text-xs text-mirai-text-secondary leading-relaxed">
                      {item.detail}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 委員会で審査される議案 */}
          {overview.committees && overview.committees.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-mirai-text-muted shrink-0" />
                <h3 className="text-sm font-semibold text-mirai-text">
                  委員会で審査される議案
                </h3>
              </div>
              <div className="flex flex-col gap-3">
                {overview.committees.map((committee) => (
                  <div
                    key={committee.name}
                    className="bg-mirai-surface rounded-lg p-4 flex flex-col gap-2"
                  >
                    <h4 className="text-sm font-semibold text-mirai-text leading-snug">
                      {committee.name}
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {committee.items.map((item) => (
                        <span
                          key={item}
                          className="text-xs text-mirai-text-muted bg-mirai-surface-muted px-1.5 py-0.5 rounded"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 関連 Topic */}
          {relatedTopics.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-mirai-text">
                関連する Topic
              </h3>
              <ul className="flex flex-col gap-1">
                {relatedTopics.map((topic) => (
                  <li key={topic.slug}>
                    <Link
                      href={routes.topicDetail(topic.slug)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-accent transition-colors"
                    >
                      {topic.title}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 出典・注意書き */}
          {overview.disclaimer && (
            <div className="flex items-start gap-2 border-t border-mirai-border pt-4">
              <Info className="h-3.5 w-3.5 text-mirai-text-muted shrink-0 mt-0.5" />
              <p className="text-xs text-mirai-text-muted leading-relaxed">
                {overview.disclaimer}
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
