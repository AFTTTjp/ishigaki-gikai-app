import { describe, expect, it } from "vitest";
import {
  buildMemberDetail,
  buildMemberRoster,
  COUNCIL_SEAT_CAPACITY,
  formatTenureLabel,
  listMemberTenures,
  MemberRosterDataError,
  type MemberRosterState,
  type MemberRow,
  resolveCurrentRoster,
  selectLegacyRoster,
  todayInJst,
} from "./member-roster";

const REFERENCE_DATE = "2026-10-02";

// 旧任期の議員22人 = 再選18人（r）+ 退任4人（x）。legacy 列は 2022-2026 の値
const reelectedIds = Array.from({ length: 18 }, (_, i) => `r${i + 1}`);
const retiredIds = ["x1", "x2", "x3", "x4"];
const newcomerIds = ["n1", "n2", "n3", "n4"];
const HISTORICAL_ID = "h1";

function legacyMember(id: string, index: number): MemberRow {
  return {
    id,
    name: `議員 ${id}`,
    name_kana: `ぎいん ${String(index).padStart(2, "0")}`,
    party: `旧政党-${id}`,
    party_group: `旧会派-${id}`,
    election_count: 2,
    birth_date: "1970-01-01",
    address: "石垣市字大浜",
    image_url: null,
  };
}

/** 新人・歴史上の人物: Phase 2A の importer は legacy の election_count / party を書かない */
function addedMember(id: string, index: number): MemberRow {
  return {
    id,
    name: `議員 ${id}`,
    name_kana: `ぎいん ${String(index).padStart(2, "0")}`,
    party: null,
    party_group: null,
    election_count: null,
    birth_date: null,
    address: "平得",
    image_url: null,
  };
}

const legacyMembers: MemberRow[] = [...reelectedIds, ...retiredIds].map(
  legacyMember
);
const addedMembers: MemberRow[] = [...newcomerIds, HISTORICAL_ID].map(
  (id, index) => addedMember(id, 50 + index)
);

const councilOld = {
  id: "ct-old",
  start_date: "2022-09-28",
  end_date: "2026-09-27",
};
const councilNew = {
  id: "ct-new",
  start_date: "2026-09-28",
  end_date: "2030-09-27",
};

const currentIds = [...reelectedIds, ...newcomerIds];

function newTerms(): MemberRosterState["memberTerms"] {
  return currentIds.map((id, index) => ({
    id: `mt-new-${id}`,
    council_term_id: councilNew.id,
    member_id: id,
    seat_number: index + 1,
    election_count: 9, // legacy の値（2）とは違う値にして、出所を区別できるようにする
    start_date: "2026-09-28",
    end_date: null,
  }));
}

function snapshotsFor(ids: string[]): MemberRosterState["snapshots"] {
  return ids.map((id) => ({
    member_term_id: `mt-new-${id}`,
    observed_on: "2026-10-02",
    party: `新政党-${id}`,
    party_group: `新会派-${id}`,
  }));
}

/** Phase 1 適用後・新任期データ未投入の Production と同じ状態（State A） */
function legacyOnlyState(): MemberRosterState {
  return {
    members: [...legacyMembers],
    memberLinks: [],
    councilTerms: [],
    memberTerms: [],
    snapshots: [],
  };
}

/** 新任期データが完全に揃った状態（State D） */
function completeState(): MemberRosterState {
  const members = [...legacyMembers, ...addedMembers].sort((a, b) =>
    (a.name_kana ?? "").localeCompare(b.name_kana ?? "")
  );
  return {
    members,
    memberLinks: [],
    councilTerms: [councilOld, councilNew],
    memberTerms: [
      ...[...reelectedIds, ...retiredIds, HISTORICAL_ID].map((id) => ({
        id: `mt-old-${id}`,
        council_term_id: councilOld.id,
        member_id: id,
        seat_number: null,
        election_count: null,
        start_date: "2022-09-28",
        end_date: id === HISTORICAL_ID ? "2025-07-29" : null,
      })),
      ...newTerms(),
    ],
    snapshots: snapshotsFor(currentIds),
  };
}

const namesOf = (members: { name: string }[]) =>
  members.map((member) => member.name).sort();

describe("todayInJst", () => {
  it("日本時間の日付を返す（UTC の日付とずれる時間帯も）", () => {
    expect(todayInJst(new Date("2026-10-01T15:00:00Z"))).toBe("2026-10-02");
    expect(todayInJst(new Date("2026-10-01T14:59:59Z"))).toBe("2026-10-01");
  });
});

