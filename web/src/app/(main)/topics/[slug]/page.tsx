import { ArrowLeft } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layouts/container";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { PageChatClient } from "@/features/chat/client/components/page-chat-client";
import { TopicContent } from "@/features/topics/server/components/topic-content";
import { TopicCouncilActions } from "@/features/topics/server/components/topic-council-actions";
import { TopicDecisions } from "@/features/topics/server/components/topic-decisions";
import { TopicDiscussionPoints } from "@/features/topics/server/components/topic-discussion-points";
import { TopicRelatedBills } from "@/features/topics/server/components/topic-related-bills";
import { TopicRelatedGeneralQuestions } from "@/features/topics/server/components/topic-related-general-questions";
import { TopicRelatedLinks } from "@/features/topics/server/components/topic-related-links";
import { TopicStatusCard } from "@/features/topics/server/components/topic-status-card";
import { TopicTimeline } from "@/features/topics/server/components/topic-timeline";
import { TopicTimelineReview } from "@/features/topics/server/components/topic-timeline-review";
import { getTopicBySlug } from "@/features/topics/server/loaders/get-topic-by-slug";
import { getTopicTimelineReview } from "@/features/topics/server/loaders/get-topic-timeline-review";
import { routes } from "@/lib/routes";

interface TopicDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: TopicDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);

  if (!topic) {
    return {
      title: "Topic が見つかりません",
    };
  }

  return {
    title: `${topic.title} | Topics | みらい議会@石垣市`,
    description: topic.description,
  };
}

export default async function TopicDetailPage({
  params,
}: TopicDetailPageProps) {
  const { slug } = await params;
  const [topic, currentDifficulty, timelineReview] = await Promise.all([
    getTopicBySlug(slug),
    getDifficultyLevel(),
    getTopicTimelineReview(slug),
  ]);

  if (!topic) {
    notFound();
  }

  const displayContent =
    currentDifficulty === "hard" && topic.content_hard
      ? topic.content_hard
      : topic.content;

  return (
    <div className="pb-32 md:pb-8">
      {/* ① ヘッダー（概要・白帯は全幅、本文は議案詳細と同じ Container 幅） */}
      <div className="mb-8 rounded-b-4xl bg-white">
        <Container className="space-y-4 pb-8 pt-4">
          <Link
            href={routes.topics() as Route}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-opacity hover:opacity-70"
          >
            <ArrowLeft className="h-4 w-4" />
            Topics 一覧に戻る
          </Link>

          <div className="space-y-4">
            <span className="inline-flex rounded-full bg-stance-for-badge-end px-3 py-1 text-xs font-bold tracking-[0.08em] text-primary-accent">
              TOPIC
            </span>
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-slate-900">
                {topic.title}
              </h1>
              <p className="leading-relaxed text-slate-700">
                {topic.description}
              </p>
            </div>
          </div>
        </Container>
      </div>

      <Container className="flex flex-col gap-8">
        {/* ② 現在の状況 */}
        <TopicStatusCard
          label={topic.current_status_label}
          note={topic.current_status_note}
          updatedAt={topic.current_status_updated_at}
        />

        {/* ③ 決定事項 */}
        <TopicDecisions updates={topic.updates} />

        {/* ④ 議会での主な論点 */}
        <TopicDiscussionPoints updates={topic.updates} />

        {/* ⑤ この話題の流れ */}
        {timelineReview ? (
          <TopicTimelineReview timelineReview={timelineReview} />
        ) : null}

        {/* ⑥ これまでの流れ */}
        <TopicTimeline updates={topic.updates} />

        {/* ⑦ 現時点の整理 */}
        {displayContent ? (
          <section className="space-y-4">
            <h2 className="text-[22px] font-bold text-slate-900">
              現時点の整理
            </h2>
            <TopicContent content={displayContent} />
          </section>
        ) : null}

        {/* ⑧ 議会のアクション */}
        <TopicCouncilActions councilActions={topic.councilActions} />

        {/* ⑨ 関連議案一覧 */}
        <TopicRelatedBills bills={topic.relatedBills} />

        {/* ⑩ 関連する一般質問 */}
        <TopicRelatedGeneralQuestions
          questions={topic.relatedGeneralQuestions}
        />

        {/* ⑪ 関連情報・資料 */}
        <TopicRelatedLinks updates={topic.updates} />
      </Container>

      {/* ⑫ AI 導線（議案詳細ページと同じ。PC は右下に補助表示、モバイルは下部導線） */}
      <PageChatClient
        currentDifficulty={currentDifficulty}
        items={[
          {
            name: topic.title,
            summary: [
              topic.description,
              topic.current_status_label
                ? `現在の状況: ${topic.current_status_label}`
                : "",
              topic.current_status_note ?? "",
            ]
              .filter(Boolean)
              .join("\n"),
            tags: ["Topics"],
          },
          ...topic.relatedBills.map((bill) => ({
            name: bill.name,
            summary: bill.bill_content?.summary,
            tags: ["関連議案"],
          })),
        ]}
      />
    </div>
  );
}
