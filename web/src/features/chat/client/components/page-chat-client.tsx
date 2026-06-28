"use client";

import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { ChatButton } from "./chat-button";

// "fixed": PC で右下に常時表示するドッキングパネル（home / members / 議案詳細）。
// "floating": PC でも右下に開閉ボタンを出し、押した時だけパネルを開く（会期 / Topic）。
//   本文を 2 カラムで圧迫せず、AI は補助導線に徹する。
export type ChatDesktopLayout = "fixed" | "floating";

interface PageChatClientProps {
  currentDifficulty: DifficultyLevelEnum;
  items: Array<{
    name: string;
    summary?: string;
    tags?: string[];
    isFeatured?: boolean;
  }>;
  suggestedQuestions?: string[];
  pcLayout?: ChatDesktopLayout;
}

export function PageChatClient({
  currentDifficulty,
  items,
  suggestedQuestions,
  pcLayout,
}: PageChatClientProps) {
  return (
    <ChatButton
      difficultyLevel={currentDifficulty}
      suggestedQuestions={suggestedQuestions}
      pcLayout={pcLayout}
      pageContext={{
        type: "home",
        bills: items,
      }}
    />
  );
}
