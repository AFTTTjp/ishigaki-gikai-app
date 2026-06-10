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
--   - 議案第42号は補正予算全体の議案であり「離島甲子園だけの議案」とは書かない
--   - 公式資料で未確認の事実は断定しない
--
-- 実行前確認:
--   SELECT slug, name, is_active FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai';
--   SELECT count(*) FROM bills WHERE diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai');
--
-- 実行後確認:
--   SELECT id, name, status, publish_status FROM bills WHERE name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）' AND diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai');
--   SELECT difficulty_level, title FROM bill_contents WHERE bill_id = (SELECT id FROM bills WHERE name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）' AND diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai'));

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
-- 2. bill_contents（normal / hard）を追加・更新
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
    '令和8年度の石垣市一般会計予算を補正する第1号の議案です。今回の補正予算には離島甲子園への参加に関係する経費が含まれており、議会でその妥当性が審議されます。',
    E'# 令和8年度石垣市一般会計補正予算（第1号）とは\n\n## この議案のポイント\n\n- 令和8年度の一般会計予算を補正する第1号の議案です\n- 今回の補正予算には、離島甲子園への参加に関係する経費が含まれています\n- 離島甲子園は全国の離島地域の中学生が参加する大会で、石垣市選抜はこれまで継続的に参加してきました\n- 議会では、補正予算として経費を追加する妥当性・財源・規模について審議が行われます\n\n## この議案が必要な理由\n\n補正予算は、当初予算の策定後に生じた行政需要や、当初予算に計上しきれなかった事業経費を追加するために提出されます。議会の議決を経ることで効力を持ちます。\n\n## 主な論点\n\n- 補正予算として経費を追加する理由が適切に説明されているか\n- 財源として何を充てているか\n- 補正の規模が適切か\n\n## 影響を受ける人\n\n- 離島甲子園への参加を希望する市内中学生・関係者\n- 市民全般（市の財政運営に関心を持つ人）\n\n## 関連リンク\n\n- [令和8年第4回定例会 提出議案とその結果](https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html)'
  ),
  -- ------------------------------------------------
  -- hard
  -- ------------------------------------------------
  (
    (SELECT id FROM bills WHERE name = '議案第42号 令和8年度石垣市一般会計補正予算（第1号）' AND diet_session_id = (SELECT id FROM diet_sessions WHERE slug = 'ishigaki-r8-dai4-teireikai')),
    'hard',
    '令和8年度石垣市一般会計補正予算（第1号）',
    '令和8年度一般会計補正予算（第1号）を定める議案。今回の補正予算には離島甲子園への参加に関係する経費が含まれており、予算計上の経緯・財源・必要性が議会で確認されます。なお、議案全体は離島甲子園関連以外の項目も含む補正予算です。',
    E'# 令和8年度石垣市一般会計補正予算（第1号）\n\n## この議案のポイント\n\n- 令和8年度（2026年度）石垣市一般会計予算を補正する第1号となる補正予算案です\n- 地方自治法第218条第1項の規定に基づき、首長が議会に提出する補正予算案です\n- 今回の補正予算には、離島甲子園への参加に関係する経費が含まれており、この点が議会・市民から注目されています\n- ただし、議案全体は離島甲子園関連以外の項目も含む補正予算であり、予算書全体の内容が審議の対象となります\n\n## この議案が必要な理由\n\n補正予算は、当初予算の成立後に生じた事情の変化や、当初時点では計上が困難だった行政需要に対応するために提出されます。地方自治法上、補正予算も当初予算と同様に議会の議決が必要です。補正の理由・内容・財源については、理由書や担当課の説明を通じて議会で確認されます。\n\n## 議会が確認するポイント\n\n### 1. 補正の必要性\n- 補正予算で経費を追加することの理由・根拠が適切に説明されているか\n- 各項目の緊急性・必要性\n\n### 2. 財源の根拠\n- 歳入の財源として何を充てているか（繰越金、国県補助金、市債等）\n- 財源の妥当性・持続性\n\n### 3. 予算計上の経緯\n- 補正予算として追加することになった経緯・背景\n- 関係する審議・調整の経過\n\n## 離島甲子園関連経費が注目される背景\n\n離島甲子園は、全国の離島地域の中学生が参加する大会で、石垣市選抜はこれまで継続的に参加してきた実績があります。今回の補正予算にはこの参加に関係する経費が含まれており、予算計上の経緯や参加に向けた実務上の調整も論点になっています。\n\n## 関連リンク\n\n- [令和8年第4回定例会 提出議案とその結果](https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html)'
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
