import type { Member, MemberDetail, MemberLink, MemberTenure } from "../types";

/**
 * 議員名簿の「term-aware モデル」と「legacy モデル」の切替・組み立て（純粋関数）。
 *
 * 方針:
 * - 新モデル（council_terms / member_terms / member_affiliation_snapshots）のデータが
 *   完全に揃ったときだけ current mode にする。1件でも欠けたら legacy mode（fail-closed）
 * - legacy mode は従来の表示（members.election_count が非 NULL の旧 22 人）を維持する。
 *   members 全件にしない（新人・歴史上の人物が members に追加されても 27 人表示にしない）
 * - current mode では members.party / party_group / election_count を現在値として使わない
 */

/** 議員定数（初回の名簿の席数）。2026 改選の切替 gate で使う */
export const COUNCIL_SEAT_CAPACITY = 22;

export interface MemberRow {
  id: string;
  name: string;
  name_kana: string | null;
  party: string | null;
  party_group: string | null;
  election_count: number | null;
  birth_date: string | null;
  address: string | null;
  image_url: string | null;
  website_url?: string | null;
  twitter_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  threads_url?: string | null;
  youtube_url?: string | null;
  line_url?: string | null;
}

export interface CouncilTermRow {
  id: string;
  start_date: string;
  end_date: string;
}

export interface MemberTermRow {
  id: string;
  council_term_id: string;
  member_id: string;
  seat_number: number | null;
  election_count: number | null;
  start_date: string;
  end_date: string | null;
}

export interface MemberSnapshotRow {
  member_term_id: string;
  observed_on: string;
  party: string | null;
  party_group: string | null;
}

/** repository が DB から読んだ状態（members は DB の並び順のまま） */
export interface MemberRosterState {
  members: MemberRow[];
  memberLinks: MemberLink[];
  councilTerms: CouncilTermRow[];
  memberTerms: MemberTermRow[];
  snapshots: MemberSnapshotRow[];
}

export interface CurrentRosterEntry {
  memberId: string;
  memberTermId: string;
  seatNumber: number | null;
  electionCount: number;
  party: string;
  partyGroup: string | null;
}

export type CurrentRosterResolution =
  | {
      status: "legacy";
      reason: string;
      /** 現在の議会任期は存在するが新モデルのデータが不完全（段階的 import の途中など）。ログ用 */
      partial: boolean;
    }
  | {
      status: "current";
      councilTermId: string;
      entries: CurrentRosterEntry[];
    };

/** 新モデルのデータが矛盾している（legacy に黙って戻さず、エラーにする） */
export class MemberRosterDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberRosterDataError";
  }
}

const JST_DATE_FORMAT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 日本時間の今日（YYYY-MM-DD）。深いロジックで new Date() を使わず、基準日を注入できるようにする */
export function todayInJst(now: Date): string {
  return JST_DATE_FORMAT.format(now);
}

function isActiveOn(term: MemberTermRow, referenceDate: string): boolean {
  return (
    term.start_date <= referenceDate &&
    (term.end_date === null || referenceDate <= term.end_date)
  );
}

function legacy(reason: string, partial: boolean): CurrentRosterResolution {
  return { status: "legacy", reason, partial };
}

/**
 * current mode に切り替えられるかを判定する。
 *
 * - 基準日を含む議会任期が 0 件 → legacy（新任期データ未投入の正常状態）
 * - 2 件以上 → データ不整合として throw（重複した現任期を隠さない）
 * - 初回名簿（議会任期の開始日に就任した member_terms）が席 1..22 を過不足なく埋めていない → legacy
 *   （欠員が出た後も、初回名簿が揃っていれば current のまま。在職者数が 21 人になっても legacy に戻さない）
 * - 在職中の各議員について、当選回数・members 行・基準日以前の最新 snapshot（party 非 NULL）が揃わない → legacy
 */
