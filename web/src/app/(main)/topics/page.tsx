import type { Metadata } from "next";
import { Container } from "@/components/layouts/container";
import { TopicCard } from "@/features/topics/server/components/topic-card";
import { getTopics } from "@/features/topics/server/loaders/get-topics";

export const metadata: Metadata = {
  title: "Topics | みらい議会@石垣市",
  description:
    "石垣市議会で扱われるテーマごとに、背景情報と関連議案を整理して確認できます。",
};

export default async function TopicsPage() {
  const topics = await getTopics();

  return (
    <div
      className="py-10"
      style={{
        backgroundImage:
          "linear-gradient(var(--color-mirai-topics-bg-start), var(--color-mirai-topics-bg-end))",
      }}
    >
      <Container>
        <div className="flex flex-col gap-8">
          <div className="space-y-3">
            <p className="text-sm font-bold tracking-[0.08em] text-primary-accent">
              TOPICS
            </p>
            <div className="space-y-3">
              <h1 className="text-4xl font-extrabold tracking-[0.02em] text-slate-900">
                テーマから議会情報を見る
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-600">
                政策テーマごとに情報を整理した一覧です。背景の説明と、関連する議案をまとめて確認できます。
              </p>
            </div>
          </div>

          {topics.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2">
              {topics.map((topic) => (
                <TopicCard key={topic.id} topic={topic} />
              ))}
            </div>
          ) : (
            <div className="rounded-[32px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 shadow-sm">
              現在、表示できるトピックはありません。
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
