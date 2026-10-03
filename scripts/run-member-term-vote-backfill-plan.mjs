import { createClient } from "@supabase/supabase-js";
import { planMemberTermVoteBackfill } from "./plan-member-term-vote-backfill.mjs";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

async function selectAll(client, table, columns) {
  const { data, error } = await client.from(table).select(columns);

  if (error) {
    throw new Error(`Failed to read ${table}: ${error.message}`);
  }

  return data ?? [];
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function printCounts(title, entries) {
  console.log(title);
  if (entries.length === 0) {
    console.log("  (none)");
    return;
  }

  for (const [key, count] of entries) {
    console.log(`  ${key}: ${count}`);
  }
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const url = new URL(supabaseUrl);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("============================================================");
  console.log("bill_member_votes.member_term_id backfill plan");
  console.log("============================================================");
  console.log(`接続先        : ${url.origin}`);
  console.log("モード        : READ ONLY（DB書き込み処理なし）");
  console.log("");

  const [votes, bills, dietSessions, memberTerms, councilTerms] =
    await Promise.all([
      selectAll(
        supabase,
        "bill_member_votes",
        "bill_id, member_id, member_term_id"
      ),
      selectAll(supabase, "bills", "id, diet_session_id"),
      selectAll(supabase, "diet_sessions", "id, start_date, end_date"),
      selectAll(
        supabase,
        "member_terms",
        "id, member_id, council_term_id, start_date, end_date"
      ),
      selectAll(supabase, "council_terms", "id, end_date"),
    ]);

  const plan = planMemberTermVoteBackfill({
    votes,
    bills,
    dietSessions,
    memberTerms,
    councilTerms,
  });

  const nullCount = votes.filter((vote) => vote.member_term_id === null).length;
  const setCount = votes.length - nullCount;

  console.log(
    `入力          : votes ${votes.length} / bills ${bills.length} / diet_sessions ${dietSessions.length} / member_terms ${memberTerms.length} / council_terms ${councilTerms.length}`
  );
  console.log(
    `既存link      : NULL ${nullCount} / 設定済み ${setCount}`
  );
  console.log(
    `計画          : updates ${plan.updates.length} / alreadySet ${plan.alreadySet.length} / unresolved ${plan.unresolved.length}`
  );
  console.log("");

  printCounts(
    "update候補 member_term_id別:",
    countBy(plan.updates, (item) => item.member_term_id)
  );
  console.log("");
  printCounts(
    "unresolved 理由別:",
    countBy(plan.unresolved, (item) => item.reason)
  );

  if (plan.unresolved.length > 0) {
    console.log("");
    console.log("unresolved 詳細:");
    for (const item of plan.unresolved) {
      console.log(
        `  bill_id=${item.bill_id} member_id=${item.member_id} reason=${item.reason}`
      );
    }
  }

  console.log("");
  console.log(
    plan.unresolved.length === 0
      ? "判定: READY FOR HUMAN REVIEW（まだ書き込みはしていません）"
      : "判定: BLOCKED（unresolved を解消するまで書き込み禁止）"
  );
  console.log("READ ONLY 完了。DB変更はありません。");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