describe("selectLegacyRoster", () => {
  it("election_count が非 NULL の人だけを返す（新人・歴史上の人物は含めない）", () => {
    const roster = selectLegacyRoster([...legacyMembers, ...addedMembers]);
    expect(roster).toHaveLength(22);
    expect(roster.map((m) => m.id)).toEqual(legacyMembers.map((m) => m.id));
  });
});

describe("staged import の4状態", () => {
  it("State A: 新テーブルが空で legacy 22人のみ → legacy mode / 22人（今の表示のまま）", () => {
    const roster = buildMemberRoster(legacyOnlyState(), REFERENCE_DATE);
    expect(roster.mode).toBe("legacy");
    expect(roster.partial).toBe(false);
    expect(roster.members).toHaveLength(22);
    // legacy 列を従来どおり使う
    expect(roster.members[0]).toMatchObject({
      party: "旧政党-r1",
      party_group: "旧会派-r1",
      election_count: 2,
    });
  });

  it("State B: 新人4人 + 歴史上の1人が members に追加済み、現任期データは未完成 → legacy mode / 旧22人（27人にならない）", () => {
    const state: MemberRosterState = {
      ...legacyOnlyState(),
      members: [...legacyMembers, ...addedMembers],
    };
    const roster = buildMemberRoster(state, REFERENCE_DATE);
    expect(roster.mode).toBe("legacy");
    expect(roster.members).toHaveLength(22);
    expect(namesOf(roster.members)).toEqual(namesOf(legacyMembers));
    for (const id of [...newcomerIds, HISTORICAL_ID]) {
      expect(roster.members.map((m) => m.id)).not.toContain(id);
    }
  });

  it("State B': 議会任期と新人の member_terms だけが入った途中 → legacy mode / 旧22人（partial）", () => {
    const state: MemberRosterState = {
      ...legacyOnlyState(),
      members: [...legacyMembers, ...addedMembers],
      councilTerms: [councilNew],
      memberTerms: newTerms().filter((t) => newcomerIds.includes(t.member_id)),
    };
    const roster = buildMemberRoster(state, REFERENCE_DATE);
    expect(roster.mode).toBe("legacy");
    expect(roster.partial).toBe(true);
    expect(roster.members).toHaveLength(22);
  });

  it("State C: member_terms 22人は揃ったが snapshot が21人分 → legacy mode / 旧22人（partial な新名簿を出さない）", () => {
    const state = completeState();
    state.snapshots = state.snapshots.slice(0, 21);
    const roster = buildMemberRoster(state, REFERENCE_DATE);
    expect(roster.mode).toBe("legacy");
    expect(roster.partial).toBe(true);
    expect(roster.members).toHaveLength(22);
    expect(namesOf(roster.members)).toEqual(namesOf(legacyMembers));
  });

  it("State D: 現任期・member_terms 22人・最新 snapshot 22人が全て揃う → current mode / 新任期22人", () => {
    const roster = buildMemberRoster(completeState(), REFERENCE_DATE);
    expect(roster.mode).toBe("current");
    expect(roster.members).toHaveLength(22);
    const ids = roster.members.map((m) => m.id);
    // 新人4人を含み、退任者4人・歴史上の人物は一覧から外れる
    for (const id of newcomerIds) expect(ids).toContain(id);
    for (const id of [...retiredIds, HISTORICAL_ID])
      expect(ids).not.toContain(id);
    // 当選回数は member_terms 由来、政党・会派は snapshot 由来（legacy 列は使わない）
    for (const member of roster.members) {
      expect(member.election_count).toBe(9);
      expect(member.party).toBe(`新政党-${member.id}`);
      expect(member.party_group).toBe(`新会派-${member.id}`);
    }
  });
});

