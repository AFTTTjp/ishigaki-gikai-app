-- council_actions: 議会アクション（要請活動・申し入れ・意見書提出など）
-- 議案に紐づく「議案後のアクション」として管理する。
-- Topic とは直接紐付けず、bill → topic の既存経路で辿る。

-- -------------------------------------------------------------------------
-- 1. council_actions テーブル
-- -------------------------------------------------------------------------
create table if not exists public.council_actions (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  kind          text not null check (kind in (
                  'advocacy',           -- 要請活動
                  'request',            -- 申し入れ
                  'inspection',         -- 現地視察・調査
                  'submission',         -- 意見書・パブコメ提出
                  'resolution_delivery' -- 抗議決議送付
                )),
  title         text not null,
  action_date   date not null,
  destination_name text not null,       -- 宛先名（例: 石垣市長）
  destination_role text,                -- 宛先役職
  destination_body text,                -- 宛先機関（例: 石垣市）
  description   text not null default '',
  official_url  text,
  source_url    text,
  image_url     text,
  status        text not null default 'published'
                check (status in ('published', 'draft')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_council_actions_status_action_date
  on public.council_actions(status, action_date desc);

drop trigger if exists update_council_actions_updated_at on public.council_actions;
create trigger update_council_actions_updated_at
  before update on public.council_actions
  for each row execute function public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 2. council_action_bills テーブル（多対多）
-- -------------------------------------------------------------------------
create table if not exists public.council_action_bills (
  id                 uuid primary key default gen_random_uuid(),
  council_action_id  uuid not null references public.council_actions(id) on delete cascade,
  bill_id            uuid not null references public.bills(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (council_action_id, bill_id)
);

create index if not exists idx_council_action_bills_council_action_id
  on public.council_action_bills(council_action_id);

create index if not exists idx_council_action_bills_bill_id
  on public.council_action_bills(bill_id);

-- -------------------------------------------------------------------------
-- 3. RLS（ポリシーなし・Service Role Key でのみアクセス）
-- -------------------------------------------------------------------------
alter table public.council_actions enable row level security;
alter table public.council_action_bills enable row level security;

-- published のアクションは公開読み取り可
drop policy if exists "council_actions_public_read_published" on public.council_actions;
create policy "council_actions_public_read_published"
  on public.council_actions
  for select
  to anon, authenticated
  using (status = 'published');

-- council_action_bills は published アクション経由のみ公開
drop policy if exists "council_action_bills_public_read_published" on public.council_action_bills;
create policy "council_action_bills_public_read_published"
  on public.council_action_bills
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.council_actions ca
      where ca.id = council_action_bills.council_action_id
        and ca.status = 'published'
    )
  );
