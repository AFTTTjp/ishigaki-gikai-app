/**
 * bill_member_votes.member_term_id の backfill 計画（純粋関数・dry-run専用）。
 *
 * vote → bill → diet_session の期間と member_id から member_term を決める。
 * 一意に決まらない票は更新候補にせず unresolved に理由付きで残す（fail-closed）。
 * このモジュールは DB を読み書きしない。更新は別フェーズで、この計画を人が確認してから行う。
 */

export const UNRESOLVED_REASONS = Object.freeze({
  billNotFound: "bill_not_found",
  noDietSession: "bill_has_no_diet_session",
  dietSessionNotFound: "diet_session_not_found",
  noMemberTerm: "no_member_term_overlapping_session",
  multipleMemberTerms: "multiple_member_term_candidates",
  spansBoundary: "session_spans_member_term_boundary",
  existingMismatch: "existing_member_term_id_differs_from_plan",
});

/**
 * @param {{
 *   votes: Array<{bill_id: string, member_id: string, member_term_id: string | null}>,
 *   bills: Array<{id: string, diet_session_id: string | null}>,
 *   dietSessions: Array<{id: string, start_date: string, end_date: string}>,
 *   memberTerms: Array<{id: string, member_id: string, council_term_id: string, start_date: string, end_date: string | null}>,
 *   councilTerms: Array<{id: string, end_date: string}>,
 * }} input
 */
export function planMemberTermVoteBackfill(input) {
  const billsById = new Map(input.bills.map((b) => [b.id, b]));
  const sessionsById = new Map(input.dietSessions.map((s) => [s.id, s]));
  const councilEndById = new Map(
    input.councilTerms.map((t) => [t.id, t.end_date])
  );
  const termsByMember = new Map();
  for (const term of input.memberTerms) {
    termsByMember.set(term.member_id, [
      ...(termsByMember.get(term.member_id) ?? []),
      term,
    ]);
  }

  const updates = [];
  const alreadySet = [];
  const unresolved = [];

  for (const vote of input.votes) {
    const ref = { bill_id: vote.bill_id, member_id: vote.member_id };
    const reject = (reason) => unresolved.push({ ...ref, reason });

    const bill = billsById.get(vote.bill_id);
    if (!bill) {
      reject(UNRESOLVED_REASONS.billNotFound);
      continue;
    }
    if (!bill.diet_session_id) {
      reject(UNRESOLVED_REASONS.noDietSession);
      continue;
    }
    const session = sessionsById.get(bill.diet_session_id);
    if (!session) {
      reject(UNRESOLVED_REASONS.dietSessionNotFound);
      continue;
    }

    // 会期と期間が重なる member_term を候補にする
    const candidates = (termsByMember.get(vote.member_id) ?? []).filter(
      (term) => {
        const termEnd = term.end_date ?? councilEndById.get(term.council_term_id);
        return (
          termEnd !== undefined &&
          term.start_date <= session.end_date &&
          termEnd >= session.start_date
        );
      }
    );

    if (candidates.length === 0) {
      reject(UNRESOLVED_REASONS.noMemberTerm);
      continue;
    }
    if (candidates.length > 1) {
      reject(UNRESOLVED_REASONS.multipleMemberTerms);
      continue;
    }

    const [term] = candidates;
    const termEnd = term.end_date ?? councilEndById.get(term.council_term_id);
    const coversWholeSession =
      term.start_date <= session.start_date && termEnd >= session.end_date;
    if (!coversWholeSession) {
      reject(UNRESOLVED_REASONS.spansBoundary);
      continue;
    }

    if (vote.member_term_id === null) {
      updates.push({ ...ref, member_term_id: term.id });
    } else if (vote.member_term_id === term.id) {
      alreadySet.push(ref);
    } else {
      reject(UNRESOLVED_REASONS.existingMismatch);
    }
  }

  return { updates, alreadySet, unresolved };
}