describe("resolveCurrentRoster: 判定と fail-closed", () => {
  function resolve(
    mutate?: (state: MemberRosterState) => void,
    referenceDate = REFERENCE_DATE
  ) {
    const state = completeState();
    mutate?.(state);
    return resolveCurrentRoster({
      referenceDate,
      councilTerms: state.councilTerms,
      memberTerms: state.memberTerms,
      snapshots: state.snapshots,
      memberIds: new Set(state.members.map((m) => m.id)),
    });
  }
  const expectLegacy = (result: ReturnType<typeof resolve>, reason: string) => {
    expect(result.status).toBe("legacy");
    if (result.status === "legacy") {
      expect(result.reason).toContain(reason);
      expect(result.partial).toBe(true);
    }
  };

  it("基準日を含む議会任期が無ければ legacy（新任期データ未投入の正常状態。partial ではない）", () => {
    expect(resolve(undefined, "2021-01-01")).toMatchObject({
      status: "legacy",
      partial: false,
    });
    expect(resolve(undefined, "2030-09-28")).toMatchObject({
      status: "legacy",
      partial: false,
    });
  });

  it("基準日の境界（議会任期の開始日・終了日）を含む", () => {
    // 開始日当日に切り替わる（snapshot の observed_on も当日以前にしておく）
    expect(
      resolve((state) => {
        for (const snapshot of state.snapshots)
          snapshot.observed_on = "2026-09-28";
      }, "2026-09-28").status
    ).toBe("current");
    expect(resolve(undefined, "2030-09-27").status).toBe("current");
  });

  it("前の議会任期の終了日（2026-09-27）は前の任期の判定になり、新任期の名簿は使わない（旧任期の初回名簿は23人で席番号も無いため legacy）", () => {
    expect(resolve(undefined, "2026-09-27")).toMatchObject({
      status: "legacy",
      partial: true,
    });
  });

  it("現任期の議会任期が2件以上ならエラー（legacy に黙って戻さない）", () => {
    expect(() =>
      resolve((state) => {
        state.councilTerms.push({
          id: "ct-dup",
          start_date: "2026-10-01",
          end_date: "2030-09-30",
        });
      })
    ).toThrow(MemberRosterDataError);
  });

  it("現任期に同じ議員の member_term が重複していればエラー", () => {
    expect(() =>
      resolve((state) => {
        state.memberTerms.push({ ...newTerms()[0], id: "mt-dup" });
      })
    ).toThrow(MemberRosterDataError);
  });

  it("初回名簿の席に穴・重複があれば legacy", () => {
    expectLegacy(
      resolve((state) => {
        const target = state.memberTerms.find((t) => t.id === "mt-new-r2");
        if (target) target.seat_number = 1; // seat 1 が重複、seat 2 が欠ける
      }),
      "founding roster"
    );
    expectLegacy(
      resolve((state) => {
        const target = state.memberTerms.find((t) => t.id === "mt-new-r2");
        if (target) target.seat_number = 23; // seat 2 が穴、23 は範囲外
      }),
      "founding roster"
    );
    expectLegacy(
      resolve((state) => {
        const target = state.memberTerms.find((t) => t.id === "mt-new-r2");
        if (target) target.seat_number = null;
      }),
      "founding roster"
    );
  });

  it("初回名簿が21人しか揃っていなければ legacy", () => {
    expectLegacy(
      resolve((state) => {
        state.memberTerms = state.memberTerms.filter(
          (t) => t.id !== "mt-new-r2"
        );
      }),
      "founding roster"
    );
  });

  it("current member の members 行が無ければ legacy", () => {
    expect(COUNCIL_SEAT_CAPACITY).toBe(22);
    const state = completeState();
    const result = resolveCurrentRoster({
      referenceDate: REFERENCE_DATE,
      councilTerms: state.councilTerms,
      memberTerms: state.memberTerms,
      snapshots: state.snapshots,
      memberIds: new Set(
        state.members.map((m) => m.id).filter((id) => id !== "n1")
      ),
    });
    expectLegacy(result, "members row is missing");
  });

  it("当選回数が NULL の議員がいれば legacy", () => {
    expectLegacy(
      resolve((state) => {
        const target = state.memberTerms.find((t) => t.id === "mt-new-n1");
        if (target) target.election_count = null;
      }),
      "election_count is missing"
    );
  });

  it("snapshot が無い議員がいれば legacy", () => {
    expectLegacy(
      resolve((state) => {
        state.snapshots = state.snapshots.filter(
          (s) => s.member_term_id !== "mt-new-r5"
        );
      }),
      "no snapshot"
    );
  });

  it("最新 snapshot の party が NULL・空白なら legacy", () => {
    for (const party of [null, "", "  ", "　"]) {
      expectLegacy(
        resolve((state) => {
          const target = state.snapshots.find(
            (s) => s.member_term_id === "mt-new-r5"
          );
          if (target) target.party = party;
        }),
        "no party"
      );
    }
  });

  it("未来日の snapshot しか無い議員がいれば legacy（未来日の snapshot は現在値に使わない）", () => {
    expectLegacy(
      resolve((state) => {
        const target = state.snapshots.find(
          (s) => s.member_term_id === "mt-new-r5"
        );
        if (target) target.observed_on = "2026-10-03";
      }),
      "no snapshot on or before"
    );
  });

  it("基準日以前の最新 snapshot を使い、未来日の snapshot は無視する", () => {
    const result = resolve((state) => {
      state.snapshots.push(
        {
          member_term_id: "mt-new-r5",
          observed_on: "2026-09-30",
          party: "古い観測",
          party_group: null,
        },
        {
          member_term_id: "mt-new-r5",
          observed_on: "2027-04-01", // 未来
          party: "未来の観測",
          party_group: "未来の会派",
        }
      );
    });
    expect(result.status).toBe("current");
    if (result.status === "current") {
      const entry = result.entries.find((e) => e.memberId === "r5");
      // 2026-10-02 の snapshot が 2026-09-30 より新しい。未来の 2027-04-01 は使わない
      expect(entry?.party).toBe("新政党-r5");
    }
  });

  it("基準日が進めば、その日以前の最新 snapshot に切り替わる（append-only の追加）", () => {
    const state = completeState();
    state.snapshots.push({
      member_term_id: "mt-new-r5",
      observed_on: "2027-04-01",
      party: "追加された観測",
      party_group: null,
    });
    const before = buildMemberRoster(state, "2027-03-31").members.find(
      (m) => m.id === "r5"
    );
    const after = buildMemberRoster(state, "2027-04-01").members.find(
      (m) => m.id === "r5"
    );
    expect(before?.party).toBe("新政党-r5");
    expect(after?.party).toBe("追加された観測");
    expect(after?.party_group).toBeNull();
  });

  it("party_group が NULL でも current mode を妨げず、NULL のまま渡す。「無会派」の文字列はそのまま維持する", () => {
    const state = completeState();
    const set = (memberTermId: string, partyGroup: string | null) => {
      const target = state.snapshots.find(
        (s) => s.member_term_id === memberTermId
      );
      if (target) target.party_group = partyGroup;
    };
    set("mt-new-r1", null);
    set("mt-new-r2", "無会派");
    const roster = buildMemberRoster(state, REFERENCE_DATE);
    expect(roster.mode).toBe("current");
    expect(roster.members.find((m) => m.id === "r1")?.party_group).toBeNull();
    expect(roster.members.find((m) => m.id === "r2")?.party_group).toBe(
      "無会派"
    );
  });

  it("欠員（在職終了）が出ても、初回名簿が揃っていれば current のまま（在職者は21人）", () => {
    const roster = buildMemberRoster(
      (() => {
        const state = completeState();
        const target = state.memberTerms.find((t) => t.id === "mt-new-r1");
        if (target) target.end_date = "2026-10-01"; // 辞職
        return state;
      })(),
      REFERENCE_DATE
    );
    expect(roster.mode).toBe("current");
    expect(roster.members).toHaveLength(21);
    expect(roster.members.map((m) => m.id)).not.toContain("r1");
  });

  it("欠員を補う議員（任期途中就任・席番号なし）も、snapshot が揃えば現任として含まれる", () => {
    const state = completeState();
    const predecessor = state.memberTerms.find((t) => t.id === "mt-new-r1");
    if (predecessor) predecessor.end_date = "2026-10-01";
    state.memberTerms.push({
      id: "mt-new-h1-return",
      council_term_id: councilNew.id,
      member_id: HISTORICAL_ID,
      seat_number: null,
      election_count: 1,
      start_date: "2026-10-02",
      end_date: null,
    });
    state.snapshots.push({
      member_term_id: "mt-new-h1-return",
      observed_on: "2026-10-02",
      party: "補欠の政党",
      party_group: null,
    });
    const roster = buildMemberRoster(state, REFERENCE_DATE);
    expect(roster.mode).toBe("current");
    expect(roster.members).toHaveLength(22);
    expect(roster.members.map((m) => m.id)).toContain(HISTORICAL_ID);
    expect(roster.members.map((m) => m.id)).not.toContain("r1");
  });
});

