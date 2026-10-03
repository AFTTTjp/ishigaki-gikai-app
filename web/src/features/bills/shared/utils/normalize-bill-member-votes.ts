import type { BillMemberVote, BillVoteType } from "../types";

export type BillMemberVoteRow = {
  member_term_id: string | null;
  seat_number: number;
  vote_type: BillVoteType;
  source_label: string | null;
  source_url: string | null;
  members:
    | { id: string; name: string }
    | Array<{ id: string; name: string }>
    | null;
};

/**
 * bill_member_votes のDB行をUI用の型へ正規化する。
 *
 * 採決時点の所属を確定できる日付基盤がまだ無いため、
 * legacy members.party / party_group はここでは扱わない。
 */
export function normalizeBillMemberVoteRows(
  rows: BillMemberVoteRow[]
): BillMemberVote[] {
  return rows.flatMap((row) => {
    const member = Array.isArray(row.members) ? row.members[0] : row.members;

    if (!member) {
      return [];
    }

    return [
      {
        member_term_id: row.member_term_id,
        vote_type: row.vote_type,
        source_label: row.source_label,
        source_url: row.source_url,
        member: {
          id: member.id,
          name: member.name,
          seat_number: row.seat_number,
        },
      },
    ];
  });
}
