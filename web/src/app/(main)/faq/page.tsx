import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { EXTERNAL_LINKS } from "@/config/external-links";
import {
  LegalList,
  LegalPageLayout,
  LegalParagraph,
  LegalSectionTitle,
} from "@/components/layouts/legal-page-layout";

export const metadata: Metadata = {
  title: "よくあるご質問 | みらい議会@石垣市",
  description: "石垣市議会版みらい議会についてのよくあるご質問",
};

export default function FaqPage() {
  return (
    <LegalPageLayout
      title="よくあるご質問"
      description="石垣市議会版みらい議会の見方や、掲載情報・AI機能についての基本的なご案内です。"
      className="pt-6 md:pt-12"
    >
      <Container className="space-y-8">
        <LegalParagraph className="text-right">
          最終更新日：2026年4月8日
        </LegalParagraph>

        <section className="space-y-4">
          <LegalSectionTitle>みらい議会@石垣市とは何ですか？</LegalSectionTitle>
          <LegalParagraph>
            石垣市議会に提出された議案や関連情報を、市民のみなさんが読みやすい形で確認できるように整理したサイトです。AFTTT
            が公開情報をもとに構成し、一部で AI
            を活用して背景や論点をわかりやすくまとめています。
          </LegalParagraph>
          <LegalParagraph>
            このサイトは、「チームみらい」が開発する「みらい議会」をもとに AFTTT
            が運営する非公式サイトです。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>
            どのような情報を掲載していますか？
          </LegalSectionTitle>
          <LegalParagraph>
            主に石垣市議会に提出された議案、会期情報、議員名簿などを掲載しています。議案ページでは、正式名称だけでなく、要約や背景説明、関連タグなども確認できます。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>情報源は何ですか？</LegalSectionTitle>
          <LegalParagraph>
            石垣市議会や自治体が公開している議案資料、会議情報、関連する公開情報をもとにしています。正確な内容を確認したい場合は、元の公式資料や一次資料をあわせてご確認ください。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>
            AI の説明やチャットはどこまで信頼できますか？
          </LegalSectionTitle>
          <LegalParagraph>
            AI
            は議案の理解を助けるための補助機能です。できるだけ正確になるよう調整していますが、要約や回答には誤りや不十分な説明が含まれることがあります。最終的な確認は、公式文書や議会資料をご参照ください。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>
            今注目の議案はどのように選ばれていますか？
          </LegalSectionTitle>
          <LegalParagraph>
            トップページの注目議案は、現在の運用方針に基づいて個別に選定した議案を掲載しています。市民生活との関係、地域性、関心の高さなどを踏まえて整理しています。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>
            間違いを見つけた場合はどうすればいいですか？
          </LegalSectionTitle>
          <LegalParagraph>
            現時点では専用の報告フォームを準備中です。公開情報と見比べて気になる点がある場合は、まず一次資料をご確認ください。運用窓口が整い次第、このページでも案内します。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>公式サイトですか？</LegalSectionTitle>
          <LegalParagraph>
            このサイトは石垣市役所、石垣市議会、およびチームみらいの公式サイトではありません。ご意見や不具合のご連絡は、運営者の
            <Link
              href={EXTERNAL_LINKS.OPERATOR_X}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              福里淳
            </Link>
            へお願いします。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>
            このサイトを見るときのポイントはありますか？
          </LegalSectionTitle>
          <LegalList
            items={[
              "まずはトップページの注目議案から見る",
              "気になるテーマはタグから探す",
              "議案詳細では正式名称、要約、本文、ステータスを見比べる",
              "わかりにくい言葉は AI チャットも使いながら確認する",
              "最終確認は公式資料で行う",
            ]}
          />
        </section>
      </Container>
    </LegalPageLayout>
  );
}
