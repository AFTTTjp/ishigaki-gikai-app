import type { GeneralQuestion } from "../../shared/types";

type Props = {
  question: GeneralQuestion;
};

const SEAT_TYPE_LABEL: Record<"floor" | "seat", string> = {
  floor: "質問席",
  seat: "自席",
};

export function GeneralQuestionCard({ question }: Props) {
  return (
    <div className="rounded-2xl border border-mirai-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {question.question_number}
            </span>
            <span className="text-lg font-bold text-mirai-text">
              {question.member_name_raw ?? "氏名不明"}
            </span>
          </div>
          <span className="shrink-0 rounded-full bg-mirai-surface-grouped px-3 py-1 text-xs font-medium text-mirai-text-muted">
            {SEAT_TYPE_LABEL[question.seat_type]}
          </span>
        </div>

        {question.items.length > 0 && (
          <ol className="flex flex-col gap-3">
            {question.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-sm font-bold text-mirai-text-muted">
                    {item.item_number}.
                  </span>
                  <span className="text-sm font-medium leading-snug text-mirai-text">
                    {item.title}
                  </span>
                </div>
                {item.sub_items.length > 0 && (
                  <ul className="ml-5 flex flex-col gap-1 border-l-2 border-mirai-border pl-3">
                    {item.sub_items.map((sub, idx) => (
                      <li
                        key={`${item.id}-sub-${idx}`}
                        className="text-xs leading-relaxed text-mirai-text-muted"
                      >
                        {sub}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
