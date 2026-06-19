import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layouts/container";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { getBillsByDietSession } from "@/features/bills/server/loaders/get-bills-by-diet-session";
import { DietSessionBillList } from "@/features/diet-sessions/client/components/diet-session-bill-list";
import { DietSessionOverviewSection } from "@/features/diet-sessions/client/components/diet-session-overview-section";
import { DietSessionReportSection } from "@/features/diet-sessions/client/components/diet-session-report-section";
import { getDietSessionBySlug } from "@/features/diet-sessions/server/loaders/get-diet-session-by-slug";
import { SESSION_OVERVIEWS } from "@/features/diet-sessions/shared/data/session-overviews";
import type { KeyPointRelatedQuestion } from "@/features/diet-sessions/shared/utils/select-related-general-questions";
import { findPublishedGeneralQuestionsBySessionSlug } from "@/features/general-questions/server/repositories/general-question-repository";
import { getTopics } from "@/features/topics/server/loaders/get-topics";
import { routes } from "@/lib/routes";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const session = await getDietSessionBySlug(slug);

  if (!session) {
    return { title: "議会会期が見つかりません" };
  }

  return {
    title: `${session.name}の議案一覧 | みらい議会`,
    description: `${session.name}（${session.start_date}〜${session.end_date}）に提出された議案の一覧です。`,
  };
}

export default async function DietSessionBillsPage({ params }: Props) {
  const { slug } = await params;
  const session = await getDietSessionBySlug(slug);

  if (!session) {
    notFound();
  }

  const bills = await getBillsByDietSession(session.id);
  const currentDifficulty = await getDifficultyLevel();

  // 会期レポートの関連 Topic を、公開済み（active）のもののみ解決する
  const relatedTopicSlugs = SESSION_OVERVIEWS[slug]?.relatedTopicSlugs ?? [];
  const relatedTopics =
    relatedTopicSlugs.length > 0
      ? (await getTopics())
          .filter((topic) => relatedTopicSlugs.includes(topic.slug))
          .map((topic) => ({ slug: topic.slug, title: topic.title }))
      : [];

  // 論点カードに「関連する一般質問」を出すための軽量データを用意する。
  // いずれかの keyPoint に手動マッピングがある場合だけ DB を引く。
  const hasKeyPointQuestionMapping = (
    SESSION_OVERVIEWS[slug]?.keyPoints ?? []
  ).some((keyPoint) => (keyPoint.relatedGeneralQuestionSlugs?.length ?? 0) > 0);
  const relatedQuestions: KeyPointRelatedQuestion[] = hasKeyPointQuestionMapping
    ? (await findPublishedGeneralQuestionsBySessionSlug(slug)).map(
        (question) => ({
          slug: question.slug,
          memberName: question.member_name_raw ?? "",
          questionDate: question.question_date,
        })
      )
    : [];

  return (
    <div className="bg-mirai-surface-muted">
      {/* ヒーロー画像 */}
      <div className="relative w-full h-[285px]">
        <Image
          src="/img/hero_background_ishigakicity_blue.png"
          alt={`${session.name}の議案一覧`}
          fill
          priority
          className="object-cover object-[center_65%]"
          sizes="100vw"
          quality={85}
        />
      </div>

      {/* 会期レポート（現在地・初日の動き・委員会付託） */}
      <DietSessionReportSection
        session={session}
        currentDifficulty={currentDifficulty}
        relatedTopics={relatedTopics}
        relatedQuestions={relatedQuestions}
      />

      {/* 今会期のテーマセクション（全件表示） */}
      <DietSessionOverviewSection session={session} showAll />

      <Container className="py-8">
        <DietSessionBillList session={session} bills={bills} />
      </Container>

      {/* パンくずリスト */}
      <Container className="py-8">
        <nav className="flex items-center gap-2 text-[15px]">
          <Link href={routes.home()} className="text-black">
            TOP
          </Link>
          <ChevronRight className="h-5 w-5 text-black" />
          <span className="text-black">過去の議案</span>
        </nav>
      </Container>
    </div>
  );
}
