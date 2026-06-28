import "server-only";
import type { TopicTimelineReview as TopicTimelineReviewData } from "../../shared/types";

interface TopicTimelineReviewProps {
  timelineReview: TopicTimelineReviewData;
}

interface TimelineSourceDisplay {
  label: string;
  description: string;
}

function getStatusLabel(
  status: TopicTimelineReviewData["timeline_items"][number]["status"]
) {
  switch (status) {
    case "confirmed":
      return "確認済み";
    case "candidate":
      return "照合中";
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

function getCommitteeName(text: string) {
  const match = text.match(/(総務財政委員会|経済民生委員会|建設土木委員会)/);
  return match?.[1] ?? null;
}

function getBillNumber(text: string) {
  const match = text.match(/(議案第\d+号)/);
  return match?.[1] ?? null;
}

function getQuestionSpeaker(title: string) {
  const match = title.match(/^(.+?)議員が/);
  return match ? `${match[1]}議員` : null;
}

function getGeneralQuestionSourceDescription(
  item: TopicTimelineReviewData["timeline_items"][number]
) {
  const speaker = getQuestionSpeaker(item.title);
  if (speaker) {
    return `${speaker}がこの話題について行った一般質問をもとにしています。`;
  }

  return "この話題に関する一般質問をもとにしています。";
}

function getBillSourceDescription(
  item: TopicTimelineReviewData["timeline_items"][number]
) {
  const billNumber = getBillNumber(item.title);
  if (billNumber) {
    return `${billNumber}として提出された議案資料をもとにしています。`;
  }

  return "この話題に関する議案資料をもとにしています。";
}

function getCommitteeSourceDescription(
  item: TopicTimelineReviewData["timeline_items"][number]
) {
  const committeeName = getCommitteeName(item.title);
  if (item.event_type === "committee_referral") {
    if (committeeName) {
      return `${committeeName}で審査されることが会期資料で確認できます。`;
    }
    return "委員会で審査されることが会期資料で確認できます。";
  }

  if (committeeName) {
    return `${committeeName}で担当課から説明があった内容をもとに整理しています。`;
  }

  return "委員会での説明内容をもとに整理しています。";
}

function getFallbackSourceDescription(
  item: TopicTimelineReviewData["timeline_items"][number]
) {
  if (item.status === "candidate") {
    return "会期資料やトピック整理資料をもとに整理しています。";
  }

  return "関連資料をもとに整理しています。";
}

function getSourceDisplays(
  item: TopicTimelineReviewData["timeline_items"][number]
) {
  const sourceKinds = new Set(
    item.source_refs.map((sourceRef) => sourceRef.source_kind)
  );
  const displays: TimelineSourceDisplay[] = [];

  switch (item.event_type) {
    case "bill_introduction":
      displays.push({
        label: "📄 議案",
        description: getBillSourceDescription(item),
      });
      break;
    case "committee_referral":
    case "committee_discussion":
      displays.push({
        label: "🏛 委員会",
        description: getCommitteeSourceDescription(item),
      });
      break;
    case "general_question":
      displays.push({
        label: "🗣 一般質問",
        description: getGeneralQuestionSourceDescription(item),
      });
      break;
    default:
      break;
  }

  if (sourceKinds.has("session_overview")) {
    displays.push({
      label: "📘 会期資料",
      description: "会期全体の公開資料をもとに整理しています。",
    });
  }

  if (sourceKinds.has("topic_json")) {
    displays.push({
      label: "🗂 トピック整理資料",
      description: "この話題について整理した資料をもとにしています。",
    });
  }

  if (displays.length === 0) {
    displays.push({
      label: "📎 関連資料",
      description: getFallbackSourceDescription(item),
    });
  }

  return displays;
}

function getDisplayReviewNotes() {
  return [
    "「確認済み」は、公開資料や議事録で確認できた内容です。",
    "「照合中」は、発言単位の根拠や一次資料との照合を続けている項目です。",
    "内容は確認が進み次第更新します。",
  ];
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
        <h2 className="text-[22px] font-bold text-slate-900">この話題の流れ</h2>
        <p className="text-sm text-slate-500">
          この話題が会期中にどう進んだかを、公開資料や議事録をもとに時系列で整理しています。
          「照合中」は、発言単位の根拠や一次資料との照合を続けている項目です。
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
                  情報源を見る
                </summary>
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  <div className="space-y-2">
                    {getSourceDisplays(item).map((sourceDisplay) => (
                      <div
                        key={`${item.date}:${item.title}:${sourceDisplay.label}`}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {sourceDisplay.label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {sourceDisplay.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </article>
        ))}
      </div>

      {timelineReview.review_required.length > 0 ? (
        <details className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-5 py-4">
          <summary className="cursor-pointer text-sm font-bold text-amber-900">
            この表示について
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
            {getDisplayReviewNotes().map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