export function resolveCurrentRoster(input: {
  referenceDate: string;
  councilTerms: CouncilTermRow[];
  memberTerms: MemberTermRow[];
  snapshots: MemberSnapshotRow[];
  memberIds: ReadonlySet<string>;
}): CurrentRosterResolution {
  const { referenceDate } = input;

  const currentCouncilTerms = input.councilTerms.filter(
    (term) => term.start_date <= referenceDate && referenceDate <= term.end_date
  );
  if (currentCouncilTerms.length === 0) {
    return legacy("no council term contains the reference date", false);
  }
  if (currentCouncilTerms.length > 1) {
    throw new MemberRosterDataError(
      `${currentCouncilTerms.length} council terms contain ${referenceDate}`
    );
  }
  const councilTerm = currentCouncilTerms[0];

  const termsOfCouncil = input.memberTerms.filter(
    (term) => term.council_term_id === councilTerm.id
  );
  const seenMemberIds = new Set<string>();
  for (const term of termsOfCouncil) {
    if (seenMemberIds.has(term.member_id)) {
      throw new MemberRosterDataError(
        `duplicate member_term for member ${term.member_id} in the current council term`
      );
    }
    seenMemberIds.add(term.member_id);
  }

  // 初回名簿: 席 1..22 を過不足なく埋めている（欠員が出た後も、この条件は変わらない）
  const founding = termsOfCouncil.filter(
    (term) => term.start_date === councilTerm.start_date
  );
  const foundingSeats = founding.map((term) => term.seat_number);
  const sortedSeats = foundingSeats
    .filter((seat): seat is number => seat !== null)
    .sort((a, b) => a - b);
  if (
    founding.length !== COUNCIL_SEAT_CAPACITY ||
    sortedSeats.length !== COUNCIL_SEAT_CAPACITY ||
    !sortedSeats.every((seat, index) => seat === index + 1)
  ) {
    return legacy(
      `founding roster must fill seats 1..${COUNCIL_SEAT_CAPACITY} exactly (got ${founding.length} member_terms)`,
      true
    );
  }

  const active = termsOfCouncil.filter((term) =>
    isActiveOn(term, referenceDate)
  );
  if (active.length === 0 || active.length > COUNCIL_SEAT_CAPACITY) {
    return legacy(
      `unexpected number of active member_terms: ${active.length}`,
      true
    );
  }

  const entries: CurrentRosterEntry[] = [];
  for (const term of active) {
    if (term.election_count === null) {
      return legacy(
        `election_count is missing for member ${term.member_id}`,
        true
      );
    }
    if (!input.memberIds.has(term.member_id)) {
      return legacy(
        `members row is missing for member ${term.member_id}`,
        true
      );
    }

    // 基準日以前の最新 snapshot（未来日の snapshot は現在値に使わない）
    let latest: MemberSnapshotRow | null = null;
    for (const snapshot of input.snapshots) {
      if (
        snapshot.member_term_id === term.id &&
        snapshot.observed_on <= referenceDate &&
        (latest === null || snapshot.observed_on > latest.observed_on)
      ) {
        latest = snapshot;
      }
    }
    if (latest === null) {
      return legacy(
        `no snapshot on or before ${referenceDate} for member ${term.member_id}`,
        true
      );
    }
    const party = latest.party;
    if (party == null || party.trim().length === 0) {
      return legacy(
        `latest snapshot has no party for member ${term.member_id}`,
        true
      );
    }

    entries.push({
      memberId: term.member_id,
      memberTermId: term.id,
      seatNumber: term.seat_number,
      electionCount: term.election_count,
      party,
      // party_group の NULL は「記載なし/未確定」。「無会派」の文字列とは区別して、そのまま渡す
      partyGroup: latest.party_group,
    });
  }

  return { status: "current", councilTermId: councilTerm.id, entries };
}

/** legacy 名簿: members.election_count が非 NULL の人だけ（新人・歴史上の人物は election_count を持たない） */
export function selectLegacyRoster(members: MemberRow[]): MemberRow[] {
  return members.filter((member) => member.election_count != null);
}

function stringOrNull(value: string | null | undefined): string | null {
  return typeof value === "string" ? value : null;
}

/** members 行を Member に変換する。政党・会派・当選回数は呼び出し側が決めた値を使う */
export function toMember(
  row: MemberRow,
  links: MemberLink[],
  affiliation: {
    party: string | null;
    party_group: string | null;
    election_count: number | null;
  }
): Member {
  return {
    id: row.id,
    name: row.name,
    name_kana: row.name_kana,
    party: affiliation.party,
    party_group: affiliation.party_group,
    election_count: affiliation.election_count,
    birth_date: row.birth_date,
    address: row.address,
    image_url: row.image_url,
    website_url: stringOrNull(row.website_url),
    twitter_url: stringOrNull(row.twitter_url),
    facebook_url: stringOrNull(row.facebook_url),
    instagram_url: stringOrNull(row.instagram_url),
    threads_url: stringOrNull(row.threads_url),
    youtube_url: stringOrNull(row.youtube_url),
    line_url: stringOrNull(row.line_url),
    links,
  };
}

