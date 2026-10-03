import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  countByResultDate,
  executeBillResultDateImport,
  PRODUCTION_SUPABASE_HOST,
  validateBillResultDateExecutionPlan,
  verifyUpdatedCount,
} from "./bill-result-date-import-execution.mjs";
import { planBillResultDateImport } from "./plan-bill-result-date-import.mjs";

const url = `https://${PRODUCTION_SUPABASE_HOST}`;

function artifact({
  count = 17,
  session = "ishigaki-r8-dai4-teireikai",
  resultDate = "2026-06-24",
} = {}) {
  return {
    session: { slug: session },
    bills: Array.from({ length: count }, () => ({
      result_date: resultDate,
    })),
  };
}

function plan({ updates = 17, alreadySet = 0, unresolved = [] } = {}) {
  const make = (count, offset = 0) =>
    Array.from({ length: count }, (_, index) => {
      const itemIndex = offset + index;
      return {
        bill_id: `bill-${itemIndex}`,
        bill_name: `議案第${itemIndex + 1}号 テスト`,
        result_date: "2026-06-24",
        match_mode:
          itemIndex < 4
            ? "exact_after_bracket_width_normalization"
            : "exact",
      };
    });

  return {
    updates: make(updates),
    alreadySet: make(alreadySet, updates),
    unresolved,
  };
}

const baseArgs = {
  supabaseUrl: url,
  artifact: artifact(),
  plan: plan(),
  expectedTotal: 17,
  expectedSession: "ishigaki-r8-dai4-teireikai",
  expectedResultDate: "2026-06-24",
};

describe("validateBillResultDateExecutionPlan", () => {
  it("reviewed 17 bills with unresolved 0 passes", () => {
    expect(validateBillResultDateExecutionPlan(baseArgs)).toEqual([]);
  });

  it("partial rerun is allowed when total remains 17", () => {
    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        plan: plan({ updates: 5, alreadySet: 12 }),
      })
    ).toEqual([]);
  });

  it("blocks a different Supabase project", () => {
    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        supabaseUrl: "https://wrong.supabase.co",
      })
    ).toContainEqual(expect.stringContaining("Production host mismatch"));
  });

  it("blocks changed session, count, date, or unresolved rows", () => {
    const errors = validateBillResultDateExecutionPlan({
      ...baseArgs,
      artifact: artifact({
        count: 16,
        session: "wrong-session",
        resultDate: "2026-06-23",
      }),
      plan: plan({ updates: 16, unresolved: [{ reason: "x" }] }),
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("session changed"),
        expect.stringContaining("artifact bill count changed"),
        expect.stringContaining("artifact result_date changed"),
        expect.stringContaining("unresolved must be 0"),
        expect.stringContaining("resolved total changed"),
      ])
    );
  });

  it("blocks duplicate bill ids in the resolved plan", () => {
    const changedPlan = plan();
    changedPlan.updates[1].bill_id = changedPlan.updates[0].bill_id;

    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        plan: changedPlan,
      })
    ).toContainEqual(expect.stringContaining("bill_id values must be unique"));
  });

  it("blocks a future unreviewed match mode", () => {
    const changedPlan = plan();
    changedPlan.updates[0].match_mode = "fuzzy";

    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        plan: changedPlan,
      })
    ).toContainEqual(expect.stringContaining("unexpected match_mode"));
  });

  it("blocks a planned date outside the reviewed date", () => {
    const changedPlan = plan();
    changedPlan.updates[0].result_date = "2026-06-23";

    expect(
      validateBillResultDateExecutionPlan({
        ...baseArgs,
        plan: changedPlan,
      })
    ).toContainEqual(expect.stringContaining("planned result_date changed"));
  });
});

// ---------------------------------------------------------------------------
// executeBillResultDateImport: Supabase を直接叩かず、メモリ上の bills を持つ fake client で検証する。
// fake は supabase-js の update().eq().is().select() の連鎖を再現し、条件に合う行だけを更新する。
// ---------------------------------------------------------------------------

