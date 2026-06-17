import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

type Props = {
  params: Promise<{ slug: string }>;
};

// 会期 slug 直下（/kokkai/[slug]）は議案一覧ページへリダイレクトする
export default async function DietSessionPage({ params }: Props) {
  const { slug } = await params;
  redirect(routes.kokkaiSessionBills(slug));
}
