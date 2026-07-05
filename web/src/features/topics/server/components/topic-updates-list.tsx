import { formatUpdateDate } from "../../shared/utils/format-update-date";
import type { TopicUpdate } from "../../shared/types";

interface TopicUpdatesListProps {
  updates: TopicUpdate[];
}

function getKindLabel(kind: TopicUpdate["kind"]) {
  switch (kind) {
    case "news":
      return "ニュース";
    case "council":
      return "議会";
    case "progress":
      return "進捗";
    case "decision":
      return "決定";
    default:
      return kind;
  }
}

export function TopicUpdatesList({ updates }: TopicUpdatesListProps) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-[22px] font-bold text-slate-900">これまでの流れ</h2>
        <p className="text-sm text-slate-500">
          テーマに関する議会動向や進捗を時系列で整理しています。
        </p>
      </div>

      {updates.length > 0 ? (
        <div className="divide-y divide-slate-200 rounded-2xl bg-white px-4">
          {updates.map((update, index) => (
            <article key={update.id} className="relative py-6">
              {index === 0 ? (
                <span className="absolute right-0 top-6 rounded-full bg-primary-accent px-3 py-1 text-[11px] font-bold tracking-[0.08em] text-white">
                  最新
                </span>
              ) : null}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {getKindLabel(update.kind)}
                  </span>
                  {update.status_label ? (
                    <span className="rounded-full bg-stance-for-badge-end px-3 py-1 text-xs font-bold text-primary-accent">
                      {update.status_label}
                    </span>
                  ) : null}
                  <span className="text-xs font-medium text-slate-400">
                    {formatUpdateDate(update.published_at)}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    {update.title}
                  </h3>
                  <p className="text-[15px] leading-7 text-slate-600">
                    {update.summary}
                  </p>
                  {update.content ? (
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-500">
                      {update.content}
                    </p>
                  ) : null}
                </div>

                {update.source_url ? (
                  <div className="text-sm">
                    <a
                      href={update.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary-accent underline underline-offset-4"
                    >
                      {update.source_label || "関連リンク"}
                    </a>
                  </div>
                ) : update.source_label ? (
                  <p className="text-sm font-medium text-slate-500">
                    {update.source_label}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white px-5 py-8 text-center text-slate-500">
          まだ更新履歴はありません。
        </div>
      )}
    </section>
  );
}