describe("current mode の Member 組み立て", () => {
  it("人物の基本情報は members、member_links は既存のまま渡し、current mode では legacy の政党・会派・当選回数を使わない", () => {
    const state = completeState();
    state.memberLinks = [
      {
        id: "l1",
        member_id: "r1",
        service: "x",
        label: null,
        url: "https://example.com/r1",
        sort_order: 0,
      },
    ];
    const roster = buildMemberRoster(state, REFERENCE_DATE);
    const member = roster.members.find((m) => m.id === "r1");
    expect(member).toMatchObject({
      name: "議員 r1",
      birth_date: "1970-01-01",
      address: "石垣市字大浜",
      party: "新政党-r1",
      party_group: "新会派-r1",
      election_count: 9,
    });
    expect(member?.links).toHaveLength(1);
    // legacy の値が current の表示に混ざらない
    for (const m of roster.members) {
      expect(m.party).not.toContain("旧政党");
      expect(m.party_group ?? "").not.toContain("旧会派");
      expect(m.election_count).not.toBe(2);
    }
  });

  it("一覧の並びは members（DB の並び）のまま維持する", () => {
    const state = completeState();
    const roster = buildMemberRoster(state, REFERENCE_DATE);
    const order = state.members
      .map((m) => m.id)
      .filter((id) => currentIds.includes(id));
    expect(roster.members.map((m) => m.id)).toEqual(order);
  });
});

