import type { Metadata } from "next";
import { Container } from "@/components/layouts/container";
import {
  LegalList,
  LegalPageLayout,
  LegalParagraph,
  LegalSectionTitle,
} from "@/components/layouts/legal-page-layout";

export const metadata: Metadata = {
  title: "プライバシーポリシー | みらい議会@石垣市",
  description: "みらい議会@石垣市のプライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      className="bg-transparent pt-6 md:pt-12"
      title="プライバシーポリシー"
      description="みらい議会@石垣市における情報の取り扱いについてご説明します。"
    >
      <Container className="space-y-8">
        <LegalParagraph className="text-right">
          最終更新日：2026年4月8日
        </LegalParagraph>

        <section className="space-y-4">
          <LegalSectionTitle>1. 取得する情報</LegalSectionTitle>
          <LegalParagraph>
            本サービスでは、利用状況の把握や機能提供のために、以下の情報を取得することがあります。
          </LegalParagraph>
          <LegalList
            items={[
              "Cookie や難易度設定など、サービス表示に必要な情報",
              "アクセス日時、閲覧ページ、利用端末、ブラウザ等の利用環境情報",
              "AI チャットや AI インタビュー機能を利用した際の入力内容、対話履歴、生成結果",
              "障害対応や品質改善に必要な技術的ログ",
            ]}
          />
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>2. 利用目的</LegalSectionTitle>
          <LegalParagraph>
            取得した情報は、以下の目的で利用します。
          </LegalParagraph>
          <LegalList
            items={[
              "本サービスの提供、維持、改善",
              "表示内容や説明機能の最適化",
              "不正利用の防止、セキュリティ確保、障害対応",
              "利用状況の分析",
              "AI 機能の品質向上",
            ]}
          />
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>3. AI 機能に関する取り扱い</LegalSectionTitle>
          <LegalParagraph>
            本サービスでは、議案の説明や対話機能の一部に AI
            を利用しています。利用者が入力した内容は、応答生成、品質改善、運用上の確認のために処理・保存される場合があります。
          </LegalParagraph>
          <LegalParagraph>
            ただし、入力内容の公開や二次利用については、今後の運用方針に応じて取り扱いを定めます。公開や外部共有を行う場合は、その内容がわかる形で別途案内します。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>4. 第三者提供</LegalSectionTitle>
          <LegalParagraph>
            法令に基づく場合や、サービス提供に必要な範囲を除き、取得した情報を第三者に提供しません。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>5. 外部サービス</LegalSectionTitle>
          <LegalParagraph>
            本サービスでは、ホスティング、データベース、アクセス解析、AI
            処理などに外部サービスを利用する場合があります。これらのサービス提供に必要な範囲で情報が処理されることがあります。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>6. Cookie について</LegalSectionTitle>
          <LegalParagraph>
            本サービスでは、表示設定の保持や利用状況の把握のために Cookie
            を利用することがあります。Cookie
            を無効にすると、一部機能が正しく動作しない場合があります。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>7. 安全管理</LegalSectionTitle>
          <LegalParagraph>
            取得した情報については、不正アクセス、漏えい、改ざん、滅失等を防ぐため、合理的な範囲で安全管理措置を講じます。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>8. 改定</LegalSectionTitle>
          <LegalParagraph>
            本ポリシーは、必要に応じて改定することがあります。改定後の内容は、本サービス上に掲載した時点から効力を生じます。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>9. お問い合わせ</LegalSectionTitle>
          <LegalParagraph>
            本サービスにおける情報の取り扱いに関するご質問やご相談先は、現在整備中です。窓口の案内は、準備が整い次第このページに掲載します。
          </LegalParagraph>
        </section>
      </Container>
    </LegalPageLayout>
  );
}
