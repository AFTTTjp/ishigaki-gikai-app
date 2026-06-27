-- 石垣市議会版 みらい議会
-- 令和8年第4回定例会 bills.status / status_note 更新 review-first SQL
--
-- 目的:
--   docs/vote_results/r8-dai4-teireikai.vote-results.review.json の bills[] 17件だけを対象に、
--   bills.status / bills.status_note を採決結果ベースへ更新する。
--
-- 対象:
--   議案第36号〜第52号のうち、review artifact の bills[] に入っている17議案のみ
--
-- 除外:
--   - 承認第2号〜第4号
--   - 請願第1号〜第2号
--   - 報告第3号〜第9号
--   - 委員会提出議案第1号
--   - 議員提出議案第13号〜第16号
--   - 議案の撤回について(議案第2号)
--   - 議案第42号（修正案）
--
-- 根拠:
--   1. docs/vote_results/r8-dai4-teireikai.vote-results.review.json
--   2. 公式ページ「提出議案とその結果」
--      https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html
--   3. 公式ページ「意見書・決議書 令和8年（2026年）」
--      https://www.city.ishigaki.okinawa.jp/soshiki/gikai/ikennketugisyo/11720.html
--
-- 重要方針:
--   - bill number exact match のみ。fuzzy matching 禁止。
--   - diet_session slug = 'ishigaki-r8-dai4-teireikai' の bills のみ対象。
--   - 実行前に対象17件がちょうど一致することを確認し、一致しなければ停止する。
--   - 実行前に現在 status が審議系（introduced / in_originating_house / in_receiving_house）のみであることを確認し、
--     それ以外が混ざっていれば停止する。
--   - 今回は status enum の既存値のみ使う。可決 / 原案可決は enacted へ写す。
--   - 議案第42号の修正案否決は bills.status には持ち込まず、status_note へ併記する。
--   - DB実行はまだしない。test → prod の順で review 後に実行する。
--
-- status mapping:
--   - 可決       -> enacted
--   - 原案可決   -> enacted
--
-- 実行前チェック（まだ実行しない）:
--   1. test 環境に接続していることを確認する。
--   2. 下記 preview SELECT 部分だけ先に確認する。
--   3. 問題なければ BEGIN 以降を test で実行する。
--   4. 実行後は bills / topics / diet-sessions 系の revalidation が必要。
--   5. prod 実行は test 確認後に別途行う。test/prod を混同しない。
--
-- stale static text の別対応候補（このSQLでは更新しない）:
--   - web/src/features/diet-sessions/shared/data/session-overviews.ts
--   - docs/ishigaki_gikai_topics_dev_set/rito-koshien-r8-dai4.topic.json

-- =====================================================
-- Preview SELECT 1: review artifact 対応の bill number 一覧
-- =====================================================
-- 期待件数: 17
-- SELECT * FROM (
--   VALUES
--     ('議案第36号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第37号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第38号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第39号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第40号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第41号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第42号', 'enacted', '2026-06-24 原案可決・修正案否決（令和8年第4回定例会）'),
--     ('議案第43号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第44号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第45号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第46号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第47号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第48号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第49号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第50号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第51号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
--     ('議案第52号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）')
-- ) AS review_target(bill_number, proposed_status, proposed_status_note);

-- =====================================================
-- Preview SELECT 2: 実DB上の対象17件確認
-- =====================================================
-- SELECT
--   regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') AS bill_number,
--   b.name,
--   b.status,
--   b.status_note,
--   b.publish_status
-- FROM public.bills b
-- JOIN public.diet_sessions ds
--   ON ds.id = b.diet_session_id
-- WHERE ds.slug = 'ishigaki-r8-dai4-teireikai'
--   AND regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') IN (
--     '議案第36号', '議案第37号', '議案第38号', '議案第39号', '議案第40号',
--     '議案第41号', '議案第42号', '議案第43号', '議案第44号', '議案第45号',
--     '議案第46号', '議案第47号', '議案第48号', '議案第49号', '議案第50号',
--     '議案第51号', '議案第52号'
--   )
-- ORDER BY bill_number;

