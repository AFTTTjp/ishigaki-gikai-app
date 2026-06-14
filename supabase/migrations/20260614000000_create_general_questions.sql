-- general_questions: 一般質問テーブル（議員×定例会の1エントリ）
-- 議員が1回の定例会で行う一般質問全体を表す。
-- 大項目は general_question_items に正規化し、キーワード検索・topic 連携を可能にする。

-- -------------------------------------------------------------------------
-- 1. general_questions テーブル
-- -------------------------------------------------------------------------
create table if not exists public.general_questions (
  id               uuid primary key default gen_random_uuid(),
  -- 一意識別子: ishigaki-r8-dai4-ippan-tomoyose-eizo
  slug             text not null unique,
  -- 定例会
  diet_session_id  uuid not null references public.diet_sessions(id),
  -- 質問議員
  member_id        uuid not null references public.members(id),
  -- 質問順番（定例会内、1始まり）
  question_number  int not null,
  -- 質問日
  question_date    date not null,
  -- 質問形式: floor=質問席, seat=自席
  seat_type        text not null check (seat_type in ('floor', 'seat')),
  -- ソース種別（公式PDF等）
  source_kind      text not null default 'official'
                   check (source_kind in ('official', 'newspaper_ocr', 'manual')),
  -- PDF上の氏名を保存（表記ゆれ追跡・監査用）
  member_name_raw  text,
  -- 公式ソースの場合はimport時に設定
  verified_at      timestamptz,
  -- 公開状態
  status           text not null default 'published'
                   check (status in ('published', 'draft')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 同一定例会で同じ順番は1件のみ
  unique (diet_session_id, question_number)
);

create index if not exists idx_general_questions_diet_session_id
  on public.general_questions(diet_session_id);

create index if not exists idx_general_questions_member_id
  on public.general_questions(member_id);

create index if not exists idx_general_questions_status_date
  on public.general_questions(status, question_date);

drop trigger if exists update_general_questions_updated_at on public.general_questions;
create trigger update_general_questions_updated_at
  before update on public.general_questions
  for each row execute function public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 2. general_question_items テーブル（大項目の正規化）
-- -------------------------------------------------------------------------
-- 「離島甲子園を検索 → どの議員が質問した?」のようなキーワード検索、
-- および将来の topic 連携（PR-D 以降）のために正規化する。
create table if not exists public.general_question_items (
  id                    uuid primary key default gen_random_uuid(),
  general_question_id   uuid not null references public.general_questions(id) on delete cascade,
  -- 大項目番号（1始まり）
  item_number           int not null,
  -- 大項目タイトル（例: 「定期航路事業について」）
  title                 text not null,
  -- 小項目リスト（例: ["採算性について", "船舶購入費について"]）
  -- Phase 1 では text[] に収める。将来の topic 連携は items レベルで行う。
  sub_items             text[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (general_question_id, item_number)
);

create index if not exists idx_general_question_items_general_question_id
  on public.general_question_items(general_question_id);

drop trigger if exists update_general_question_items_updated_at on public.general_question_items;
create trigger update_general_question_items_updated_at
  before update on public.general_question_items
  for each row execute function public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 3. RLS
-- -------------------------------------------------------------------------
alter table public.general_questions enable row level security;
alter table public.general_question_items enable row level security;

-- published の質問は匿名・認証ユーザーとも読み取り可
drop policy if exists "general_questions_public_read_published" on public.general_questions;
create policy "general_questions_public_read_published"
  on public.general_questions
  for select
  to anon, authenticated
  using (status = 'published');

-- items は親 question が published であれば読み取り可
drop policy if exists "general_question_items_public_read_published" on public.general_question_items;
create policy "general_question_items_public_read_published"
  on public.general_question_items
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.general_questions gq
      where gq.id = general_question_items.general_question_id
        and gq.status = 'published'
    )
  );