function createFakeBillsClient(rows, { onUpdate } = {}) {
  const calls = [];

  const client = {
    calls,
    rows,
    from(table) {
      if (table !== "bills") throw new Error(`unexpected table: ${table}`);
      return {
        update(values) {
          const call = { values, filters: [] };
          calls.push(call);
          const callIndex = calls.length - 1;
          const builder = {
            eq(column, value) {
              call.filters.push(["eq", column, value]);
              return builder;
            },
            is(column, value) {
              call.filters.push(["is", column, value]);
              return builder;
            },
            async select() {
              const override = onUpdate?.(callIndex, call);
              if (override) return override;
              const matched = rows.filter((row) =>
                call.filters.every(([op, column, value]) =>
                  op === "eq" ? row[column] === value : row[column] === null
                )
              );
              for (const row of matched) Object.assign(row, values);
              return {
                data: matched.map((row) => ({
                  id: row.id,
                  name: row.name,
                  result_date: row.result_date,
                })),
                error: null,
              };
            },
          };
          return builder;
        },
      };
    },
  };
  return client;
}

function dbRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `bill-${index}`,
    name: `議案第${index + 1}号 テスト`,
    document_type: "bill",
    diet_session_id: "session-id",
    result_date: null,
  }));
}

describe("executeBillResultDateImport (fake client)", () => {
  it("各 update を1回ずつ、optimistic guard つきで実行し、実際の更新件数を返す", async () => {
    const updates = plan({ updates: 3 }).updates;
    const client = createFakeBillsClient(dbRows(3));

    const updated = await executeBillResultDateImport(client, updates);

    expect(updated).toBe(3);
    expect(client.calls).toHaveLength(3);
    client.calls.forEach((call, index) => {
      // 書き込む値は計画の result_date だけ
      expect(call.values).toEqual({ result_date: "2026-06-24" });
      // optimistic guard: id・name・document_type が計画と一致し、result_date が NULL の行だけ
      expect(call.filters).toEqual([
        ["eq", "id", `bill-${index}`],
        ["eq", "name", `議案第${index + 1}号 テスト`],
        ["eq", "document_type", "bill"],
        ["is", "result_date", null],
      ]);
    });
    expect(client.rows.map((row) => row.result_date)).toEqual([
      "2026-06-24",
      "2026-06-24",
      "2026-06-24",
    ]);
  });

  it("計画が空なら何も書かず 0 を返す", async () => {
    const client = createFakeBillsClient(dbRows(2));
    expect(await executeBillResultDateImport(client, [])).toBe(0);
    expect(client.calls).toHaveLength(0);
  });

  it("optimistic guard に合う行が 0 行なら throw し、後続の write を続行しない", async () => {
    const rows = dbRows(4);
    rows[1].result_date = "2026-01-01"; // plan 後に別の値が入った（stale）
    const client = createFakeBillsClient(rows);

    await expect(
      executeBillResultDateImport(client, plan({ updates: 4 }).updates)
    ).rejects.toThrow("update target changed bill_id=bill-1");

    // bill-0 は更新済み、bill-1 で停止し、bill-2 / bill-3 には write しない
    expect(client.calls).toHaveLength(2);
    expect(rows.map((row) => row.result_date)).toEqual([
      "2026-06-24",
      "2026-01-01",
      null,
      null,
    ]);
  });

  it("plan 後に name が変わった行（guard の name 条件）も更新しない", async () => {
    const rows = dbRows(2);
    rows[0].name = "議案第1号 名前が変わった";
    const client = createFakeBillsClient(rows);
    await expect(
      executeBillResultDateImport(client, plan({ updates: 2 }).updates)
    ).rejects.toThrow("update target changed");
    expect(rows[0].result_date).toBeNull();
    expect(client.calls).toHaveLength(1);
  });

  it("update 結果が2行以上なら throw し、後続の write を続行しない", async () => {
    const client = createFakeBillsClient(dbRows(3), {
      onUpdate: (index) =>
        index === 0
          ? {
              data: [
                { id: "bill-0", name: "議案第1号 テスト", result_date: "2026-06-24" },
                { id: "x", name: "別の行", result_date: "2026-06-24" },
              ],
              error: null,
            }
          : undefined,
    });
    await expect(
      executeBillResultDateImport(client, plan({ updates: 3 }).updates)
    ).rejects.toThrow("expected 1 NULL bill row, got 2");
    expect(client.calls).toHaveLength(1);
  });

  it("Supabase の update が error を返したら throw し、後続の write を開始しない", async () => {
    const client = createFakeBillsClient(dbRows(3), {
      onUpdate: (index) =>
        index === 1
          ? { data: null, error: { message: "boom" } }
          : undefined,
    });
    await expect(
      executeBillResultDateImport(client, plan({ updates: 3 }).updates)
    ).rejects.toThrow("update failed bill_id=bill-1: boom");
    expect(client.calls).toHaveLength(2);
  });

  it("返却行の name または result_date が計画と違えば throw する", async () => {
    for (const returned of [
      { id: "bill-0", name: "議案第1号 別の名前", result_date: "2026-06-24" },
      { id: "bill-0", name: "議案第1号 テスト", result_date: "2026-06-25" },
    ]) {
      const client = createFakeBillsClient(dbRows(2), {
        onUpdate: () => ({ data: [returned], error: null }),
      });
      await expect(
        executeBillResultDateImport(client, plan({ updates: 2 }).updates)
      ).rejects.toThrow("post-update mismatch bill_id=bill-0");
      expect(client.calls).toHaveLength(1);
    }
  });
});

