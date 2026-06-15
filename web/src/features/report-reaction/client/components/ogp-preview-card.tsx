"use client";

import { useState } from "react";

interface OgpPreviewCardProps {
  ogImageUrl: string;
  billName: string;
}

export function OgpPreviewCard({ ogImageUrl, billName }: OgpPreviewCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="w-full overflow-hidden">
      {!isLoaded && (
        <div className="aspect-[1200/630] w-full animate-pulse rounded bg-muted" />
      )}
      {/* biome-ignore lint/performance/noImgElement: 動的生成されたOGP画像URLを表示するため next/image ではなく img を使用 */}
      <img
        src={ogImageUrl}
        alt={`${billName}に対する意見のOGP画像`}
        className={`w-full ${isLoaded ? "block" : "hidden"}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
      />
    </div>
  );
}
