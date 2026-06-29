import { Container } from "@/components/layouts/container";
import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { PageChatClient } from "@/features/chat/client/components/page-chat-client";
import type { DietSessionInfo, GeneralQuestion } from "../../shared/types";
import { groupByDate } from "../../shared/utils/group-by-date";
import { GeneralQuestionsDateGroup } from "./general-questions-date-group";

type Props = {
  session: DietSessionInfo;
  questions: GeneralQuestion[];
  currentDifficulty: DifficultyLevelEnum;
};

export function GeneralQuestionsPage({
  session,
  questions,
  currentDifficulty,
}: Props) {
  const grouped = groupByDate(questions);
  const chatItems = questions.map((question) => ({
    name: `${question.member_name_raw ?? "氏名不明"}議員の一般質問`,
    summary: [
      `日付: ${question.question_date}`,
      ...question.items.map((item) => `${item.item_number}. ${item.title}`),
    ].join("\n"),
    tags: ["一般質問"],
  }));

  return (
    <div className="min-h-screen bg-mirai-surface pb-20 pt-10">
      <Container>
        <div className="flex flex-col gap-10">
          <div className="space-y-3">
            <p className="text-sm font-bold tracking-[0.08em] text-primary-accent">
              GENERAL QUESTIONS
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-[0.02em] text-mirai-text">
                一般質問
              </h1>
              <p className="text-base font-medium text-mirai-text-secondary">
                {session.name}
              </p>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-mirai-text-muted">
              議員が市政に関する事項について行政に問う「一般質問」の通告内容を掲載しています。
            </p>
          </div>

          {grouped.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-mirai-border bg-white px-6 py-12 text-center text-mirai-text-muted">
              現在、表示できる一般質問データがありません。
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {grouped.map(({ date, questions: qs }) => (
                <GeneralQuestionsDateGroup
                  key={date}
                  date={date}
                  questions={qs}
                />
              ))}
            </div>
          )}
        </div>
      </Container>

      <PageChatClient
        currentDifficulty={currentDifficulty}
        items={chatItems}
        suggestedQuestions={[
          "この一般質問ではどんなテーマが多かったですか？",
          "離島甲子園について話されていますか？",
          "旧庁舎跡地について話されていますか？",
          "議員ごとの質問内容を教えて",
        ]}
      />
    </div>
  );
}
