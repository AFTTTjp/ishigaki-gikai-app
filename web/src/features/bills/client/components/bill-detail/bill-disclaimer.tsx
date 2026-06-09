import Link from "next/link";
import { LinkButton } from "@/components/top/link-button";
import { EXTERNAL_LINKS } from "@/config/external-links";
import { routes } from "@/lib/routes";
import { ManualRuby } from "@/lib/rubyful/manual-ruby";

export function BillDisclaimer() {
  return (
    <div className="space-y-6 pt-4 pb-10">
      {/* データの出典について */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-black">掲載コンテンツについて</h3>
        <p className="text-xs leading-relaxed text-mirai-text-note">
          掲載されている議案情報は、議会に提出された議案などの公開情報を基に、AFTTTがAIを活用しながら背景情報を整理したものです。主に議会提出議案を対象としています。
        </p>
        <p className="text-xs leading-relaxed text-mirai-text-note">
          このサイトは、「チームみらい」が開発する「
          <Link
            href={EXTERNAL_LINKS.MIRAI_GIKAI}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            みらい議会
          </Link>
          」をもとに AFTTT が運営する非公式サイトです。
        </p>
      </div>

      {/* 掲載コンテンツについての免責事項 */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-black">免責事項</h3>
        <p className="text-xs leading-relaxed text-mirai-text-note">
          これは政党チームみらいが運営しているものではありません。
        </p>
        <p className="text-xs leading-relaxed text-mirai-text-note">
          このサイトは石垣市役所、石垣市議会、およびチームみらいの公式サイトではありません。ご意見や不具合のご連絡は、運営者の
          <Link
            href={EXTERNAL_LINKS.OPERATOR_X}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            福里淳
          </Link>
          へお願いします。本サイトで公開する情報は、可能な限り正確かつ最新の情報を反映するよう努めていますが、その正確性・完全性・即時性について保証するものではありません。また、AIチャットは不正確または誤解を招く回答を生成する可能性があります。正確な情報は、公式文書や一次資料をご確認ください。
        </p>
      </div>

      <LinkButton
        href={routes.faq()}
        icon={{
          src: "/icons/question-bubble.svg",
          alt: "note",
          width: 22,
          height: 22,
        }}
      >
        よくある質問
      </LinkButton>
    </div>
  );
}