describe("partial failure → replan → retry（実 planner を使用）", () => {
  const reviewedDate = "2026-06-24";
  const billNames = ["条例A", "条例B", "［特別会計］条例C", "条例D"];

  const reviewedArtifact = {
    schema: "vote-results/review-v1",
    session: { slug: "session-1", name: "test", closed_on: reviewedDate },
    bills: billNames.map((name, index) => ({
      bill_number: `議案第${index + 1}号`,
      bill_name: name,
      result_date: reviewedDate,
      confidence: "high",
      needs_review: false,
      source_ref: {
        source_kind: "official_html",
        url: "https://example.com/source",
        locator: `議案第${index + 1}号`,
      },
    })),
  };
  const dietSessions = [
    {
      id: "session-id-1",
      slug: "session-1",
      start_date: "2026-06-08",
      end_date: "2026-06-24",
    },
  ];
  // DB 側の議案名は「［」「］」が半角 [ ] になっている（planner が許す唯一の正規化）
  const freshRows = () =>
    billNames.map((name, index) => ({
      id: `bill-id-${index}`,
      name: `議案第${index + 1}号 ${name.replaceAll("［", "[").replaceAll("］", "]")}`,
      diet_session_id: "session-id-1",
      document_type: "bill",
      result_date: null,
    }));

  const replan = (rows) =>
    planBillResultDateImport({ artifact: reviewedArtifact, dietSessions, bills: rows });
  const gate = (planResult) =>
    validateBillResultDateExecutionPlan({
      supabaseUrl: url,
      artifact: reviewedArtifact,
      plan: planResult,
      expectedTotal: 4,
      expectedSession: "session-1",
      expectedResultDate: reviewedDate,
    });

  it("前半だけ書けて途中で失敗 → 再計画で成功済みは alreadySet、残りだけ updates → 再実行で完了する", async () => {
    const rows = freshRows();

    // 初回計画: 4件すべて updates
    const first = replan(rows);
    expect(first.updates).toHaveLength(4);
    expect(first.alreadySet).toHaveLength(0);
    expect(first.unresolved).toHaveLength(0);
    expect(gate(first)).toEqual([]);

    // 3件目の update で失敗する（前半2件は書き込み済み）
    const failing = createFakeBillsClient(rows, {
      onUpdate: (index) =>
        index === 2 ? { data: null, error: { message: "network down" } } : undefined,
    });
    await expect(
      executeBillResultDateImport(failing, first.updates)
    ).rejects.toThrow("update failed bill_id=bill-id-2: network down");
    expect(failing.calls).toHaveLength(3);
    expect(rows.map((row) => row.result_date)).toEqual([
      reviewedDate,
      reviewedDate,
      null,
      null,
    ]);

    // 更新後の DB 状態を同じ artifact で再計画: 成功済みは alreadySet、未実行だけが updates
    const second = replan(rows);
    expect(second.alreadySet.map((item) => item.bill_id)).toEqual([
      "bill-id-0",
      "bill-id-1",
    ]);
    expect(second.updates.map((item) => item.bill_id)).toEqual([
      "bill-id-2",
      "bill-id-3",
    ]);
    expect(second.unresolved).toHaveLength(0);
    // gate は「updates + alreadySet = 4」なので、部分実行後の再実行を許可する
    expect(gate(second)).toEqual([]);

    // 残りの updates だけを再実行する（成功済みの行には write しない）
    const retry = createFakeBillsClient(rows);
    const updated = await executeBillResultDateImport(retry, second.updates);
    expect(updated).toBe(2);
    expect(retry.calls.map((call) => call.filters[0][2])).toEqual([
      "bill-id-2",
      "bill-id-3",
    ]);
    expect(verifyUpdatedCount(updated, second.updates.length)).toBeNull();

    // 最終状態: updates = 0 / alreadySet = reviewed total / unresolved = 0
    const final = replan(rows);
    expect(final.updates).toHaveLength(0);
    expect(final.alreadySet).toHaveLength(4);
    expect(final.unresolved).toHaveLength(0);
    expect(gate(final)).toEqual([]);

    // さらに再実行しても何も書かない（冪等）
    const noop = createFakeBillsClient(rows);
    expect(await executeBillResultDateImport(noop, final.updates)).toBe(0);
    expect(noop.calls).toHaveLength(0);
  });

  it("plan 後に別の値が入った行があると、guard で停止し既存値は上書きされない（stale DB）", async () => {
    const rows = freshRows();
    const first = replan(rows);
    rows[2].result_date = "2026-06-30"; // plan と書き込みの間に別の値が入った

    const client = createFakeBillsClient(rows);
    await expect(
      executeBillResultDateImport(client, first.updates)
    ).rejects.toThrow("update target changed bill_id=bill-id-2");
    expect(rows[2].result_date).toBe("2026-06-30");
    expect(rows[3].result_date).toBeNull();

    // 再計画すると、異なる既存値は planner の blocker（unresolved）になり、gate が書き込みを止める
    const second = replan(rows);
    expect(second.unresolved).toHaveLength(1);
    expect(gate(second).join(" ")).toContain("unresolved must be 0");
  });
});

