-- topics テーブルに content_hard カラムを追加
-- difficulty=hard 選択時に表示する詳細版コンテンツ（Markdown）
-- NULL の場合は通常の content にフォールバック
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS content_hard TEXT;
