import { notFound } from "next/navigation";
import { getDifficultyLevel } from "@/features/bill-difficulty/server/loaders/get-difficulty-level";
import { GeneralQuestionsPage } from "@/features/general-questions/server/components/general-questions-page";
import {
  findDietSessionBySlug,
  findPublishedGeneralQuestionsBySessionSlug,
} from "@/features/general-questions/server/repositories/general-question-repository";

type Props = {
  params: Promise<{ sessionSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { sessionSlug } = await params;
  const session = await findDietSessionBySlug(sessionSlug);
  if (!session) {
    return { title: "一般質問 | みらい議会@石垣市" };
  }
  return {
    title: `一般質問 — ${session.name} | みらい議会@石垣市`,
  };
}

export default async function GeneralQuestionsSessionPage({ params }: Props) {
  const { sessionSlug } = await params;

  const [session, questions, currentDifficulty] = await Promise.all([
    findDietSessionBySlug(sessionSlug),
    findPublishedGeneralQuestionsBySessionSlug(sessionSlug),
    getDifficultyLevel(),
  ]);

  if (!session) {
    notFound();
  }

  return (
    <GeneralQuestionsPage
      session={session}
      questions={questions}
      currentDifficulty={currentDifficulty}
    />
  );
}
