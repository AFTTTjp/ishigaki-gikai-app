-- 石垣市議会版 みらい議会
-- 第4回定例会 議案本文整備 第1弾（最小追加）
--
-- 目的:
--   rito-koshien-r8-dai4.topic.json の related bill を解決するため、
--   bills / bill_contents に議案第42号を追加する。
--
-- 対象:
--   1. 議案第42号 令和8年度石垣市一般会計補正予算（第1号）
--
-- 方針:
--   - 第4回定例会の全議案追加には広げない（このファイルは議案第42号のみ）
--   - 金額・費目の推測は含めない
--   - 本文は推奨構成（ポイント / 必要な理由 / 主な論点 / 影響を受ける人 / 関連リンク）
--   - bills.name は topic JSON の bill_name と完全一致させる
--     `議案第42号 令和8年度石垣市一般会計補正予算（第1号）`
--   - 既存議案を更新・削除しない
--
-- 実行前確認:
--   SELECT slug, name, is_active FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai';
--   SELECT count(*) FROM bills WHERE diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai');
--
-- 実行後確認:
--   SELECT id, name, status, publish_status FROM bills WHERE name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）';
--   SELECT difficulty_level, title FROM bill_contents WHERE bill_id = (SELECT id FROM bills WHERE name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）');

BEGIN;

-- =====================================================
-- 1. 議案第42号 を bills へ追加
-- =====================================================
DO $$
DECLARE
  v_session_r8_4 uuid;
  v_bill_id_42   uuid;
BEGIN
  -- 会期IDを取得（存在しない場合は RAISE で停止）
  SELECT id INTO v_session_r8_4
    FROM diet_sessions
   WHERE slug = 'ishigaki-r8-dai4-teireikai';

  IF v_session_r8_4 IS NULL THEN
    RAISE EXCEPTION 'diet_session not found: ishigaki-r8-dai4-teireikai';
  END IF;

  -- 重複チェックしてINSERT
  IF NOT EXISTS (
    SELECT 1 FROM bills
     WHERE name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）'
       AND diet_session_id = v_session_r8_4
  ) THEN
    INSERT INTO bills (
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
    ) VALUES (
      '議案第42号 令和8年度石垣市一般会計補正予算（第1号）',
      'bill',
      'HR',
      'in_originating_house',
      'published',
      false,
      '審議中（令和8年第4回定例会）',
      '2026-06-08T00:00:00+09:00',
      'https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html',
      v_session_r8_4
    )
    RETURNING id INTO v_bill_id_42;

    RAISE NOTICE '議案第42号を追加しました: %', v_bill_id_42;
  ELSE
    SELECT id INTO v_bill_id_42
      FROM bills
     WHERE name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）'
       AND diet_session_id = v_session_r8_4;

    RAISE NOTICE '議案第42号は既に存在します: %', v_bill_id_42;
  END IF;
END $$;

-- =====================================================
-- 2. bill_contents（normal / hard）を追加
-- =====================================================
INSERT INTO public.bill_contents (
  bill_id,
  difficulty_level,
  title,
  summary,
  content
)
VALUES
  -- ------------------------------------------------
  -- normal
  -- ------------------------------------------------
  (
    (SELECT id FROM bills WHERE name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）' AND diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai')),
    'normal',
    '令和8年度石垣市一般会計補正予算（第1号）とは',
    '令和8年度（2026年度）の石垣市一般会計予算を補正する、第1号となる補正予算案です。当初予算に計上されなかった事業経費を追加する内容が含まれています。',
    E'# 令和8年度石垣市一般会計補正予算（第1号）とは\n\n## この議案のポイント\n\n- 令和8年度当初予算に計上されなかった事業経費を追加する補正予算案です\n- 第1号補正であるため、年度開始後に生じた必要性に対応するものです\n- 補正の内容・財源・規模は議会審議の場で説明されます\n\n## この議案が必要な理由\n\n当初予算は年度開始前に策定されるため、その後に生じた行政需要や、当初時点で計上が難しかった事業経費に対応するには補正予算を組む必要があります。補正予算案は議会の議決を経ることで効力を持ちます。\n\n## 主な論点\n\n- 当初予算に計上されなかった経費の追加を求める理由が十分か\n- 補正の財源として何を充てているか\n- 補正の規模が適切か\n\n## 影響を受ける人\n\n- 市民全般（市の予算規模・財政運営に関心を持つ人）\n- 補正で追加された事業に関係する団体・市民\n\n## 関連リンク\n\n- [令和8年第4回定例会 提出議案とその結果](https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html)'
  ),
  -- ------------------------------------------------
  -- hard
  -- ------------------------------------------------
  (
    (SELECT id FROM bills WHERE name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）' AND diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai')),
    'hard',
    '令和8年度石垣市一般会計補正予算（第1号）',
    '令和8年度一般会計補正予算（第1号）を定める議案。当初予算成立後に生じた行政需要に対応するため、歳入・歳出の追加補正を行うものです。',
    E'# 令和8年度石垣市一般会計補正予算（第1号）\n\n## この議案のポイント\n\n- 令和8年度（2026年度）石垣市一般会計予算を補正する第1号となる補正予算案です\n- 地方自治法第218条第1項の規定に基づき、首長が議会に提出する補正予算案です\n- 歳入・歳出の追加額と財源の内訳は、議案本文・予算書に記載されています\n\n## この議案が必要な理由\n\n補正予算は、当初予算の成立後に生じた事情の変化や、当初時点では計上が困難だった行政需要に対応するために提出されます。地方自治法上、補正予算も当初予算と同様に議会の議決が必要です。補正の理由・内容・財源については、理由書や担当課の説明を通じて議会で確認されます。\n\n## 主な論点\n\n### 1. 補正の必要性\n- 当初予算に計上できなかった理由が適切に説明されているか\n- 事業の緊急性・必要性が議会で審議されます\n\n### 2. 財源の根拠\n- 歳入の財源として何を充てているか（繰越金、国県補助金、市債等）\n- 財源の妥当性・持続性が問われます\n\n### 3. 補正の規模と予算全体への影響\n- 補正後の予算総額と市の財政状況への影響\n- 当初予算比での変化が論点になります\n\n## 影響を受ける人\n\n- 市の財政・予算執行に関心を持つ市民\n- 補正で追加された事業に関係する団体・事業者・市民\n- 市議会議員（審議・採決の主体）\n\n## 関連リンク\n\n- [令和8年第4回定例会 提出議案とその結果](https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html)'
  )
ON CONFLICT (bill_id, difficulty_level) DO UPDATE SET
  title      = excluded.title,
  summary    = excluded.summary,
  content    = excluded.content,
  updated_at = NOW();

COMMIT;

-- =====================================================
-- 実行後の確認クエリ（参考）
-- =====================================================
-- SELECT b.id, b.name, b.status, b.publish_status, b.diet_session_id,
--        bc.difficulty_level, bc.title
--   FROM bills b
--   JOIN bill_contents bc ON bc.bill_id = b.id
--  WHERE b.name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）'
--    AND b.diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai')
--  ORDER BY bc.difficulty_level;
