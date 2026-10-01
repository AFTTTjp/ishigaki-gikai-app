/**
 * 議員・議会任期データ(council-members/v1)の検証と、DB行への変換（純粋関数）。
 *
 * 方針:
 * - fail-closed: 1件でも問題があれば import しない
 * - 人物の識別は member_id(UUID)のみ。氏名による照合・補完は行わない
 * - effective_from が一次資料で確定していない所属は DB行に変換しない（hold）
 */

export const SCHEMA_VERSION = "council-members/v1";

/** Phase 2A で確定している完全性の期待値 */
export const PHASE_2A_EXPECTED = Object.freeze({
  persons: { total: 27, existing: 22, newcomer: 4, historical: 1 },
  councilTerms: [
    { start_date: "2022-09-28", end_date: "2026-09-27" },
    { start_date: "2026-09-28", end_date: "2030-09-27" },
  ],
  memberTermsByCouncilTerm: { "2022-09-28": 23, "2026-09-28": 22 },
  currentSeatCount: 22,
  councilSeatCapacity: 22,
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const PERSON_KINDS = ["existing", "newcomer", "historical"];
const ENTRY_STATUSES = ["ready", "hold"];

const ALLOWED_KEYS = {
  root: [
    "schema_version",
    "description",
    "production_import_gate",
    "sources",
    "council_terms",
    "persons",
    "member_terms",
    "affiliation_entries",
    "source_discrepancies",
    "holds",
  ],
  gate: ["status", "reason"],
  source: [
    "id",
    "label",
    "url",
    "page_updated_on",
    "as_of",
    "retrieved_on",
    "verification_note",
  ],
  councilTerm: ["key", "start_date", "end_date", "source_ids"],
  // birth_date は意図的に許可しない（公式が生年のみの場合に合成しない）
  person: [
    "member_id",
    "kind",
    "name",
    "name_kana",
    "address",
    "birth_year_label",
    "legacy_source",
    "source_ids",
  ],
  memberTerm: [
    "council_term_key",
    "member_id",
    "seat_number",
    "election_count",
    "start_date",
    "end_date",
    "source_ids",
    "holds",
  ],
  entry: [
    "council_term_key",
    "member_id",
    "party",
    "party_group",
    "party_group_basis",
    "party_observed_on",
    "party_group_observed_on",
    "caucus_formed_on",
    "effective_from",
    "effective_to",
    "party_source_id",
    "party_group_source_ids",
    "status",
    "hold_reason",
    "source_url",
  ],
  discrepancy: ["member_id", "field", "observations", "resolved_value", "resolution"],
  hold: ["scope", "subject", "field", "reason", "needed_source"],
};

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** YYYY-MM-DD かつ実在する日付 */
export function isRealIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}

function isHttpsUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function checkKeys(errors, value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      errors.push(`${path}: unknown key "${key}"`);
    }
  }
}

function checkOptionalDate(errors, value, path) {
  if (value !== null && value !== undefined && !isRealIsoDate(value)) {
    errors.push(`${path}: must be null or a real YYYY-MM-DD date`);
  }
}

function checkRequiredDate(errors, value, path) {
  if (!isRealIsoDate(value)) {
    errors.push(`${path}: must be a real YYYY-MM-DD date`);
  }
}

function inRange(date, start, end) {
  return date >= start && (end === null || date <= end);
}

/**
 * 検証エラーの一覧を返す。空配列なら妥当。
 * @param {unknown} raw
 * @returns {string[]}
 */
