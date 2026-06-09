-- 令和8年第4回石垣市議会定例会（2026年6月）を追加し、アクティブ会期として設定する
-- 会期: 2026-06-08 〜 2026-06-24（17日間）
-- 公式ページ: https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html

-- =====================================================
-- 1. 令和8年第4回定例会を追加
-- =====================================================
INSERT INTO diet_sessions (name, slug, start_date, end_date, is_active, shugiin_url)
VALUES (
  '令和8年第4回定例会',
  'ishigaki-r8-dai4-teireikai',
  '2026-06-08',
  '2026-06-24',
  false, -- is_active は直後の RPC で原子的に設定する
  'https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html'
)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. 当会期をアクティブに設定（他会期は自動で非アクティブ化）
-- =====================================================
SELECT set_active_diet_session(id)
FROM diet_sessions
WHERE slug = 'ishigaki-r8-dai4-teireikai';
