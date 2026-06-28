"use client";

import type { DifficultyLevelEnum } from "@/features/bill-difficulty/shared/types";
import { ChatButton } from "./chat-button";

interface PageChatClientProps {
  currentDifficulty: DifficultyLevelEnum;
  items: Array<{
    name: string;
    summary?: string;
    tags?: string[];
    isFeatured?: boolean;
  }>;
  suggestedQuestions?: string[];
}

export function PageChatClient({
  currentDifficulty,
  items,
  suggestedQuestions,
}: PageChatClientProps) {
  return (
    <ChatButton
      difficultyLevel={currentDifficulty}
      suggestedQuestions={suggestedQuestions}
      pageContext={{
        type: "home",
        bills: items,
      }}
    />
  );
}