describe("buildMemberDetail", () => {
  it("current mode: 名簿に載っている議員は current として current の値で返す", () => {
    const detail = buildMemberDetail("n1", completeState(), REFERENCE_DATE);
    expect(detail?.kind).toBe("current");
    expect(detail?.member).toMatchObject({
      party: "新政党-n1",
      party_group: "新会派-n1",
      election_count: 9,
    });
    expect(detail?.tenures).toEqual([]);
  });

  it("current mode: 退任者の詳細は 404（null）にならず former として返り、legacy の値を現在の所属として出さない", () => {
    const detail = buildMemberDetail("x1", completeState(), REFERENCE_DATE);
    expect(detail).not.toBeNull();
    expect(detail?.kind).toBe("former");
    expect(detail?.member).toMatchObject({
      id: "x1",
      name: "議員 x1",
      party: null,
      party_group: null,
      election_count: null,
    });
    // 旧任期の在任期間（member_terms と議会任期から導出）
    expect(detail?.tenures).toEqual([
      { start_date: "2022-09-28", end_date: "2026-09-27" },
    ]);
  });

  it("current mode: 途中で辞職した歴史上の人物も former（在任期間は辞職日まで）", () => {
    const detail = buildMemberDetail(
      HISTORICAL_ID,
      completeState(),
      REFERENCE_DATE
    );
    expect(detail?.kind).toBe("former");
    expect(detail?.tenures).toEqual([
      { start_date: "2022-09-28", end_date: "2025-07-29" },
    ]);
  });

  it("current mode: 再選議員が current なら tenures は空（現在の情報だけを出す）", () => {
    expect(
      buildMemberDetail("r1", completeState(), REFERENCE_DATE)?.tenures
    ).toEqual([]);
  });

  it("former でも members の SNS リンク等は維持する", () => {
    const state = completeState();
    state.memberLinks = [
      {
        id: "l9",
        member_id: "x2",
        service: "website",
        label: null,
        url: "https://example.com/x2",
        sort_order: 0,
      },
    ];
    expect(
      buildMemberDetail("x2", state, REFERENCE_DATE)?.member.links
    ).toHaveLength(1);
  });

  it("存在しない ID は null（404）", () => {
    expect(
      buildMemberDetail(
        "00000000-0000-4000-8000-000000000000",
        completeState(),
        REFERENCE_DATE
      )
    ).toBeNull();
    expect(
      buildMemberDetail(
        "00000000-0000-4000-8000-000000000000",
        legacyOnlyState(),
        REFERENCE_DATE
      )
    ).toBeNull();
  });

  it("legacy mode: 旧22人は従来どおり legacy の値で返り（退任4人を含む）、新人・歴史上の人物は null", () => {
    const state: MemberRosterState = {
      ...legacyOnlyState(),
      members: [...legacyMembers, ...addedMembers],
    };
    const retired = buildMemberDetail("x1", state, REFERENCE_DATE);
    expect(retired?.kind).toBe("current");
    expect(retired?.member).toMatchObject({
      party: "旧政党-x1",
      election_count: 2,
    });
    expect(buildMemberDetail("n1", state, REFERENCE_DATE)).toBeNull();
    expect(buildMemberDetail(HISTORICAL_ID, state, REFERENCE_DATE)).toBeNull();
  });
});

describe("listMemberTenures / formatTenureLabel", () => {
  it("在職終了日が無ければ議会任期の終了日を使い、古い順に並べる", () => {
    const state = completeState();
    expect(listMemberTenures("r1", state)).toEqual([
      { start_date: "2022-09-28", end_date: "2026-09-27" },
      { start_date: "2026-09-28", end_date: "2030-09-27" },
    ]);
  });

  it("日付を日本語のラベルにする。不正な日付は null", () => {
    expect(
      formatTenureLabel({ start_date: "2022-09-28", end_date: "2026-09-27" })
    ).toBe("2022年9月28日 〜 2026年9月27日");
    expect(
      formatTenureLabel({ start_date: "bad", end_date: "2026-09-27" })
    ).toBeNull();
  });
});
