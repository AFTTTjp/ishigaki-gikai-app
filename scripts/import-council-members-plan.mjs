/**
 * council-members/v1 の import 計画（純粋関数）と実行（クライアント注入）。
 *
 * 方針:
 * - create-only: 無い行だけ insert。既存行と値が違えばエラー（上書き・削除は一切しない）
 * - members は新規人物の (id, name, name_kana, address) だけを insert する。
 *   既存行は更新しない。legacy列(party / party_group / election_count)と
 *   birth_date には書き込まない
 * - 既存人物は member_id で DB 行を引き、氏名の完全一致を「安全確認」としてだけ使う
 *   （氏名で人物を探したり、ID を補ったりしない）
 */

import { splitAffiliationEntries } from "./import-council-members-validation.mjs";

function indexBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) map.set(keyFn(row), row);
  return map;
}

function sameValues(a, b, fields) {
  return fields.every((field) => (a[field] ?? null) === (b[field] ?? null));
}

/**
 * @param {object} doc 検証済みの council-members/v1
 * @param {null | {
 *   members: Array<{id: string, name: string}>,
 *   councilTerms: Array<{id: string, start_date: string, end_date: string}>,
 *   memberTerms: Array<object>,
 *   memberAffiliations: Array<object>,
 * }} dbState null なら DB 照合なし（offline）
 */
export function buildImportPlan(doc, dbState) {
  const errors = [];
  const online = dbState !== null;
  const councilStartByKey = new Map(
    doc.council_terms.map((term) => [term.key, term.start_date])
  );

  // --- members ---
  const membersToInsert = [];
  const membersVerified = [];
  const membersAlreadyPresent = [];
  const membersUnverified = [];
  const dbMembersById = online ? indexBy(dbState.members, (m) => m.id) : null;
  const dbMemberIdsByName = new Map();
  if (online) {
    for (const member of dbState.members) {
      dbMemberIdsByName.set(member.name, [
        ...(dbMemberIdsByName.get(member.name) ?? []),
        member.id,
      ]);
    }
  }

  for (const person of doc.persons) {
    const dbRow = dbMembersById?.get(person.member_id);

    if (person.kind === "existing") {
      if (!online) {
        membersUnverified.push(person.member_id);
      } else if (!dbRow) {
        errors.push(
          `existing member ${person.member_id} (${person.name}) not found in DB`
        );
      } else if (dbRow.name !== person.name) {
        errors.push(
          `existing member ${person.member_id}: DB name "${dbRow.name}" differs from source "${person.name}"`
        );
      } else {
        membersVerified.push(person.member_id);
      }
      continue;
    }

    // newcomer / historical
    if (dbRow) {
      if (dbRow.name === person.name) {
        membersAlreadyPresent.push(person.member_id);
      } else {
        errors.push(
          `member ${person.member_id}: DB name "${dbRow.name}" differs from source "${person.name}"`
        );
      }
      continue;
    }
    const sameName = dbMemberIdsByName.get(person.name);
    if (sameName && sameName.length > 0) {
      errors.push(
        `name collision: "${person.name}" already exists in DB with id ${sameName.join(", ")}; refusing to create a second person`
      );
      continue;
    }
    membersToInsert.push({
      id: person.member_id,
      name: person.name,
      name_kana: person.name_kana ?? null,
      address: person.address ?? null,
    });
  }

  // --- council_terms ---
  const councilTermsToInsert = [];
  const councilTermsUnchanged = [];
  const dbCouncilByStart = online
    ? indexBy(dbState.councilTerms, (t) => t.start_date)
    : null;
  for (const term of doc.council_terms) {
    const dbRow = dbCouncilByStart?.get(term.start_date);
    if (!dbRow) {
      councilTermsToInsert.push({
        start_date: term.start_date,
        end_date: term.end_date,
      });
    } else if (dbRow.end_date === term.end_date) {
      councilTermsUnchanged.push(term.key);
    } else {
      errors.push(
        `council_term ${term.start_date}: DB end_date ${dbRow.end_date} differs from source ${term.end_date}`
      );
    }
  }

  // --- member_terms ---
  const memberTermsToInsert = [];
  const memberTermsUnchanged = [];
  const dbCouncilIdToStart = online
    ? new Map(dbState.councilTerms.map((t) => [t.id, t.start_date]))
    : null;
  const dbMemberTermByKey = online
    ? indexBy(
        dbState.memberTerms,
        (t) => `${dbCouncilIdToStart.get(t.council_term_id)}::${t.member_id}`
      )
    : null;
  const termFields = ["seat_number", "election_count", "start_date", "end_date"];
  for (const term of doc.member_terms) {
    const start = councilStartByKey.get(term.council_term_key);
    const dbRow = dbMemberTermByKey?.get(`${start}::${term.member_id}`);
    const row = {
      council_term_key: term.council_term_key,
      member_id: term.member_id,
      seat_number: term.seat_number,
      election_count: term.election_count,
      start_date: term.start_date,
      end_date: term.end_date ?? null,
    };
    if (!dbRow) {
      memberTermsToInsert.push(row);
    } else if (sameValues(dbRow, row, termFields)) {
      memberTermsUnchanged.push(`${term.council_term_key}::${term.member_id}`);
    } else {
      errors.push(
        `member_term ${term.council_term_key}::${term.member_id}: DB values differ from source (create-only importer does not overwrite)`
      );
    }
  }

  // --- affiliations（ready のみ行になる。hold は件数のみ） ---
  const { ready, hold } = splitAffiliationEntries(doc);
  const affiliationsToInsert = [];
  const affiliationsUnchanged = [];
  const dbMemberTermIdByKey = online
    ? new Map(
        dbState.memberTerms.map((t) => [
          `${dbCouncilIdToStart.get(t.council_term_id)}::${t.member_id}`,
          t.id,
        ])
      )
    : null;
  const dbAffiliationByKey = online
    ? indexBy(dbState.memberAffiliations, (a) => `${a.member_term_id}::${a.valid_from}`)
    : null;
  for (const row of ready) {
    const start = councilStartByKey.get(row.council_term_key);
    const termId = dbMemberTermIdByKey?.get(`${start}::${row.member_id}`);
    const dbRow = termId
      ? dbAffiliationByKey.get(`${termId}::${row.valid_from}`)
      : undefined;
    if (!dbRow) {
      affiliationsToInsert.push(row);
    } else if (
      sameValues(dbRow, row, ["party", "party_group", "valid_to", "source_url"])
    ) {
      affiliationsUnchanged.push(`${row.member_id}::${row.valid_from}`);
    } else {
      errors.push(
        `member_affiliation ${row.member_id}::${row.valid_from}: DB values differ from source`
      );
    }
  }

  return {
    mode: online ? "online" : "offline",
    errors,
    councilStartByKey,
    members: {
      total: doc.persons.length,
      insert: membersToInsert,
      verified: membersVerified,
      alreadyPresent: membersAlreadyPresent,
      unverified: membersUnverified,
    },
    councilTerms: { insert: councilTermsToInsert, unchanged: councilTermsUnchanged },
    memberTerms: { insert: memberTermsToInsert, unchanged: memberTermsUnchanged },
    affiliations: {
      snapshotTotal: doc.affiliation_entries.length,
      readyInsert: affiliationsToInsert,
      readyUnchanged: affiliationsUnchanged,
      holdCount: hold.length,
    },
  };
}

