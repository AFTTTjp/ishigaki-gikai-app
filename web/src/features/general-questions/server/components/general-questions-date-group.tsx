import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import type { GeneralQuestion } from "../../shared/types";
import { formatDate } from "../../shared/utils/format-date";
import { GeneralQuestionCard } from "./general-question-card";

type Props = {
  date: string;
  questions: GeneralQuestion[];
  currentDifficulty: DifficultyLevelEnum;
};

export function GeneralQuestionsDateGroup({
  date,
  questions,
  currentDifficulty,
}: Props) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-mirai-text">
          {formatDate(date)}
        </h2>
        <span className="text-sm text-mirai-text-muted">
          {questions.length}名
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {questions.map((q) => (
          <GeneralQuestionCard
            key={q.id}
            question={q}
            currentDifficulty={currentDifficulty}
          />
        ))}
      </div>
    </section>
  );
}
