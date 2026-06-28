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

function getDisplaySummary(
  item: TopicTimelineReviewData["timeline_items"][number]
) {
  switch (item.event_type) {
    case "bill_introduction":
      return "この話題に関わる議案が会期の初日に提出されました。";
    case "committee_referral":
      return "この議案は委員会で詳しく審査されることになりました。";
    case "committee_discussion":
      return "委員会で、参加経費や条件について説明が行われたことを確認しています。";
    case "general_question":
      return "本会議の一般質問で、この話題が取り上げられました。";
    default:
      return item.summary;
  }
}

function getSourceKindLabel(sourceKind: string) {
  switch (sourceKind) {
    case "session_overview":
      return "会期ページ用メモ";
    case "topic_json":
      return "トピック下書き";
    case "speech_canonical":
      return "発言の根拠";
    case "issue_graph_v2_review":
      return "論点レビュー";
    default:
      return sourceKind;
  }
}

function getEvidenceEmptyLabel(
  item: TopicTimelineReviewData["timeline_items"][number]
) {
  if (item.status === "candidate") {
    return "この項目は、会期資料やトピック下書きをもとに整理しています。発言単位の根拠づけは確認中です。";
  }

  return "この項目に紐づく発言の根拠は、まだ表示できる形で整理されていません。";
}

function getDisplayReviewNotes(notes: string[]) {
  const mapped = notes.flatMap((note) => {
    if (note.includes("vote event")) {
      return ["採決結果は、この試作タイムラインにはまだ反映していません。"];
    }
    if (note.includes("candidate items should not be treated as confirmed")) {
      return [
        "「確認中」と表示している項目は、関連資料との照合が残っています。",
      ];
    }
    if (
      note.includes(
        "bill_introduction / committee_referral / committee_discussion"
      )
    ) {
      return ["会期初日や委員会の動きは、公開資料をもとに整理しています。"];
    }
    if (note.includes("committee discussion details remain review-first")) {
      return [
        "委員会での説明内容は、より確かな一次資料との照合を続けています。",
      ];
    }
    if (note.includes("UI integration is not implemented")) {
      return [];
    }

    return [note];
  });

  return [...new Set(mapped)];
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
            試作
          </span>
        </div>
        <p className="text-sm text-slate-500">
          この話題が会期中にどう進んだかを、公開資料と議事録の根拠をもとに時系列で整理しています。
          「確認中」は、関連する資料や発言との照合が残っている項目です。
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
                  {getDisplaySummary(item)}
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
                        発言の根拠ID
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
                      {getEvidenceEmptyLabel(item)}
                    </p>
                  )}

                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800">参照元</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {item.source_refs.map((sourceRef) => (
                        <li
                          key={`${sourceRef.source_path}:${sourceRef.source_locator}`}
                        >
                          <span className="font-medium">
                            {getSourceKindLabel(sourceRef.source_kind)}
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

      {getDisplayReviewNotes(timelineReview.review_required).length > 0 ? (
        <details className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-5 py-4">
          <summary className="cursor-pointer text-sm font-bold text-amber-900">
            この表示について
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
            {getDisplayReviewNotes(timelineReview.review_required).map(
              (note) => (
                <li key={note}>{note}</li>
              )
            )}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
