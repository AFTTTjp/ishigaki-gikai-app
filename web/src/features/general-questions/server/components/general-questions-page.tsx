import { Container } from "@/components/layouts/container";
import type { DietSessionInfo, GeneralQuestion } from "../../shared/types";
import { groupByDate } from "../../shared/utils/group-by-date";
import { GeneralQuestionsDateGroup } from "./general-questions-date-group";

type Props = {
  session: DietSessionInfo;
  questions: GeneralQuestion[];
};

export function GeneralQuestionsPage({ session, questions }: Props) {
  const grouped = groupByDate(questions);

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
    </div>
  );
}
