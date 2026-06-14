import { notFound } from "next/navigation";
import {
  findDietSessionBySlug,
  findPublishedGeneralQuestionsBySessionSlug,
} from "@/features/general-questions/server/repositories/general-question-repository";
import { GeneralQuestionsPage } from "@/features/general-questions/server/components/general-questions-page";

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

  const [session, questions] = await Promise.all([
    findDietSessionBySlug(sessionSlug),
    findPublishedGeneralQuestionsBySessionSlug(sessionSlug),
  ]);

  if (!session) {
    notFound();
  }

  return <GeneralQuestionsPage session={session} questions={questions} />;
}
