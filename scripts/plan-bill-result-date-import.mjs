function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateVoteResultsArtifact(doc) {
  if (!doc || typeof doc !== "object") {
    throw new Error("artifact must be an object");
  }
  if (doc.schema !== "vote-results/review-v1") {
    throw new Error(`unsupported schema: ${doc.schema ?? "(missing)"}`);
  }
  if (!doc.session || typeof doc.session.slug !== "string" || !doc.session.slug) {
    throw new Error("session.slug is required");
  }
  if (!Array.isArray(doc.bills) || doc.bills.length === 0) {
    throw new Error("bills must be a non-empty array");
  }

  const seenNumbers = new Set();
  const seenNames = new Set();
  const targets = [];

  for (const bill of doc.bills) {
    if (
      typeof bill.bill_number !== "string" ||
      !/^議案第\d+号$/.test(bill.bill_number)
    ) {
      throw new Error(`invalid bill_number: ${bill.bill_number ?? "(missing)"}`);
    }
    if (seenNumbers.has(bill.bill_number)) {
      throw new Error(`duplicate bill_number: ${bill.bill_number}`);
    }
    seenNumbers.add(bill.bill_number);

    if (typeof bill.bill_name !== "string" || !bill.bill_name.trim()) {
      throw new Error(`bill_name is required: ${bill.bill_number}`);
    }

    const expectedDbName = `${bill.bill_number} ${bill.bill_name}`;
    if (seenNames.has(expectedDbName)) {
      throw new Error(`duplicate expected bill name: ${expectedDbName}`);
    }
    seenNames.add(expectedDbName);

    if (!isIsoDate(bill.result_date)) {
      throw new Error(
        `invalid result_date for ${bill.bill_number}: ${bill.result_date ?? "(missing)"}`
      );
    }
    if (bill.needs_review !== false) {
      throw new Error(`needs_review must be false: ${bill.bill_number}`);
    }
    if (bill.confidence !== "high") {
      throw new Error(`confidence must be high: ${bill.bill_number}`);
    }
    if (
      !bill.source_ref ||
      !["official_html", "official_pdf"].includes(bill.source_ref.source_kind) ||
      !isHttpsUrl(bill.source_ref.url)
    ) {
      throw new Error(`official HTTPS source_ref is required: ${bill.bill_number}`);
    }

    targets.push({
      bill_number: bill.bill_number,
      bill_name: bill.bill_name,
      expected_db_name: expectedDbName,
      result_date: bill.result_date,
      source_ref: bill.source_ref,
    });
  }

  return {
    session_slug: doc.session.slug,
    targets,
  };
}

export function planBillResultDateImport({
  artifact,
  dietSessions,
  bills,
}) {
  const validated = validateVoteResultsArtifact(artifact);

  const sessions = dietSessions.filter(
    (session) => session.slug === validated.session_slug
  );

  if (sessions.length !== 1) {
    return {
      updates: [],
      alreadySet: [],
      unresolved: [
        {
          reason:
            sessions.length === 0
              ? "diet_session_not_found"
              : "multiple_diet_sessions_found",
          session_slug: validated.session_slug,
        },
      ],
    };
  }

  const session = sessions[0];
  const sessionBills = bills.filter(
    (bill) => bill.diet_session_id === session.id
  );

  const updates = [];
  const alreadySet = [];
  const unresolved = [];

  for (const target of validated.targets) {
    if (
      target.result_date < session.start_date ||
      target.result_date > session.end_date
    ) {
      unresolved.push({
        ...target,
        reason: "result_date_outside_session",
        session_start_date: session.start_date,
        session_end_date: session.end_date,
      });
      continue;
    }

    const matches = sessionBills.filter(
      (bill) =>
        bill.name === target.expected_db_name &&
        bill.document_type === "bill"
    );

    if (matches.length === 0) {
      unresolved.push({
        ...target,
        reason: "bill_exact_match_not_found",
      });
      continue;
    }

    if (matches.length > 1) {
      unresolved.push({
        ...target,
        reason: "multiple_exact_bill_matches",
      });
      continue;
    }

    const bill = matches[0];

    if (bill.result_date === null) {
      updates.push({
        bill_id: bill.id,
        bill_name: bill.name,
        result_date: target.result_date,
        bill_number: target.bill_number,
      });
      continue;
    }

    if (bill.result_date === target.result_date) {
      alreadySet.push({
        bill_id: bill.id,
        bill_name: bill.name,
        result_date: bill.result_date,
        bill_number: target.bill_number,
      });
      continue;
    }

    unresolved.push({
      ...target,
      bill_id: bill.id,
      db_result_date: bill.result_date,
      reason: "existing_result_date_conflict",
    });
  }

  return { updates, alreadySet, unresolved };
}
