import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageWithChatLayoutProps {
  children: ReactNode;
  chat: ReactNode;
  className?: string;
  gridClassName?: string;
  mainClassName?: string;
  chatClassName?: string;
}

export function PageWithChatLayout({
  children,
  chat,
  className,
  gridClassName,
  mainClassName,
  chatClassName,
}: PageWithChatLayoutProps) {
  return (
    <div className={cn("mx-auto max-w-[1240px]", className)}>
      <div
        className={cn(
          "pc:grid pc:grid-cols-[minmax(0,1fr)_380px] pc:items-start pc:gap-8 pcl:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,720px)_450px]",
          gridClassName
        )}
      >
        <div className={cn("min-w-0", mainClassName)}>{children}</div>
        <aside className={cn("min-w-0", chatClassName)}>{chat}</aside>
      </div>
    </div>
  );
}
