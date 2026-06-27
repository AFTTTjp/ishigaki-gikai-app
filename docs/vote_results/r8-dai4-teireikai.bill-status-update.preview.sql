-- 石垣市議会版 みらい議会
-- 令和8年第4回定例会 bills.status 更新前 preview-only SQL
--
-- 目的:
--   docs/vote_results/r8-dai4-teireikai.bill-status-update.review.sql を test DB に流す前に、
--   対象17件が実DB上でどう見えるかを UPDATE なしで確認する。
--
-- このSQLの性質:
--   - SELECT / WITH のみ
--   - INSERT / UPDATE / DELETE / DO / BEGIN / COMMIT を含まない
--   - DB を一切変更しない
--
-- 対象:
--   review artifact の bills[] 17件のみ
--
-- 実行前の環境ガード:
--   1. 接続先が test か prod か不明な場合は実行しない
--   2. `supabase db --linked` は使わない
--   3. SQL editor / psql / GUI など、接続先が目視で確認できる手段だけを使う
--   4. 確認すべき最低条件:
--      - project / host 名が test である
--      - app 側 env と混同していない
--      - prod URL / prod secret をこの段階で使わない
--
-- 期待する確認内容:
--   - diet_session slug = 'ishigaki-r8-dai4-teireikai' の対象17件がすべて存在する
--   - bill_number exact match で only 17件に絞れている
--   - current_status / current_status_note が review 可能な状態
--   - proposed_status / proposed_status_note が review artifact と一致している
--   - document_type != 'bill' や対象外番号が混ざっていない
--
-- 次の段階:
--   1. この preview SQL を test で確認
--   2. 問題なければ review SQL を test で transaction 実行
--   3. 戻り値 / 実行後 SELECT を確認
--   4. prod は別承認後
--   5. 反映後 revalidation:
--      - tags: bills, diet-sessions, topics
--      - 代表確認URL:
--        * /kokkai/ishigaki-r8-dai4-teireikai/bills
--        * /bills/<対象bill-id>
--        * /topics/rito-koshien-r8-dai4
--        * /topics/ishigaki-keelung-route-yaimamaru
--
WITH review_target AS (
  SELECT * FROM (
    VALUES
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
      ('議案第52号', 'enacted', '2026-06-24 可決（令和8年第4回定例会）')
  ) AS t(bill_number, proposed_status, proposed_status_note)
),
session_scope AS (
  SELECT id, slug, name, start_date, end_date
  FROM public.diet_sessions
  WHERE slug = 'ishigaki-r8-dai4-teireikai'
),
matched_bills AS (
  SELECT
    ds.slug AS diet_session_slug,
    ds.name AS diet_session_name,
    regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') AS bill_number,
    b.id AS bill_id,
    b.name AS bill_name,
    b.document_type,
    b.publish_status,
    b.status AS current_status,
    b.status_note AS current_status_note,
    rt.proposed_status,
    rt.proposed_status_note
  FROM public.bills b
  JOIN session_scope ds
    ON ds.id = b.diet_session_id
  LEFT JOIN review_target rt
    ON regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') = rt.bill_number
  WHERE regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') IN (
    SELECT bill_number FROM review_target
  )
)
SELECT
  diet_session_slug,
  diet_session_name,
  bill_number,
  bill_id,
  bill_name,
  document_type,
  publish_status,
  current_status,
  current_status_note,
  proposed_status,
  proposed_status_note,
  CASE
    WHEN proposed_status IS NULL THEN 'UNMATCHED_IN_REVIEW_TARGET'
    WHEN document_type <> 'bill' THEN 'UNEXPECTED_DOCUMENT_TYPE'
    WHEN current_status NOT IN ('introduced', 'in_originating_house', 'in_receiving_house') THEN 'CURRENT_STATUS_NEEDS_REVIEW'
    ELSE 'OK_FOR_REVIEW_SQL'
  END AS preview_judgement
FROM matched_bills
ORDER BY bill_number;

-- 件数サマリ確認用
WITH review_target AS (
  SELECT * FROM (
    VALUES
      ('議案第36号'),
      ('議案第37号'),
      ('議案第38号'),
      ('議案第39号'),
      ('議案第40号'),
      ('議案第41号'),
      ('議案第42号'),
      ('議案第43号'),
      ('議案第44号'),
      ('議案第45号'),
      ('議案第46号'),
      ('議案第47号'),
      ('議案第48号'),
      ('議案第49号'),
      ('議案第50号'),
      ('議案第51号'),
      ('議案第52号')
  ) AS t(bill_number)
),
session_scope AS (
  SELECT id
  FROM public.diet_sessions
  WHERE slug = 'ishigaki-r8-dai4-teireikai'
),
matched AS (
  SELECT regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') AS bill_number
  FROM public.bills b
  JOIN session_scope ds
    ON ds.id = b.diet_session_id
  WHERE regexp_replace(b.name, '^(議案第[0-9]+号).*$', '\1') IN (
    SELECT bill_number FROM review_target
  )
)
SELECT
  (SELECT count(*) FROM review_target) AS expected_target_count,
  (SELECT count(*) FROM matched) AS matched_count,
  (SELECT count(*) FROM matched WHERE bill_number NOT IN (SELECT bill_number FROM review_target)) AS unexpected_count,
  (SELECT count(*) FROM review_target WHERE bill_number NOT IN (SELECT bill_number FROM matched)) AS missing_count;
