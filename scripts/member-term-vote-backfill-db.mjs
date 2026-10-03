import { planMemberTermVoteBackfill } from "./plan-member-term-vote-backfill.mjs";

export async function selectAll(client, table, columns) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to read ${table}: ${error.message}`);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}

export async function loadMemberTermVoteBackfillPlan(client) {
  const [votes, bills, dietSessions, memberTerms, councilTerms] =
    await Promise.all([
      selectAll(
        client,
        "bill_member_votes",
        "bill_id, member_id, member_term_id"
      ),
      selectAll(client, "bills", "id, diet_session_id"),
      selectAll(client, "diet_sessions", "id, start_date, end_date"),
      selectAll(
        client,
        "member_terms",
        "id, member_id, council_term_id, start_date, end_date"
      ),
      selectAll(client, "council_terms", "id, end_date"),
    ]);

  return {
    votes,
    bills,
    dietSessions,
    memberTerms,
    councilTerms,
    plan: planMemberTermVoteBackfill({
      votes,
      bills,
      dietSessions,
      memberTerms,
      councilTerms,
    }),
  };
}