export function collectCouncilMembersErrors(raw) {
  const errors = [];

  if (!isPlainObject(raw)) {
    return ["document: must be an object"];
  }
  checkKeys(errors, raw, ALLOWED_KEYS.root, "document");

  if (raw.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version: must be "${SCHEMA_VERSION}"`);
  }

  for (const key of [
    "sources",
    "council_terms",
    "persons",
    "member_terms",
    "affiliation_entries",
    "source_discrepancies",
    "holds",
  ]) {
    if (!Array.isArray(raw[key])) {
      errors.push(`${key}: must be an array`);
    }
  }
  if (errors.length > 0) return errors;

  // --- production_import_gate ---
  if (!isPlainObject(raw.production_import_gate)) {
    errors.push("production_import_gate: required");
  } else {
    checkKeys(
      errors,
      raw.production_import_gate,
      ALLOWED_KEYS.gate,
      "production_import_gate"
    );
    if (!["blocked", "open"].includes(raw.production_import_gate.status)) {
      errors.push('production_import_gate.status: must be "blocked" or "open"');
    }
    if (!isNonEmptyString(raw.production_import_gate.reason)) {
      errors.push("production_import_gate.reason: required");
    }
  }

  // --- sources ---
  const sourceIds = new Set();
  raw.sources.forEach((source, index) => {
    const path = `sources[${index}]`;
    if (!isPlainObject(source)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    checkKeys(errors, source, ALLOWED_KEYS.source, path);
    if (!isNonEmptyString(source.id)) {
      errors.push(`${path}.id: required`);
    } else if (sourceIds.has(source.id)) {
      errors.push(`${path}.id: duplicate source id "${source.id}"`);
    } else {
      sourceIds.add(source.id);
    }
    if (!isNonEmptyString(source.label)) errors.push(`${path}.label: required`);
    if (!isHttpsUrl(source.url)) errors.push(`${path}.url: must be an https URL`);
    for (const field of ["page_updated_on", "as_of", "retrieved_on"]) {
      checkOptionalDate(errors, source[field], `${path}.${field}`);
    }
  });

  const checkSourceIds = (ids, path, { required }) => {
    if (!Array.isArray(ids)) {
      errors.push(`${path}: must be an array`);
      return;
    }
    if (required && ids.length === 0) {
      errors.push(`${path}: at least one source is required`);
    }
    for (const id of ids) {
      if (!sourceIds.has(id)) errors.push(`${path}: unknown source id "${id}"`);
    }
  };

  // --- council_terms ---
  const councilTermsByKey = new Map();
  raw.council_terms.forEach((term, index) => {
    const path = `council_terms[${index}]`;
    if (!isPlainObject(term)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    checkKeys(errors, term, ALLOWED_KEYS.councilTerm, path);
    if (!isNonEmptyString(term.key)) {
      errors.push(`${path}.key: required`);
    } else if (councilTermsByKey.has(term.key)) {
      errors.push(`${path}.key: duplicate council term key "${term.key}"`);
    } else {
      councilTermsByKey.set(term.key, term);
    }
    checkRequiredDate(errors, term.start_date, `${path}.start_date`);
    checkRequiredDate(errors, term.end_date, `${path}.end_date`);
    if (
      isRealIsoDate(term.start_date) &&
      isRealIsoDate(term.end_date) &&
      term.start_date > term.end_date
    ) {
      errors.push(`${path}: start_date must be <= end_date`);
    }
    checkSourceIds(term.source_ids, `${path}.source_ids`, { required: true });
  });

  // 議会任期の重複禁止
  const sortedTerms = [...councilTermsByKey.values()]
    .filter(
      (term) => isRealIsoDate(term.start_date) && isRealIsoDate(term.end_date)
    )
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (let i = 1; i < sortedTerms.length; i++) {
    if (sortedTerms[i].start_date <= sortedTerms[i - 1].end_date) {
      errors.push(
        `council_terms: "${sortedTerms[i - 1].key}" and "${sortedTerms[i].key}" overlap`
      );
    }
  }

  // --- persons ---
  const personsById = new Map();
  raw.persons.forEach((person, index) => {
    const path = `persons[${index}]`;
    if (!isPlainObject(person)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    checkKeys(errors, person, ALLOWED_KEYS.person, path);
    if (!UUID_PATTERN.test(person.member_id ?? "")) {
      errors.push(`${path}.member_id: must be an explicit lowercase UUID`);
    } else if (personsById.has(person.member_id)) {
      errors.push(`${path}.member_id: duplicate member_id ${person.member_id}`);
    } else {
      personsById.set(person.member_id, person);
    }
    if (!PERSON_KINDS.includes(person.kind)) {
      errors.push(`${path}.kind: must be one of ${PERSON_KINDS.join(", ")}`);
    }
    if (!isNonEmptyString(person.name)) errors.push(`${path}.name: required`);

    if (person.kind === "existing") {
      if (!isNonEmptyString(person.legacy_source)) {
        errors.push(`${path}.legacy_source: required for existing persons`);
      }
      for (const field of ["name_kana", "address", "birth_year_label"]) {
        if (person[field] !== undefined) {
          errors.push(
            `${path}.${field}: existing persons keep their legacy profile; do not restate it`
          );
        }
      }
    }
    if (person.kind === "newcomer") {
      for (const field of ["name_kana", "address", "birth_year_label"]) {
        if (!isNonEmptyString(person[field])) {
          errors.push(`${path}.${field}: required for newcomers`);
        }
      }
    }
    if (person.source_ids !== undefined) {
      checkSourceIds(person.source_ids, `${path}.source_ids`, {
        required: false,
      });
    }
  });

  const kindCounts = { existing: 0, newcomer: 0, historical: 0 };
  for (const person of personsById.values()) {
    if (person.kind in kindCounts) kindCounts[person.kind] += 1;
  }
  const expectedPersons = PHASE_2A_EXPECTED.persons;
  if (personsById.size !== expectedPersons.total) {
    errors.push(
      `persons: expected ${expectedPersons.total} persons, got ${personsById.size}`
    );
  }
  for (const kind of PERSON_KINDS) {
    if (kindCounts[kind] !== expectedPersons[kind]) {
      errors.push(
        `persons: expected ${expectedPersons[kind]} "${kind}" persons, got ${kindCounts[kind]}`
      );
    }
  }

  // --- member_terms ---
  const memberTermKeys = new Set();
  const memberTermsByPair = new Map();
  const memberTermsByCouncilKey = new Map();
  raw.member_terms.forEach((term, index) => {
    const path = `member_terms[${index}]`;
    if (!isPlainObject(term)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    checkKeys(errors, term, ALLOWED_KEYS.memberTerm, path);

    const councilTerm = councilTermsByKey.get(term.council_term_key);
    if (!councilTerm) {
      errors.push(
        `${path}.council_term_key: unknown council term "${term.council_term_key}"`
      );
    }
    if (!personsById.has(term.member_id)) {
      errors.push(`${path}.member_id: unknown member_id ${term.member_id}`);
    }

    const pairKey = `${term.council_term_key}::${term.member_id}`;
    if (memberTermKeys.has(pairKey)) {
      errors.push(
        `${path}: duplicate member_term for member ${term.member_id} in "${term.council_term_key}"`
      );
    }
    memberTermKeys.add(pairKey);
    memberTermsByPair.set(pairKey, term);

    checkRequiredDate(errors, term.start_date, `${path}.start_date`);
    checkOptionalDate(errors, term.end_date, `${path}.end_date`);
    const end = term.end_date ?? null;
    if (
      isRealIsoDate(term.start_date) &&
      end !== null &&
      isRealIsoDate(end) &&
      term.start_date > end
    ) {
      errors.push(`${path}: start_date must be <= end_date`);
    }
    if (
      councilTerm &&
      isRealIsoDate(term.start_date) &&
      isRealIsoDate(councilTerm.start_date) &&
      isRealIsoDate(councilTerm.end_date)
    ) {
      if (!inRange(term.start_date, councilTerm.start_date, councilTerm.end_date)) {
        errors.push(`${path}.start_date: outside council term "${term.council_term_key}"`);
      }
      if (
        end !== null &&
        isRealIsoDate(end) &&
        !inRange(end, councilTerm.start_date, councilTerm.end_date)
      ) {
        errors.push(`${path}.end_date: outside council term "${term.council_term_key}"`);
      }
    }

    for (const [field, min] of [
      ["seat_number", 1],
      ["election_count", 1],
    ]) {
      const value = term[field];
      if (value !== null && !(Number.isInteger(value) && value >= min)) {
        errors.push(`${path}.${field}: must be null or an integer >= ${min}`);
      }
    }

    // NULL の項目は明示的に hold として宣言させる（黙って欠損させない）
    if (!Array.isArray(term.holds)) {
      errors.push(`${path}.holds: must be an array`);
    } else {
      for (const field of ["seat_number", "election_count"]) {
        if (term[field] === null && !term.holds.includes(field)) {
          errors.push(`${path}.${field}: null must be declared in holds`);
        }
        if (term[field] !== null && term.holds.includes(field)) {
          errors.push(`${path}.${field}: has a value but is listed in holds`);
        }
      }
    }

    // 値が根拠付きで入る行・期間が任期境界と異なる行には出典が必須
    if (councilTerm) {
      const deviates =
        term.start_date !== councilTerm.start_date || end !== null;
      const needsSource =
        deviates || term.seat_number !== null || term.election_count !== null;
      checkSourceIds(term.source_ids, `${path}.source_ids`, {
        required: needsSource,
      });
    }

    const list = memberTermsByCouncilKey.get(term.council_term_key) ?? [];
    list.push(term);
    memberTermsByCouncilKey.set(term.council_term_key, list);
  });

  // --- 完全性 ---
  const expectedTerms = PHASE_2A_EXPECTED.councilTerms;
  if (councilTermsByKey.size !== expectedTerms.length) {
    errors.push(
      `council_terms: expected ${expectedTerms.length} terms, got ${councilTermsByKey.size}`
    );
  }
  for (const expected of expectedTerms) {
    const actual = [...councilTermsByKey.values()].find(
      (term) => term.start_date === expected.start_date
    );
    if (!actual || actual.end_date !== expected.end_date) {
      errors.push(
        `council_terms: missing term ${expected.start_date} .. ${expected.end_date}`
      );
      continue;
    }
    const count = (memberTermsByCouncilKey.get(actual.key) ?? []).length;
    const expectedCount =
      PHASE_2A_EXPECTED.memberTermsByCouncilTerm[expected.start_date];
    if (count !== expectedCount) {
      errors.push(
        `member_terms: expected ${expectedCount} for council term ${expected.start_date}, got ${count}`
      );
    }

    // 任期中の同時在職者が議席数を超えない
    const terms = memberTermsByCouncilKey.get(actual.key) ?? [];
    const boundaries = new Set(
      terms.flatMap((term) =>
        [term.start_date, term.end_date].filter(isRealIsoDate)
      )
    );
    for (const date of boundaries) {
      const active = terms.filter(
        (term) =>
          isRealIsoDate(term.start_date) &&
          inRange(date, term.start_date, term.end_date ?? actual.end_date)
      ).length;
      if (active > PHASE_2A_EXPECTED.councilSeatCapacity) {
        errors.push(
          `member_terms: ${active} members seated on ${date} in "${actual.key}" (capacity ${PHASE_2A_EXPECTED.councilSeatCapacity})`
        );
      }
    }
  }

  // 現任期(最後の任期)は議席番号が 1..22 を過不足なく埋める
  const currentTerm = sortedTerms[sortedTerms.length - 1];
  if (currentTerm) {
    const seats = (memberTermsByCouncilKey.get(currentTerm.key) ?? []).map(
      (term) => term.seat_number
    );
    const expectedSeats = Array.from(
      { length: PHASE_2A_EXPECTED.currentSeatCount },
      (_, i) => i + 1
    );
    const sortedSeats = [...seats].sort((a, b) => a - b);
    if (JSON.stringify(sortedSeats) !== JSON.stringify(expectedSeats)) {
      errors.push(
        `member_terms: current term seat_number must be exactly 1..${PHASE_2A_EXPECTED.currentSeatCount} without gaps or duplicates`
      );
    }
    for (const term of memberTermsByCouncilKey.get(currentTerm.key) ?? []) {
      if (term.election_count === null) {
        errors.push(
          `member_terms: current term election_count is required (member ${term.member_id})`
        );
      }
    }
  }

  // --- affiliation_entries ---
  const entryKeys = new Set();
  raw.affiliation_entries.forEach((entry, index) => {
    const path = `affiliation_entries[${index}]`;
    if (!isPlainObject(entry)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    checkKeys(errors, entry, ALLOWED_KEYS.entry, path);

    if (!councilTermsByKey.has(entry.council_term_key)) {
      errors.push(`${path}.council_term_key: unknown council term`);
    }
    if (!memberTermKeys.has(`${entry.council_term_key}::${entry.member_id}`)) {
      errors.push(`${path}: no member_term for member ${entry.member_id}`);
    }
    if (!ENTRY_STATUSES.includes(entry.status)) {
      errors.push(`${path}.status: must be "ready" or "hold"`);
    }
    for (const field of ["party", "party_group"]) {
      if (entry[field] !== null && !isNonEmptyString(entry[field])) {
        errors.push(`${path}.${field}: must be null or a non-empty string`);
      }
    }
    for (const field of [
      "party_observed_on",
      "party_group_observed_on",
      "caucus_formed_on",
      "effective_from",
      "effective_to",
    ]) {
      checkOptionalDate(errors, entry[field], `${path}.${field}`);
    }
    if (!sourceIds.has(entry.party_source_id)) {
      errors.push(`${path}.party_source_id: unknown source id`);
    }
    checkSourceIds(entry.party_group_source_ids, `${path}.party_group_source_ids`, {
      required: true,
    });

    if (entry.status === "ready") {
      if (!isRealIsoDate(entry.effective_from)) {
        errors.push(
          `${path}: status "ready" requires a confirmed effective_from (observed_on / caucus_formed_on are not substitutes)`
        );
      }
      if (
        isRealIsoDate(entry.effective_from) &&
        isRealIsoDate(entry.effective_to) &&
        entry.effective_from > entry.effective_to
      ) {
        errors.push(`${path}: effective_from must be <= effective_to`);
      }
      const memberTerm = memberTermsByPair.get(
        `${entry.council_term_key}::${entry.member_id}`
      );
      const councilTerm = councilTermsByKey.get(entry.council_term_key);
      if (
        memberTerm &&
        councilTerm &&
        isRealIsoDate(entry.effective_from) &&
        isRealIsoDate(memberTerm.start_date)
      ) {
        const termEnd = memberTerm.end_date ?? councilTerm.end_date;
        if (entry.effective_from < memberTerm.start_date || entry.effective_from > termEnd) {
          errors.push(`${path}.effective_from: outside the member term period`);
        }
        if (
          isRealIsoDate(entry.effective_to) &&
          (entry.effective_to < memberTerm.start_date || entry.effective_to > termEnd)
        ) {
          errors.push(`${path}.effective_to: outside the member term period`);
        }
      }
      if (!isHttpsUrl(entry.source_url)) {
        errors.push(`${path}.source_url: ready entries require an https source_url`);
      }
      const key = `${entry.council_term_key}::${entry.member_id}::${entry.effective_from}`;
      if (entryKeys.has(key)) {
        errors.push(`${path}: duplicate effective_from for the same member term`);
      }
      entryKeys.add(key);
    }
    if (entry.party_group === "無会派" && !isNonEmptyString(entry.party_group_basis)) {
      errors.push(
        `${path}.party_group_basis: "無会派" must record the cross-check basis (not an automatic default)`
      );
    }
    if (entry.status === "hold" && !isNonEmptyString(entry.hold_reason)) {
      errors.push(`${path}.hold_reason: required for hold entries`);
    }
  });

  // ready 行の期間重複（DB制約にしていないためここで担保）
  const readyByTerm = new Map();
  for (const entry of raw.affiliation_entries) {
    if (entry?.status !== "ready" || !isRealIsoDate(entry.effective_from)) continue;
    const key = `${entry.council_term_key}::${entry.member_id}`;
    const list = readyByTerm.get(key) ?? [];
    list.push(entry);
    readyByTerm.set(key, list);
  }
  for (const [key, list] of readyByTerm) {
    const sorted = [...list].sort((a, b) =>
      a.effective_from.localeCompare(b.effective_from)
    );
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].effective_to ?? null;
      if (prevEnd === null || prevEnd >= sorted[i].effective_from) {
        errors.push(`affiliation_entries: overlapping ready periods for ${key}`);
      }
    }
  }

  // --- source_discrepancies / holds（構造のみ） ---
  for (const [name, allowed] of [
    ["source_discrepancies", ALLOWED_KEYS.discrepancy],
    ["holds", ALLOWED_KEYS.hold],
  ]) {
    const list = raw[name];
    if (list !== undefined && !Array.isArray(list)) {
      errors.push(`${name}: must be an array`);
      continue;
    }
    (list ?? []).forEach((item, index) => {
      if (!isPlainObject(item)) {
        errors.push(`${name}[${index}]: must be an object`);
        return;
      }
      checkKeys(errors, item, allowed, `${name}[${index}]`);
    });
  }
  (raw.source_discrepancies ?? []).forEach((item, index) => {
    if (!personsById.has(item?.member_id)) {
      errors.push(`source_discrepancies[${index}].member_id: unknown member_id`);
    }
    for (const [obsIndex, obs] of (item?.observations ?? []).entries()) {
      if (!sourceIds.has(obs?.source_id)) {
        errors.push(
          `source_discrepancies[${index}].observations[${obsIndex}]: unknown source id`
        );
      }
    }
  });

  return errors;
}

/** 検証して、問題があれば全件まとめて throw する */
export function validateCouncilMembersDocument(raw, jsonPath = "document") {
  const errors = collectCouncilMembersErrors(raw);
  if (errors.length > 0) {
    throw new Error(
      `${jsonPath} is invalid (${errors.length} problem(s)):\n- ${errors.join("\n- ")}`
    );
  }
  return raw;
}

/**
 * 所属エントリを DB 行に変換する（member_term_id の解決は import 時）。
 * ready のみ行になり、hold は絶対に行へ変換されない。
 */
export function splitAffiliationEntries(doc) {
  const ready = [];
  const hold = [];
  for (const entry of doc.affiliation_entries) {
    if (entry.status === "ready") {
      ready.push({
        council_term_key: entry.council_term_key,
        member_id: entry.member_id,
        party: entry.party,
        party_group: entry.party_group,
        valid_from: entry.effective_from,
        valid_to: entry.effective_to ?? null,
        source_url: entry.source_url,
      });
    } else {
      hold.push(entry);
    }
  }
  return { ready, hold };
}
