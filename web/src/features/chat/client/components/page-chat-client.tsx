"use client";

import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { ChatButton } from "./chat-button";

export type ChatDesktopLayout = "fixed" | "inline";

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
