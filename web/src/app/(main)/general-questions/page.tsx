import { notFound, redirect } from "next/navigation";
import { findLatestGeneralQuestionSession } from "@/features/general-questions/server/repositories/general-question-repository";
import { routes } from "@/lib/routes";

export const metadata = {
  title: "一般質問 | みらい議会@石垣市",
};

export default async function GeneralQuestionsIndexPage() {
  const session = await findLatestGeneralQuestionSession();

  if (!session) {
    notFound();
  }

  redirect(routes.generalQuestionsSession(session.slug));
}
