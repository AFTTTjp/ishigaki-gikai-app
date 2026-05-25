import "server-only";
import { getCouncilActionKindLabel } from "../../shared/constants/council-action-kind-labels";
import type { CouncilAction } from "../../shared/types";

interface TopicCouncilActionsProps {
  councilActions: CouncilAction[];
}

function formatActionDate(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function TopicCouncilActions({
  councilActions,
}: TopicCouncilActionsProps) {
  if (councilActions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-[22px] font-bold text-slate-900">
          議会のアクション
        </h2>
        <p className="text-sm text-slate-500">
          このテーマに関して、議会が行った要請活動・申し入れ・意見書提出などの活動記録です。
        </p>
      </div>

      <div className="divide-y divide-slate-200 rounded-2xl bg-white px-4">
        {councilActions.map((action) => (
          <article key={action.id} className="py-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-accent/10 px-3 py-1 text-xs font-bold text-primary-accent">
                  {getCouncilActionKindLabel(action.kind)}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {formatActionDate(action.action_date)}
                </span>
              </div>

              <p className="text-sm font-bold text-slate-800">{action.title}</p>

              <p className="text-sm leading-6 text-slate-500">
                宛先: {action.destination_name}
                {action.destination_body
                  ? `（${action.destination_body}）`
                  : null}
              </p>

              {action.description ? (
                <p className="text-sm leading-6 text-slate-500">
                  {action.description}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {action.official_url ? (
                  <a
                    href={action.official_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-medium text-primary-accent underline underline-offset-4"
                  >
                    公式資料
                  </a>
                ) : null}
                {action.source_url ? (
                  <a
                    href={action.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-medium text-primary-accent underline underline-offset-4"
                  >
                    出典
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
