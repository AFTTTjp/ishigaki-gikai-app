import "server-only";
import type { Route } from "next";
import Link from "next/link";
import { formatDate } from "@/features/general-questions/shared/utils/format-date";
import { routes } from "@/lib/routes";
import type { GeneralQuestionForTopic } from "../../shared/types";

interface TopicRelatedGeneralQuestionsProps {
  questions: GeneralQuestionForTopic[];
}

export function TopicRelatedGeneralQuestions({
  questions,
}: TopicRelatedGeneralQuestionsProps) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-[22px] font-bold text-slate-900">
          関連する一般質問
        </h2>
        <p className="text-sm text-slate-500">{questions.length}件</p>
      </div>

      <p className="text-sm leading-7 text-slate-500">
        このテーマに関連して、議員が本会議で行った一般質問の一覧です。
      </p>

      {questions.length > 0 ? (
        <div className="space-y-4">
          {questions.map((question) => (
            <Link
              key={question.id}
              href={
                routes.generalQuestionsSession(
                  question.diet_session.slug
                ) as Route
              }
              className="block"
            >
              <div className="rounded-2xl border border-mirai-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {question.question_number}
                      </span>
                      <span className="text-base font-bold text-mirai-text">
                        {question.member_name_raw ?? "氏名不明"}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-mirai-text-muted">
                      {formatDate(question.question_date)}
                    </span>
                  </div>

                  {question.items.length > 0 && (
                    <ol className="flex flex-col gap-2 pl-11">
                      {question.items.map((item) => (
                        <li key={item.id} className="flex items-start gap-2">
                          <span className="shrink-0 text-sm font-bold text-mirai-text-muted">
                            {item.item_number}.
                          </span>
                          <span className="text-sm leading-snug text-mirai-text">
                            {item.title}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <p className="text-xs text-mirai-text-muted">
                    {question.diet_session.name}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center text-slate-500">
          現在、このトピックに紐づく一般質問はありません。
        </div>
      )}
    </section>
  );
}