BEGIN;

CREATE TEMP TABLE _r8d4_vote_result_target (
  bill_number text PRIMARY KEY,
  proposed_status public.bill_status_enum NOT NULL,
  proposed_status_note text NOT NULL
) ON COMMIT DROP;

INSERT INTO _r8d4_vote_result_target (
  bill_number,
  proposed_status,
  proposed_status_note
) VALUES
  ('議案第36号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第37号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第38号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第39号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第40号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第41号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第42号', 'enacted', '2026-06-24 原案可決・修正案否決（令和8年第4回定例会）'),
  ('議案第43号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第44号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第45号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第46号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第47号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第48号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第49号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第50号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第51号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）'),
  ('議案第52号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）');

DO $$
DECLARE
  v_target_count integer;
  v_matched_count integer;
  v_non_review_status_count integer;
BEGIN
  SELECT count(*) INTO v_target_count
  FROM _r8d4_vote_result_target;

  SELECT count(*) INTO v_matched_count
  FROM public.bills b
  JOIN public.diet_sessions ds
    ON ds.id = b.diet_session_id
  JOIN _r8d4_vote_result_target t
    ON regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') = t.bill_number
  WHERE ds.slug = 'ishigaki-r8-dai4-teireikai'
    AND b.document_type = 'bill';

  IF v_matched_count <> v_target_count THEN
    RAISE EXCEPTION
      'Target match count mismatch: expected %, got % for session %',
      v_target_count,
      v_matched_count,
      'ishigaki-r8-dai4-teireikai';
  END IF;

  SELECT count(*) INTO v_non_review_status_count
  FROM public.bills b
  JOIN public.diet_sessions ds
    ON ds.id = b.diet_session_id
  JOIN _r8d4_vote_result_target t
    ON regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') = t.bill_number
  WHERE ds.slug = 'ishigaki-r8-dai4-teireikai'
    AND b.document_type = 'bill'
    AND b.status NOT IN (
      'introduced',
      'in_originating_house',
      'in_receiving_house'
    );

  IF v_non_review_status_count <> 0 THEN
    RAISE EXCEPTION
      'Unexpected existing status found in target bills: % rows are not in reviewable statuses',
      v_non_review_status_count;
  END IF;
END $$;

WITH target_rows AS (
  SELECT
    b.id,
    b.name,
    regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') AS bill_number,
    b.status AS old_status,
    b.status_note AS old_status_note,
    t.proposed_status,
    t.proposed_status_note
  FROM public.bills b
  JOIN public.diet_sessions ds
    ON ds.id = b.diet_session_id
  JOIN _r8d4_vote_result_target t
    ON regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') = t.bill_number
  WHERE ds.slug = 'ishigaki-r8-dai4-teireikai'
    AND b.document_type = 'bill'
)
UPDATE public.bills b
SET
  status = t.proposed_status,
  status_note = t.proposed_status_note,
  updated_at = now()
FROM target_rows t
WHERE b.id = t.id
RETURNING
  t.bill_number,
  b.name,
  t.old_status,
  b.status AS new_status,
  t.old_status_note,
  b.status_note AS new_status_note;

COMMIT;

-- =====================================================
-- 実行後確認クエリ（参考）
-- =====================================================
-- SELECT
--   regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') AS bill_number,
--   b.name,
--   b.status,
--   b.status_note
-- FROM public.bills b
-- JOIN public.diet_sessions ds
--   ON ds.id = b.diet_session_id
-- WHERE ds.slug = 'ishigaki-r8-dai4-teireikai'
--   AND regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') IN (
--     '議案第36号', '議案第37号', '議案第38号', '議案第39号', '議案第40号',
--     '議案第41号', '議案第42号', '議案第43号', '議案第44号', '議案第45号',
--     '議案第46号', '議案第47号', '議案第48号', '議案第49号', '議案第50号',
--     '議案第51号', '議案第52号'
--   )
-- ORDER BY bill_number;
