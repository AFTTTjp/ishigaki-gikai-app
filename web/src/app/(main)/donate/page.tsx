import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layouts/container";
import { EXTERNAL_LINKS } from "@/config/external-links";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "AFTTT のご案内 | みらい議会@石垣市",
  description: "本サイトと AFTTT の関係についてのご案内",
};

export default function DonatePage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <header className="space-y-4">
          <p className="text-sm font-bold tracking-[0.08em] text-primary-accent">
            NOTICE
          </p>
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold tracking-[0.02em] text-slate-900">
              AFTTT のご案内
            </h1>
            <p className="max-w-3xl text-[15px] leading-8 text-slate-700">
              みらい議会@石垣市は、AFTTT
              が運営する民間の情報提供サイトです。このサイト上では寄付・支援の受付は行っていません。
            </p>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-7">
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">
              このサイトと AFTTT について
            </h2>
            <p className="text-sm leading-7 text-slate-600">
              みらい議会
              石垣市議会版は、石垣市議会に関する公開情報を市民のみなさんが見やすく確認できるようにするために、AFTTT
              が独自に整理・運営しているプロジェクトです。
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-7">
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">支援について</h2>
            <p className="text-sm leading-7 text-slate-600">
              AFTTT 全体の活動や運営について知りたい場合は、AFTTT
              の公式サイトをご確認ください。このサイトでは、石垣市役所や石垣市議会の公式と誤解されないよう、寄付募集への直接導線は設けていません。
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-slate-700">
              <Link
                href={EXTERNAL_LINKS.AFTTT}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:opacity-70"
              >
                AFTTT 公式サイトへ
              </Link>
            </div>
          </div>
        </section>

        <div>
          <Link
            href={routes.home()}
            className="inline-flex items-center justify-center rounded-full border border-slate-900 px-6 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
          >
            トップページへ戻る
          </Link>
        </div>
      </div>
    </Container>
  );
}