function groupLinksByMember(links: MemberLink[]): Map<string, MemberLink[]> {
  const grouped = new Map<string, MemberLink[]>();
  for (const link of links) {
    const list = grouped.get(link.member_id);
    if (list) list.push(link);
    else grouped.set(link.member_id, [link]);
  }
  return grouped;
}

export interface MemberRoster {
  mode: "legacy" | "current";
  /** legacy のときの理由（ログ用） */
  reason: string | null;
  partial: boolean;
  members: Member[];
}

/** 議員一覧を組み立てる。members の並び順（DB の並び）は維持する */
export function buildMemberRoster(
  state: MemberRosterState,
  referenceDate: string
): MemberRoster {
  const resolution = resolveCurrentRoster({
    referenceDate,
    councilTerms: state.councilTerms,
    memberTerms: state.memberTerms,
    snapshots: state.snapshots,
    memberIds: new Set(state.members.map((member) => member.id)),
  });
  const linksByMember = groupLinksByMember(state.memberLinks);

  if (resolution.status === "current") {
    const entryByMemberId = new Map(
      resolution.entries.map((entry) => [entry.memberId, entry])
    );
    const members: Member[] = [];
    for (const row of state.members) {
      const entry = entryByMemberId.get(row.id);
      if (!entry) continue;
      members.push(
        toMember(row, linksByMember.get(row.id) ?? [], {
          party: entry.party,
          party_group: entry.partyGroup,
          election_count: entry.electionCount,
        })
      );
    }
    return { mode: "current", reason: null, partial: false, members };
  }

  const members = selectLegacyRoster(state.members).map((row) =>
    toMember(row, linksByMember.get(row.id) ?? [], {
      party: row.party,
      party_group: row.party_group,
      election_count: row.election_count,
    })
  );
  return {
    mode: "legacy",
    reason: resolution.reason,
    partial: resolution.partial,
    members,
  };
}

/** 在任期間（終了日は在職終了日、無ければ議会任期の終了日）。古い順 */
export function listMemberTenures(
  memberId: string,
  state: Pick<MemberRosterState, "councilTerms" | "memberTerms">
): MemberTenure[] {
  const councilEndById = new Map(
    state.councilTerms.map((term) => [term.id, term.end_date])
  );
  return state.memberTerms
    .filter((term) => term.member_id === memberId)
    .flatMap((term) => {
      const end = term.end_date ?? councilEndById.get(term.council_term_id);
      return end ? [{ start_date: term.start_date, end_date: end }] : [];
    })
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

/**
 * 議員詳細を組み立てる。
 * - 名簿（current / legacy）に載っている議員 → current
 * - current mode で名簿に載っていない議員のうち、members に存在し、かつ member_terms
 *   （過去・終了済みを含む）で在任実績を確認できる議員 → former（404 にしない。
 *   過去の採決などからのリンクを維持する）。legacy の政党・会派・当選回数は現在値として出さない
 * - members 行だけで member_terms が無い人物、存在しない ID → null（前議員とは断定しない）
 */
export function buildMemberDetail(
  memberId: string,
  state: MemberRosterState,
  referenceDate: string
): MemberDetail | null {
  const roster = buildMemberRoster(state, referenceDate);
  const inRoster = roster.members.find((member) => member.id === memberId);
  if (inRoster) {
    return { kind: "current", member: inRoster, tenures: [] };
  }

  if (roster.mode !== "current") {
    return null;
  }

  const row = state.members.find((member) => member.id === memberId);
  if (!row) {
    return null;
  }
  // 「前議員」は公的な属性なので、members 行の存在だけでは断定しない。
  // member_terms（過去・終了済みを含む）で在任実績を確認できる人だけを前議員にする
  const hasTerm = state.memberTerms.some((term) => term.member_id === row.id);
  if (!hasTerm) {
    return null;
  }
  const links = groupLinksByMember(state.memberLinks).get(row.id) ?? [];
  return {
    kind: "former",
    member: toMember(row, links, {
      party: null,
      party_group: null,
      election_count: null,
    }),
    tenures: listMemberTenures(row.id, state),
  };
}

/** 在任期間の表示用ラベル（例: 2022年9月28日 〜 2026年9月27日）。不正な日付は null */
export function formatTenureLabel(tenure: MemberTenure): string | null {
  const format = (value: string): string | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
  };
  const start = format(tenure.start_date);
  const end = format(tenure.end_date);
  return start && end ? `${start} 〜 ${end}` : null;
}
