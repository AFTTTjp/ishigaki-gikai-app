import Image from "next/image";
import { Container } from "@/components/layouts/container";
import Link from "next/link";

export function Hero() {
  return (
    <div className="relative w-full h-[80vh] min-h-[400px] md:h-[70vh]">
      <Image
        src="/img/hero_background_ishigakicity_blue.png"
        alt="石垣市議会"
        fill
        priority
        className="object-cover"
        sizes="100vw"
        quality={85}
      />
      <div className="absolute bottom-[30vh] left-0 right-0 py-4">
        <Container>
          <p className="font-bold text-xl md:text-2xl leading-relaxed">
            いま石垣市議会で議論されていること <br />
            やさしい言葉で説明します
          </p>
          <p className="mt-2 font-lexend text-xs">
            powered by{" "}
            <Link
              href="https://team-mir.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Team Mirai
            </Link>{" "}
            & AI, built by{" "}
            <Link
              href="https://afttt.jp"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              AFTTT
            </Link>
          </p>
        </Container>
      </div>

      {/* スクロールインジケーター */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce-gentle">
        <div className="w-[1px] h-[34px] bg-black"></div>
        <p className="mt-2 font-lexend text-[10px] leading-[20px] text-black">
          Scroll
        </p>
      </div>
    </div>
  );
}
