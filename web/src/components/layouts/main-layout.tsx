"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  isDifficultyTogglePage,
  isInterviewSection,
} from "@/lib/page-layout-utils";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  // チャットを右サイドバーとして表示するページ（TOP・議案詳細・Topic・議員名簿に
  // 加え /kokkai/[slug]/bills も含む）でオフセットを付け、本文とチャットの重なりを防ぐ。
  const useSidebarLayout = isDifficultyTogglePage(pathname);
  const isInterview = isInterviewSection(pathname);
  const isHome = pathname === "/";

  return (
    <div
      className={cn(
        "relative max-w-[700px] mx-auto",
        !isHome && "mt-24 md:mt-24",
        // インタビューページ以外ではshadowを表示
        !isInterview && "sm:shadow-lg",
        // チャットを表示するページのみ、チャットサイドバー用のオフセット
        useSidebarLayout && "pc:mr-[500px] xl:ml-[calc(calc(100vw-1180px)/2)]"
      )}
    >
      {children}
    </div>
  );
}
