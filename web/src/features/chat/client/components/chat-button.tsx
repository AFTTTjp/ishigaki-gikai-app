"use client";

import { useChat } from "@ai-sdk/react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import type { BillWithContent } from "@/features/bills/shared/types";
import { cn } from "@/lib/utils";
import { ChatWindow } from "./chat-window";
import type { ChatDesktopLayout } from "./page-chat-client";

// アニメーション定数
const ANIMATION_DURATION = {
  SIZE_TRANSITION: 300, // ボタンサイズ変更のアニメーション時間（ms）
  TEXT_FADE_IN: 200, // テキストフェードイン時間（ms）
  TEXT_CHANGE_DELAY: 250, // テキスト内容変更までの待機時間（サイズアニメーション終了間際）
} as const;

interface ChatButtonProps {
  billContext?: BillWithContent;
  hasInterviewConfig?: boolean;
  difficultyLevel: string;
  suggestedQuestions?: string[];
  pcLayout?: ChatDesktopLayout;
  pageContext?: {
    type: "home" | "bill";
    bills?: Array<{
      name: string;
      summary?: string;
      tags?: string[];
      isFeatured?: boolean;
    }>;
  };
}

export interface ChatButtonRef {
  openWithText: (selectedText: string) => void;
}

export const ChatButton = forwardRef<ChatButtonRef, ChatButtonProps>(
  (
    {
      billContext,
      hasInterviewConfig,
      difficultyLevel,
      suggestedQuestions,
      pcLayout = "fixed",
      pageContext,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCompact, setIsCompact] = useState(false);
    const [showText, setShowText] = useState(true);
    const [openedWithText, setOpenedWithText] = useState(false);
    const pathname = usePathname();

    // floating: PC でも開閉ボタンを出し、押した時だけパネルを開くモード。
    // fixed（既定）は従来どおり PC で右下に常時パネルを表示し、ボタンはモバイルのみ。
    const isFloating = pcLayout === "floating";

    // Chat state をここで管理することで、モーダルが閉じても状態が保持される
    const chatState = useChat();

    // pathname が変わるたびに新しいセッションIDを発行
    // ページ遷移時にチャットセッションをリセット
    // biome-ignore lint/correctness/useExhaustiveDependencies: pathnameが変わるたびに新しいIDを生成するため意図的に依存配列に含めている
    const sessionId = useMemo(() => crypto.randomUUID(), [pathname]);

    useImperativeHandle(ref, () => ({
      openWithText: (selectedText: string) => {
        // AIからの返答待ち中は新しいメッセージを送信しない
        if (
          chatState.status === "streaming" ||
          chatState.status === "submitted"
        ) {
          return;
        }

        const questionText = `「${selectedText}」について教えてください。`;
        setOpenedWithText(true);
        setIsOpen(true);
        chatState.sendMessage({
          text: questionText,
          metadata: {
            billContext,
            hasInterviewConfig,
            difficultyLevel,
            pageContext,
            sessionId,
          },
        });
      },
    }));

    useEffect(() => {
      let lastScrollY = window.scrollY;

      const handleScroll = () => {
        const currentScrollY = window.scrollY;
        const shouldCompact =
          currentScrollY > lastScrollY && currentScrollY > 0 && !isCompact;
        const shouldExpand = currentScrollY < lastScrollY && isCompact;

        if (shouldCompact || shouldExpand) {
          setIsCompact(shouldCompact);
          setShowText(false);
          setTimeout(() => {
            setShowText(true);
          }, ANIMATION_DURATION.TEXT_CHANGE_DELAY);
        }

        lastScrollY = currentScrollY;
      };

      window.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        window.removeEventListener("scroll", handleScroll);
      };
    }, [isCompact]);

    return (
      <>
        <div
          className={cn(
            "fixed left-6 right-6 bottom-4 z-50 mx-auto flex max-w-[460px] justify-center md:bottom-8",
            // fixed モードは従来どおり PC ではボタンを隠す（常時パネル表示のため）。
            // floating モードでは PC でも右下に compact なボタンを出し、開いている間は隠す。
            isFloating
              ? cn(
                  "pc:left-auto pc:right-8 pc:mx-0 pc:w-auto pc:max-w-none pc:justify-end",
                  isOpen && "pc:hidden"
                )
              : "pc:hidden"
          )}
        >
          <div
            className="relative rounded-[50px] bg-gradient-to-tr from-mirai-gradient-start to-mirai-gradient-end p-[2px] shadow-[2px_2px_2px_0px_rgba(0,0,0,0.25)] origin-center flex transition-[flex-basis] ease-in-out"
            style={{
              flexBasis: isCompact ? "120px" : "100%",
              transitionDuration: `${ANIMATION_DURATION.SIZE_TRANSITION}ms`,
            }}
          >
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className={`relative bg-white rounded-[50px] hover:opacity-90 flex items-center w-full py-2 transition-all ease-in-out ${
                isCompact
                  ? "h-[35px] px-4 justify-center gap-2.5"
                  : "h-14 justify-end pr-4 pl-6 gap-2.5"
              }`}
              style={{
                transitionDuration: `${ANIMATION_DURATION.SIZE_TRANSITION}ms`,
              }}
              aria-label="議案について質問する"
            >
              <span
                className={`text-mirai-text-placeholder text-sm font-medium leading-[1.5em] tracking-[0.01em] ${
                  isCompact ? "text-center" : "flex-1 text-left"
                } ${
                  showText
                    ? "opacity-100 transition-opacity ease-in-out"
                    : "opacity-0"
                }`}
                style={
                  showText
                    ? {
                        transitionDuration: `${ANIMATION_DURATION.TEXT_FADE_IN}ms`,
                      }
                    : undefined
                }
              >
                {isCompact ? "AIに質問" : "わからないことをAIに質問する"}
              </span>
              {!isCompact && (
                <div className="relative w-10 h-10 rounded-[20px] bg-mirai-gradient flex items-center justify-center flex-shrink-0">
                  <Image
                    src="/icons/chat-button-icon.svg"
                    alt="チャット"
                    width={40}
                    height={40}
                    className="pointer-events-none"
                  />
                </div>
              )}
            </button>
          </div>
        </div>

        <ChatWindow
          billContext={billContext}
          hasInterviewConfig={hasInterviewConfig}
          difficultyLevel={difficultyLevel}
          suggestedQuestions={suggestedQuestions}
          pcLayout={pcLayout}
          chatState={chatState}
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            setOpenedWithText(false);
          }}
          pageContext={pageContext}
          disableAutoFocus={openedWithText}
          sessionId={sessionId}
        />
      </>
    );
  }
);

ChatButton.displayName = "ChatButton";
