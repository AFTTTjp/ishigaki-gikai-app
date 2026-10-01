-- 議会任期・議員任期・所属履歴の基盤（Phase 1）
--
-- members は人物マスターとして維持し、任期ごとの情報を次の3テーブルに分離する。
--   council_terms        議会の任期（例: 4年間の任期）
--   member_terms         議員 × 議会任期（同一人物が再選しても members.id は不変）
--   member_affiliations  任期内の政党・会派の履歴（期間付き）
-- あわせて bill_member_votes に「採決時点の任期」を指す member_term_id を追加する。
--
-- このmigrationはスキーマのみ。実データ投入・backfillは行わない。

-- -------------------------------------------------------------------------
-- 1. council_terms
-- -------------------------------------------------------------------------
create table if not exists public.council_terms (
  id          uuid primary key default gen_random_uuid(),
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint council_terms_date_range_check check (start_date <= end_date),
  constraint council_terms_start_date_key unique (start_date)
);

comment on table public.council_terms is '議会の任期（改選から次の改選の前日まで）。期間の重複はDBでは防がず、投入時のvalidationで扱う';
comment on column public.council_terms.start_date is '任期開始日（含む）';
comment on column public.council_terms.end_date is '任期満了日（含む）';

-- -------------------------------------------------------------------------
-- 2. member_terms
-- -------------------------------------------------------------------------
create table if not exists public.member_terms (
  id               uuid primary key default gen_random_uuid(),
  council_term_id  uuid not null
                   references public.council_terms(id) on delete restrict,
  member_id        uuid not null
                   references public.members(id) on delete restrict,
  seat_number      integer,
  election_count   integer,
  start_date       date not null,
  end_date         date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint member_terms_seat_number_check
    check (seat_number is null or seat_number >= 1),
  constraint member_terms_election_count_check
    check (election_count is null or election_count >= 1),
  constraint member_terms_date_range_check
    check (end_date is null or start_date <= end_date),
  -- 同一人物は同一議会任期に1行のみ
  constraint member_terms_council_term_member_key
    unique (council_term_id, member_id),
  -- bill_member_votes の複合FK（member_term_id, member_id）の参照先
  constraint member_terms_id_member_id_key unique (id, member_id)
);

comment on table public.member_terms is '議員の任期ごとの在職情報。members.id は人物IDとして任期をまたいで維持する';
comment on column public.member_terms.seat_number is 'この任期での議席番号（参考値）。任期中に変わり得るためuniqueにしない。採決時点の議席は bill_member_votes.seat_number が正';
comment on column public.member_terms.election_count is 'この任期時点の当選回数';
comment on column public.member_terms.start_date is '在職開始日（通常は任期開始日。補欠当選などは当選後の日付）';
comment on column public.member_terms.end_date is '在職終了日。NULLは任期満了まで在職（辞職・失職等のみ設定する）';

create index if not exists idx_member_terms_member_id
  on public.member_terms using btree (member_id);

-- -------------------------------------------------------------------------
-- 3. member_affiliations
-- -------------------------------------------------------------------------
create table if not exists public.member_affiliations (
  id              uuid primary key default gen_random_uuid(),
  member_term_id  uuid not null
                  references public.member_terms(id) on delete cascade,
  party           text,
  party_group     text,
  valid_from      date not null,
  valid_to        date,
  source_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint member_affiliations_date_range_check
    check (valid_to is null or valid_from <= valid_to),
  constraint member_affiliations_term_valid_from_key
    unique (member_term_id, valid_from)
);

comment on table public.member_affiliations is '任期内の政党・会派の履歴。政党・会派のマスターは持たず文字列で保持する。期間のoverlapはDBでは防がない';
comment on column public.member_affiliations.valid_from is '所属の開始日（含む）';
comment on column public.member_affiliations.valid_to is '所属の終了日（含む）。NULLは継続中';
comment on column public.member_affiliations.source_url is '根拠となる公開資料のURL';

-- -------------------------------------------------------------------------
-- 4. bill_member_votes.member_term_id
-- -------------------------------------------------------------------------
-- NULLは従来どおり有効（既存行は変更しない）。
-- NULLでないときは、(member_term_id, member_id) が member_terms の (id, member_id) に
-- 一致する必要がある = 票の議員と任期の議員が必ず同一人物。
-- 複合FKはMATCH SIMPLEのため、member_term_id が NULL の行は検査されない。
alter table public.bill_member_votes
  add column if not exists member_term_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bill_member_votes_member_term_member_fkey'
      and conrelid = 'public.bill_member_votes'::regclass
  ) then
    alter table public.bill_member_votes
      add constraint bill_member_votes_member_term_member_fkey
      foreign key (member_term_id, member_id)
      references public.member_terms (id, member_id)
      on delete restrict;
  end if;
end
$$;

comment on column public.bill_member_votes.member_term_id is '採決時点の議員任期（member_terms.id）。NULLは未設定。member_idと同一人物であることを複合FKで保証する';

create index if not exists idx_bill_member_votes_member_term_id
  on public.bill_member_votes using btree (member_term_id)
  where member_term_id is not null;

-- -------------------------------------------------------------------------
-- 5. updated_at トリガー
-- -------------------------------------------------------------------------
drop trigger if exists update_council_terms_updated_at on public.council_terms;
create trigger update_council_terms_updated_at
  before update on public.council_terms
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_member_terms_updated_at on public.member_terms;
create trigger update_member_terms_updated_at
  before update on public.member_terms
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_member_affiliations_updated_at on public.member_affiliations;
create trigger update_member_affiliations_updated_at
  before update on public.member_affiliations
  for each row execute function public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- 6. RLS / GRANT
-- -------------------------------------------------------------------------
-- RLSを有効化。Phase 1では公開read policyを作らない（デフォルト全拒否）。
-- アクセスは createAdminClient()（service_role）経由のみ。
alter table public.council_terms enable row level security;
alter table public.member_terms enable row level security;
alter table public.member_affiliations enable row level security;

-- default privilege に依存せず、権限を明示する。
-- anon / authenticated には一切付与しない（過去のdefault privilegeで付いた分も剥がす）。
revoke all on public.council_terms from anon, authenticated;
revoke all on public.member_terms from anon, authenticated;
revoke all on public.member_affiliations from anon, authenticated;

-- service_role はPhase 2以降のimport / server処理に必要な最小権限（DML）のみ。
-- TRUNCATE / REFERENCES / TRIGGER は付与しない。
revoke all on public.council_terms from service_role;
revoke all on public.member_terms from service_role;
revoke all on public.member_affiliations from service_role;

grant select, insert, update, delete on public.council_terms to service_role;
grant select, insert, update, delete on public.member_terms to service_role;
grant select, insert, update, delete on public.member_affiliations to service_role;

-- -------------------------------------------------------------------------
-- 7. members のlegacy列の位置づけ（値は変更しない）
-- -------------------------------------------------------------------------
comment on column public.members.party is 'legacy snapshot（2022-2026任期時点）。既存UI互換のため残置。改選後も更新しない。新しい所属は member_affiliations に記録する';
comment on column public.members.party_group is 'legacy snapshot（2022-2026任期時点）。既存UI互換のため残置。改選後も更新しない。新しい所属は member_affiliations に記録する';
comment on column public.members.election_count is 'legacy snapshot（2022-2026任期時点）。既存UI互換のため残置。改選後も更新しない。新しい当選回数は member_terms.election_count に記録する';