describe("countByResultDate / verifyUpdatedCount", () => {
  it("result_date 別に件数を数え、日付の昇順で返す", () => {
    expect(
      countByResultDate([
        ...plan({ updates: 12 }).updates,
        ...plan({ updates: 0, alreadySet: 5 }).alreadySet,
        { bill_id: "z", bill_name: "z", result_date: "2026-06-20", match_mode: "exact" },
      ])
    ).toEqual({ "2026-06-20": 1, "2026-06-24": 17 });
    expect(countByResultDate([])).toEqual({});
  });

  it("実際の更新件数が計画と違えばエラー文字列を返し、同じなら null", () => {
    expect(verifyUpdatedCount(17, 17)).toBeNull();
    expect(verifyUpdatedCount(0, 0)).toBeNull();
    expect(verifyUpdatedCount(16, 17)).toContain("planned 17, actually updated 16");
    expect(verifyUpdatedCount(18, 17)).toContain("mismatch");
  });
});

describe("execute runner の起動ガード（DB には接続しない）", () => {
  const script = new URL("./execute-bill-result-date-import.mjs", import.meta.url)
    .pathname;
  // SUPABASE_* を渡さない環境で実行する。必須フラグ・環境変数が欠けていれば DB 接続の前に停止する
  const run = (args) =>
    spawnSync("node", [script, ...args], {
      encoding: "utf-8",
      env: { PATH: process.env.PATH },
    });

  it("必須フラグが欠けていれば停止する（--execute / --prod / --confirm-reviewed-plan）", () => {
    for (const [args, message] of [
      [[], "--execute is required"],
      [["--execute"], "--prod is required"],
      [["--execute", "--prod"], "--confirm-reviewed-plan is required"],
    ]) {
      const result = run(args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(message);
    }
  });

  it("レビュー済みの期待値（件数・session・日付）が欠けていれば停止する", () => {
    const base = ["--execute", "--prod", "--confirm-reviewed-plan"];
    expect(run(base).stderr).toContain("--expected-total");
    expect(run([...base, "--expected-total", "17"]).stderr).toContain(
      "--expected-session"
    );
    expect(
      run([...base, "--expected-total", "17", "--expected-session", "s"]).stderr
    ).toContain("--expected-result-date");
  });

  it("全フラグがあっても接続情報（SUPABASE_URL）が無ければ DB に触れる前に停止する", () => {
    const result = run([
      "--execute",
      "--prod",
      "--confirm-reviewed-plan",
      "--expected-total",
      "17",
      "--expected-session",
      "ishigaki-r8-dai4-teireikai",
      "--expected-result-date",
      "2026-06-24",
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SUPABASE_URL is not set");
  });
});
