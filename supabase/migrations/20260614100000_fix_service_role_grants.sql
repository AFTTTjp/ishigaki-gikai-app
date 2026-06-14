-- service_role が全テーブルを操作できるよう GRANT を明示する
-- Supabase PostgreSQL image の更新で初期化スクリプトでの自動付与が
-- されなくなったため、既存テーブルと将来のテーブルに対して明示する。
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
