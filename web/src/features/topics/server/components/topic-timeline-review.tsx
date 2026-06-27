import "server-only";
import type { TopicTimelineReview as TopicTimelineReviewData } from "../../shared/types";

interface TopicTimelineReviewProps {
  timelineReview: TopicTimelineReviewData;
}

function getStatusLabel(
  status: TopicTimelineReviewData["timeline_items"][number]["status"]
) {
  switch (status) {
    case "confirmed":
      return "確認済み";
    case "candidate":
      return "確認中";
    default:
      return "要確認";
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function TopicTimelineReview({
  timelineReview,
}: TopicTimelineReviewProps) {
  if (timelineReview.timeline_items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[22px] font-bold text-slate-900">
            この話題の流れ（試作）
          </h2>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            Review
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Event Graph review artifact から整理した下書きです。
          「確認中」は根拠接続の確認が残っている項目です。
        </p>
      </div>

      <div className="divide-y divide-slate-200 rounded-2xl bg-white px-4">
        {timelineReview.timeline_items.map((item) => (
          <article key={`${item.date}:${item.title}`} className="py-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {item.label}
                </span>
                <span
                  className={
                    item.status === "confirmed"
                      ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800"
                      : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800"
                  }
                >
                  {getStatusLabel(item.status)}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {formatDate(item.date)}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-[15px] leading-7 text-slate-600">
                  {item.summary}
                </p>
              </div>

              <details className="rounded-xl bg-slate-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  根拠を見る
                </summary>
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  {item.evidence_ids.length > 0 ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-800">
                        Evidence IDs
                      </p>
                      <ul className="list-disc space-y-1 pl-5">
                        {item.evidence_ids.map((evidenceId) => (
                          <li key={evidenceId} className="break-all">
                            <code>{evidenceId}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-slate-500">
                      Speech evidence はまだ接続されていません。
                    </p>
                  )}

                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800">Source refs</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {item.source_refs.map((sourceRef) => (
                        <li
                          key={`${sourceRef.source_path}:${sourceRef.source_locator}`}
                        >
                          <span className="font-medium">
                            {sourceRef.source_kind}
                          </span>
                          : <code>{sourceRef.source_path}</code>
                          <span className="text-slate-500">
                            {" "}
                            ({sourceRef.source_locator})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          </article>
        ))}
      </div>

      {timelineReview.review_required.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-5 py-4">
          <h3 className="text-sm font-bold text-amber-900">確認メモ</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
            {timelineReview.review_required.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
