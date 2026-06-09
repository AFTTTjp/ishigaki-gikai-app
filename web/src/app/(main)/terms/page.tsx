import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalList,
  LegalPageLayout,
  LegalParagraph,
  LegalSectionTitle,
} from "@/components/layouts/legal-page-layout";
import { Container } from "@/components/layouts/container";
import { EXTERNAL_LINKS } from "@/config/external-links";

export const metadata: Metadata = {
  title: "利用規約 | みらい議会@石垣市",
  description: "みらい議会@石垣市の利用規約",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="利用規約"
      description="みらい議会@石垣市をご利用いただく際の基本的なルールを定めています。"
      className="pt-6 md:pt-12"
    >
      <Container className="space-y-8">
        <LegalParagraph className="text-right">
          最終更新日：2026年4月8日
        </LegalParagraph>

        <LegalParagraph>
          みらい議会
          石垣市議会版（以下「本サービス」といいます。）は、石垣市議会に関する公開情報を市民のみなさんが見やすい形で確認できるように整理・提供するサービスです。本サービスを利用する場合、本規約に同意したものとみなします。
        </LegalParagraph>
        <LegalParagraph>
          本サービスは、「チームみらい」が開発する「
          <Link
            href={EXTERNAL_LINKS.MIRAI_GIKAI}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            みらい議会
          </Link>
          」をもとに AFTTT
          が運営する非公式サイトです。このサイトは石垣市役所、石垣市議会、およびチームみらいの公式サイトではありません。ご意見や不具合のご連絡は、運営者の
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

        <section className="space-y-4">
          <LegalSectionTitle>1. 本サービスについて</LegalSectionTitle>
          <LegalParagraph>
            本サービスでは、議案、会期、議員名簿その他の公開情報をもとに、要約や関連情報を掲載しています。一部の説明や対話機能には
            AI を利用しています。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>2. 禁止事項</LegalSectionTitle>
          <LegalParagraph>
            利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。
          </LegalParagraph>
          <LegalList
            items={[
              "法令または公序良俗に反する行為",
              "本サービスや第三者の権利、利益、名誉、信用を侵害する行為",
              "本サービスの内容を改ざんし、誤解を招く形で再配布する行為",
              "過度な負荷をかける行為、スクレイピングや自動化による不正利用、解析や侵入を試みる行為",
              "AI機能を用いて不適切な内容、違法な内容、第三者を傷つける内容を生成・入力する行為",
              "本サービスの運営を妨害する行為",
            ]}
          />
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>3. 掲載情報と AI 応答について</LegalSectionTitle>
          <LegalParagraph>
            本サービスに掲載する情報は、可能な限り正確かつ最新の内容となるよう努めていますが、正確性、完全性、最新性、有用性を保証するものではありません。
          </LegalParagraph>
          <LegalParagraph>
            AI
            による要約やチャット応答には誤りや不十分な説明が含まれる可能性があります。最終的な確認は、石垣市議会や自治体が公開する公式資料、会議資料、一次情報をご参照ください。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>4. 知的財産権</LegalSectionTitle>
          <LegalParagraph>
            本サービスに掲載される文章、画像、デザイン、プログラムその他の構成要素に関する権利は、運営者または正当な権利者に帰属します。法令で認められる範囲を超えて利用することはできません。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>5. サービスの変更・停止</LegalSectionTitle>
          <LegalParagraph>
            運営者は、必要に応じて本サービスの内容を変更し、または提供を停止することがあります。これにより利用者に生じた損害について、運営者は責任を負いません。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>6. 本規約の変更</LegalSectionTitle>
          <LegalParagraph>
            運営者は、必要に応じて本規約を変更することがあります。変更後の規約は、本サービス上に掲載した時点から効力を生じます。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>7. 準拠法</LegalSectionTitle>
          <LegalParagraph>
            本規約は日本法に準拠して解釈されます。
          </LegalParagraph>
        </section>
      </Container>
    </LegalPageLayout>
  );
}
