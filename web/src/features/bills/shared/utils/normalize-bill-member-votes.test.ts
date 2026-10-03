import { describe, expect, it } from "vitest";
import { normalizeBillMemberVoteRows } from "./normalize-bill-member-votes";

describe("normalizeBillMemberVoteRows", () => {
  it("member_term_id と採決時点の議席番号を保持する", () => {
    const result = normalizeBillMemberVoteRows([
      {
        member_term_id: "term-1",
        seat_number: 7,
        vote_type: "for",
        source_label: "source",
        source_url: "https://example.com/source",
        members: { id: "member-1", name: "議員A" },
      },
    ]);

    expect(result).toEqual([
      {
        member_term_id: "term-1",
        vote_type: "for",
        source_label: "source",
        source_url: "https://example.com/source",
        member: {
          id: "member-1",
          name: "議員A",
          seat_number: 7,
        },
      },
    ]);
  });

  it("legacy の party / party_group を採決表示データへ混ぜない", () => {
    const [vote] = normalizeBillMemberVoteRows([
      {
        member_term_id: null,
        seat_number: 3,
        vote_type: "not_for",
        source_label: null,
        source_url: null,
        members: [{ id: "member-2", name: "議員B" }],
      },
    ]);

    expect(vote.member).toEqual({
      id: "member-2",
      name: "議員B",
      seat_number: 3,
    });
    expect("party" in vote.member).toBe(false);
    expect("party_group" in vote.member).toBe(false);
  });

  it("JOIN先の member が無い行は表示対象にしない", () => {
    expect(
      normalizeBillMemberVoteRows([
        {
          member_term_id: "term-3",
          seat_number: 9,
          vote_type: "absent",
          source_label: null,
          source_url: null,
          members: null,
        },
      ])
    ).toEqual([]);
  });
});
