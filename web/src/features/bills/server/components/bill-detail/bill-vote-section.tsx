import Link from "next/link";
import type { Route } from "next";
import { routes } from "@/lib/routes";
import {
  BILL_VOTE_TYPE_LABELS,
  type BillMemberVote,
  type BillVoteType,
  type BillWithContent,
} from "../../../shared/types";

const DISPLAY_ORDER: BillVoteType[] = [
  "for",
  "not_for",
  "left",
  "absent",
  "chair",
];

const SECTION_STYLES: Record<BillVoteType, string> = {
  for: "border-emerald-300 bg-white",
  not_for: "border-amber-300 bg-white",
  left: "border-slate-300 bg-white",
  absent: "border-slate-300 bg-white",
  chair: "border-slate-300 bg-white",
};

function groupVotesByType(votes: BillMemberVote[]) {
  return DISPLAY_ORDER.map((voteType) => ({
    voteType,
    votes: votes.filter((vote) => vote.vote_type === voteType),
  })).filter((group) => group.votes.length > 0);
}

export function BillVoteSection({ bill }: { bill: BillWithContent }) {
  const votes = bill.bill_member_votes ?? [];

  if (votes.length === 0) {
    return null;
  }

  const groupedVotes = groupVotesByType(votes);
  const source = votes.find((vote) => vote.source_url || vote.source_label);

  return (
    <section className="my-10">
      <div className="mb-4">
        <h2 className="mb-3 text-[22px] font-bold">採決での各議員の状況</h2>
        <p className="text-sm leading-7 text-gray-700">
          石垣市議会の公開資料に基づき、この議案の採決で各議員がどう扱われたかを掲載しています。
          公開資料では
          <span className="font-medium">「△ = 賛成ではない」</span>
          とされており、反対や棄権などの内訳はこの資料だけでは区別していません。
        </p>
        {source?.source_url ? (
          <p className="mt-2 text-sm text-gray-600">
            出典:{" "}
            <a
              href={source.source_url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:opacity-70"
            >
              {source.source_label ?? "議案に対する賛成者一覧 PDF"}
            </a>
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groupedVotes.map((group) => (
          <section
            key={group.voteType}
            className={`rounded-2xl border p-5 ${SECTION_STYLES[group.voteType]}`}
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900">
                {BILL_VOTE_TYPE_LABELS[group.voteType]}
              </h3>
              <span className="text-sm font-medium text-slate-600">
                {group.votes.length}人
              </span>
            </div>

            <ul className="space-y-2">
              {group.votes.map((vote) => (
                <li
                  key={`${group.voteType}-${vote.member.id}`}
                  className="rounded-xl bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={routes.memberDetail(vote.member.id) as Route}
                      className="font-semibold text-slate-900 underline-offset-2 hover:underline hover:text-slate-700"
                    >
                      {vote.member.name}
                    </Link>
                    <div className="text-xs font-medium text-slate-500">
                      議席番号 {vote.member.seat_number}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
