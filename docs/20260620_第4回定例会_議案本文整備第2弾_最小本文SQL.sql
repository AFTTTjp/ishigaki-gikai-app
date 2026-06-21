-- 石垣市議会版 みらい議会
-- 第4回定例会 議案本文整備 第2弾（最小本文スケルトン）
--
-- 目的:
--   会期ページの「提出議案」件数の正常化と、委員会セクションの議案名併記のため、
--   令和8年第4回定例会の残り議案（議案第36〜41号・43〜52号）を bills / bill_contents へ追加する。
--   ※ 議案第42号は第1弾で投入済みのため対象外。
--
-- 根拠（公式・確定情報のみ）:
--   石垣市議会「令和8年 第4回定例会 提出議案とその結果」議事日程（第1号）
--   https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html
--   から確認できた「議案番号・正式件名・付託委員会」のみを使用する。
--
-- 重要な方針（本文未確認の明記）:
--   - 提案理由・条文・金額・施行日・影響範囲は公式資料で未確認のため一切書かない（推測補完禁止）。
--   - bill_contents は「件名・付託委員会・会期・公式資料リンク」に限定した最小本文（スケルトン）とする。
--   - normal / hard は現時点では同一内容（厚い本文は提案説明・議案書の確定情報が得られてから別弾で差し替える）。
--   - 本文未確認である旨を content 内に明記する。
--   - bills.name は議事日程の正式件名と完全一致させる（「議案第○号 {件名}」）。
--   - uuid はハードコードしない。bill_id は name + diet_session_id で取得する。
--   - 既存議案（議案第42号等）は更新・削除しない（NOT EXISTS / ON CONFLICT で冪等）。
--   - publish_status は published。ただし実行は test 先行・prod は別途指示。
--   - トップ表示用 bills_tags / tags.featured_priority は本弾では付けない（会期ページ表示が目的）。
--
-- 対象（16件）と付託委員会:
--   経済民生委員会 : 議案第36,37,38,45,46号
--   建設土木委員会 : 議案第39,40,43,44,47号
--   総務財政委員会 : 議案第41,48,49,50,51,52号
--
-- 実行前確認:
--   SELECT slug, name, is_active FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai';
--   SELECT count(*) FROM bills WHERE diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai');
--
-- ===== test → prod 反映手順 =====
--   1. 接続先が test であることを確認する（SUPABASE_URL）。
--   2. test の Supabase でこの SQL を実行する。
--   3. 会期ページ /kokkai/ishigaki-r8-dai4-teireikai/bills で「提出議案」件数と委員会セクションの議案名併記を確認する。
--   4. 問題なければ、別途指示のうえ prod の Supabase で同じ SQL を実行する。
--   5. revalidate（下記）を実行する。
--
-- ===== revalidate（データ変更後に必須）=====
--   pnpm revalidate --all
--   もしくは対象タグ指定:
--   curl -X POST "https://ishigaki-gikai-app-web-coral.vercel.app/api/revalidate" \
--     -H "Content-Type: application/json" \
--     -d '{"tags":["bills","diet-sessions"]}'

BEGIN;

-- =====================================================
-- 0. 会期存在チェック（無ければ停止）
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai'
  ) THEN
    RAISE EXCEPTION 'diet_session not found: ishigaki-r8-dai4-teireikai';
  END IF;
END $$;

-- =====================================================
-- 1. 対象議案の定義（確定事実のみ：正式件名・付託委員会）
--    name        : bills.name と完全一致させる「議案第○号 {件名}」
--    clean_title : 番号を除いた件名（bill_contents.title・委員会セクション表示用）
--    committee   : 付託委員会（議事日程第1号）
-- =====================================================
CREATE TEMP TABLE _r8d4_bill_src (
  name        text NOT NULL,
  clean_title text NOT NULL,
  committee   text NOT NULL
) ON COMMIT DROP;