/** dry-run 用の人が読める要約 */
export function formatPlanSummary(plan) {
  const lines = [
    `モード: ${plan.mode === "online" ? "DB照合あり（read-only）" : "offline（DB照合なし）"}`,
    `members: 人物 ${plan.members.total} 件 / 追加予定 ${plan.members.insert.length} / DB確認済み(既存) ${plan.members.verified.length} / 既に存在 ${plan.members.alreadyPresent.length} / 未照合 ${plan.members.unverified.length}`,
    `council_terms: 追加予定 ${plan.councilTerms.insert.length} / 変更なし ${plan.councilTerms.unchanged.length}`,
    `member_terms: 追加予定 ${plan.memberTerms.insert.length} / 変更なし ${plan.memberTerms.unchanged.length}`,
    `member_affiliations: スナップショット ${plan.affiliations.snapshotTotal} / ready(DB行になる) ${plan.affiliations.readyInsert.length + plan.affiliations.readyUnchanged.length} / hold(DB行にならない) ${plan.affiliations.holdCount}`,
    `エラー: ${plan.errors.length} 件`,
  ];
  for (const error of plan.errors) lines.push(`  ✗ ${error}`);
  return lines.join("\n");
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).insert(rows);
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
}

async function selectRows(client, table, columns) {
  const { data, error } = await client.from(table).select(columns);
  if (error) throw new Error(`${table} select failed: ${error.message}`);
  return data ?? [];
}

/**
 * 計画を実行する。insert のみ（update / delete / upsert は使わない）。
 * @param {ReturnType<typeof buildImportPlan>} plan online で errors が空のもの
 * @param {{ from: (table: string) => { insert: Function, select: Function } }} client
 */
export async function executeImportPlan(plan, client) {
  if (plan.mode !== "online") {
    throw new Error("refusing to execute an offline (unverified) plan");
  }
  if (plan.errors.length > 0) {
    throw new Error(
      `refusing to execute a plan with ${plan.errors.length} error(s)`
    );
  }

  await insertRows(client, "members", plan.members.insert);
  await insertRows(client, "council_terms", plan.councilTerms.insert);

  const councilRows = await selectRows(client, "council_terms", "id, start_date");
  const councilIdByStart = new Map(councilRows.map((r) => [r.start_date, r.id]));
  const councilIdByKey = (key) =>
    councilIdByStart.get(plan.councilStartByKey.get(key));

  const memberTermRows = plan.memberTerms.insert.map((row) => {
    const councilTermId = councilIdByKey(row.council_term_key);
    if (!councilTermId) {
      throw new Error(`council_term not found for key "${row.council_term_key}"`);
    }
    return {
      council_term_id: councilTermId,
      member_id: row.member_id,
      seat_number: row.seat_number,
      election_count: row.election_count,
      start_date: row.start_date,
      end_date: row.end_date,
    };
  });
  await insertRows(client, "member_terms", memberTermRows);

  if (plan.affiliations.readyInsert.length > 0) {
    const termRows = await selectRows(
      client,
      "member_terms",
      "id, council_term_id, member_id"
    );
    const termIdByPair = new Map(
      termRows.map((r) => [`${r.council_term_id}::${r.member_id}`, r.id])
    );
    const affiliationRows = plan.affiliations.readyInsert.map((row) => {
      const termId = termIdByPair.get(
        `${councilIdByKey(row.council_term_key)}::${row.member_id}`
      );
      if (!termId) {
        throw new Error(`member_term not found for ${row.member_id}`);
      }
      return {
        member_term_id: termId,
        party: row.party,
        party_group: row.party_group,
        valid_from: row.valid_from,
        valid_to: row.valid_to,
        source_url: row.source_url,
      };
    });
    await insertRows(client, "member_affiliations", affiliationRows);
  }

  return {
    members: plan.members.insert.length,
    councilTerms: plan.councilTerms.insert.length,
    memberTerms: memberTermRows.length,
    affiliations: plan.affiliations.readyInsert.length,
  };
}