INSERT INTO _r8d4_bill_src (name, clean_title, committee) VALUES
  ('議案第36号 石垣市宿泊税基金条例',
   '石垣市宿泊税基金条例', '経済民生委員会'),
  ('議案第37号 石垣市火葬場の設置及び管理に関する条例',
   '石垣市火葬場の設置及び管理に関する条例', '経済民生委員会'),
  ('議案第38号 石垣市母子及び父子家庭等医療費助成に関する条例の一部を改正する条例',
   '石垣市母子及び父子家庭等医療費助成に関する条例の一部を改正する条例', '経済民生委員会'),
  ('議案第39号 石垣市下水道条例の一部を改正する条例',
   '石垣市下水道条例の一部を改正する条例', '建設土木委員会'),
  ('議案第40号 石垣市営住宅の設置及び管理に関する条例の一部を改正する条例',
   '石垣市営住宅の設置及び管理に関する条例の一部を改正する条例', '建設土木委員会'),
  ('議案第41号 桃原用昇奨学基金条例及び桃原用昇高等学校奨学基金条例の特例並びに廃止に関する条例',
   '桃原用昇奨学基金条例及び桃原用昇高等学校奨学基金条例の特例並びに廃止に関する条例', '総務財政委員会'),
  ('議案第43号 令和8年度石垣都市計画土地区画整理事業特別会計補正予算（第1号）',
   '令和8年度石垣都市計画土地区画整理事業特別会計補正予算（第1号）', '建設土木委員会'),
  ('議案第44号 令和8年度石垣市港湾事業特別会計補正予算（第1号）',
   '令和8年度石垣市港湾事業特別会計補正予算（第1号）', '建設土木委員会'),
  ('議案第45号 中華民国基隆市との国際友好都市提携について',
   '中華民国基隆市との国際友好都市提携について', '経済民生委員会'),
  ('議案第46号 八重山広域市町村圏事務組合規約の変更について',
   '八重山広域市町村圏事務組合規約の変更について', '経済民生委員会'),
  ('議案第47号 訴えの提起について',
   '訴えの提起について', '建設土木委員会'),
  ('議案第48号 財産の取得について［石垣市学習者用GIGA端末］',
   '財産の取得について［石垣市学習者用GIGA端末］', '総務財政委員会'),
  ('議案第49号 財産の取得について［石垣市指導者用GIGA端末］',
   '財産の取得について［石垣市指導者用GIGA端末］', '総務財政委員会'),
  ('議案第50号 財産の取得について［救助工作車］',
   '財産の取得について［救助工作車］', '総務財政委員会'),
  ('議案第51号 財産の取得について［高規格救急自動車］',
   '財産の取得について［高規格救急自動車］', '総務財政委員会'),
  ('議案第52号 石垣市ハラスメント調査に関する第三者委員会設置条例の一部を改正する条例',
   '石垣市ハラスメント調査に関する第三者委員会設置条例の一部を改正する条例', '総務財政委員会');

-- =====================================================
-- 2. bills へ追加（name + diet_session_id で重複スキップ）
--    値は第1弾（議案第42号）と同一方針。uuid はハードコードしない。
-- =====================================================
INSERT INTO public.bills (
  name,
  document_type,
  originating_house,
  status,
  publish_status,
  is_featured,
  status_note,
  published_at,
  shugiin_url,
  diet_session_id
)
SELECT
  s.name,
  'bill',
  'HR',
  'in_originating_house',
  'published',
  false,
  '審議中（令和8年第4回定例会）',
  '2026-06-08T00:00:00+09:00',
  'https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html',
  ds.id
FROM _r8d4_bill_src s
CROSS JOIN diet_sessions ds
WHERE ds.slug = 'ishigaki-r8-dai4-teireikai'
  AND NOT EXISTS (
    SELECT 1
      FROM public.bills b
     WHERE b.name = s.name
       AND b.diet_session_id = ds.id
  );

-- =====================================================
-- 3. bill_contents（normal / hard）を追加・更新
--    最小本文（件名・付託委員会・会期・公式リンク・本文未確認の明記）のみ。
--    bill_id は name + diet_session_id で取得（uuid ハードコードなし）。
-- =====================================================
INSERT INTO public.bill_contents (
  bill_id,
  difficulty_level,
  title,
  summary,
  content
)
SELECT
  b.id,
  d.level,
  s.clean_title,
  s.clean_title
    || 'です。令和8年第4回石垣市議会（定例会）で'
    || s.committee
    || 'に付託されました。条文・提案理由・金額・施行日などの詳しい内容は、公式の議案資料をご確認ください。',
  '# ' || s.clean_title || E'\n\n'
    || '令和8年第4回石垣市議会（定例会）に提出された議案です。' || E'\n\n'
    || '- 件名：' || s.clean_title || E'\n'
    || '- 付託委員会：' || s.committee || E'\n'
    || '- 会期：令和8年第4回定例会（令和8年6月8日〜6月24日）' || E'\n\n'
    || '※ 提案理由・条文・金額・施行日・影響範囲などの本文は、現時点で公式資料から確認できていないため記載していません。確定情報は下記の公式資料をご確認ください。' || E'\n\n'
    || '## 関連リンク' || E'\n'
    || '- [令和8年第4回定例会 提出議案とその結果](https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html)'
FROM _r8d4_bill_src s
JOIN diet_sessions ds
  ON ds.slug = 'ishigaki-r8-dai4-teireikai'
JOIN public.bills b
  ON b.name = s.name
 AND b.diet_session_id = ds.id
CROSS JOIN (
  VALUES ('normal'::difficulty_level_enum), ('hard'::difficulty_level_enum)
) AS d(level)
ON CONFLICT (bill_id, difficulty_level) DO UPDATE SET
  title      = excluded.title,
  summary    = excluded.summary,
  content    = excluded.content,
  updated_at = NOW();

COMMIT;

-- =====================================================
-- 実行後の確認クエリ（参考）
-- =====================================================
-- SELECT count(*) FROM bills
--  WHERE diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai');
--   -- 期待: 議案第42号 + 本弾16件 = 17件
--
-- SELECT b.name, bc.difficulty_level, bc.title
--   FROM bills b
--   JOIN bill_contents bc ON bc.bill_id = b.id
--  WHERE b.diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai')
--  ORDER BY b.name, bc.difficulty_level;
