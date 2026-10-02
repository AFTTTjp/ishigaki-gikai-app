-- 議員の「観測時点の所属」スナップショット（Phase 2A.1）
--
-- member_affiliations は「有効期間つきの履歴」で、valid_from が一次資料で確定した場合にだけ使う。
-- 公式資料から「ある時点でこの所属だった」とは分かるが、所属の開始日が分からない場合は
-- 開始日を推測せず、この member_affiliation_snapshots に観測として保存する。
--
-- このmigrationはスキーマのみ。データ投入・UI・importerの変更は行わない。

create table if not exists public.member_affiliation_snapshots (
  id                       uuid primary key default gen_random_uuid(),
  member_term_id           uuid not null
                           references public.member_terms(id) on delete cascade,
  party                    text,
  party_group              text,
  party_observed_on        date,
  party_group_observed_on  date,
  party_source_url         text,
  party_group_source_url   text,
  observed_on              date not null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- 同じ member_term に同じ基準日のsnapshotは1件だけ（観測が変われば別の observed_on で追加する）
  constraint member_affiliation_snapshots_term_observed_on_key
    unique (member_term_id, observed_on),

  -- 空文字は「値なし」と区別できないため禁止（値が無いなら NULL）
  constraint member_affiliation_snapshots_party_not_blank_check
    check (party is null or length(btrim(party)) > 0),
  constraint member_affiliation_snapshots_party_group_not_blank_check
    check (party_group is null or length(btrim(party_group)) > 0),

  -- 値があるなら、根拠となる資料の基準日と出典URLが必要
  constraint member_affiliation_snapshots_party_evidence_check
    check (
      party is null
      or (party_observed_on is not null and party_source_url is not null)
    ),
  constraint member_affiliation_snapshots_party_group_evidence_check
    check (
      party_group is null
      or (party_group_observed_on is not null and party_group_source_url is not null)
    ),

  -- 各資料の基準日より前の日付で、このsnapshotを記録したことにはできない
  constraint member_affiliation_snapshots_observed_on_after_sources_check
    check (
      (party_observed_on is null or observed_on >= party_observed_on)
      and (party_group_observed_on is null or observed_on >= party_group_observed_on)
    )
);

comment on table public.member_affiliation_snapshots is
  '議員任期ごとの「観測時点の所属」。所属の開始日を意味しない。member_affiliations（有効期間つきの履歴）とは用途が異なり、valid_from が確定しない現在値の保存に使う。append-only運用: 値を書き換えず、新しい観測は新しい observed_on の行として追加する';
comment on column public.member_affiliation_snapshots.member_term_id is
  '対象の議員任期（member_terms.id）。member_term を削除するとsnapshotも削除される（snapshot単体のDELETE権限は誰にも付与しない）';
comment on column public.member_affiliation_snapshots.party is
  '観測時点の所属政党。NULLは公式資料で確定できない/記載がないことを表す。所属の開始日は意味しない';
comment on column public.member_affiliation_snapshots.party_group is
  '観測時点の所属会派。NULLは公式資料で確定できない/記載がないことを表す（会派不明を保存できる）。「無会派」は公式資料が明記した場合にだけ文字列で保存する。所属の開始日は意味しない';
comment on column public.member_affiliation_snapshots.party_observed_on is
  'party の根拠資料が示す観測基準日（例: 議員名簿の更新日）。所属の開始日ではない';
comment on column public.member_affiliation_snapshots.party_group_observed_on is
  'party_group の根拠資料が示す観測基準日（例: 会派名簿の時点）。party_observed_on と異なり得る。所属の開始日ではない';
comment on column public.member_affiliation_snapshots.party_source_url is
  'party の根拠資料のURL。URLの形式検証はDBでは行わず、取り込み時のvalidationで行う';
comment on column public.member_affiliation_snapshots.party_group_source_url is
  'party_group の根拠資料のURL。URLの形式検証はDBでは行わず、取り込み時のvalidationで行う';
comment on column public.member_affiliation_snapshots.observed_on is
  'このsnapshotを正本として確認・記録した基準日（各資料の基準日以後）。各所属の開始日ではない。最新の observed_on のsnapshotを「現在の所属」として使う';
comment on column public.member_affiliation_snapshots.updated_at is
  'repo共通の列。snapshotはappend-onlyで、updated_at があっても通常のUPDATEで現在値を書き換えてはならない';

-- 最新snapshotの取得（member_term_id + observed_on の降順）は、
-- unique制約の索引（member_term_id, observed_on）の逆順走査で足りるため、追加の索引は作らない。

drop trigger if exists update_member_affiliation_snapshots_updated_at
  on public.member_affiliation_snapshots;
create trigger update_member_affiliation_snapshots_updated_at
  before update on public.member_affiliation_snapshots
  for each row execute function public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- RLS / GRANT
-- -------------------------------------------------------------------------
-- RLSを有効化。public read policy は作らない（デフォルト全拒否）。
-- アクセスは createAdminClient()（service_role）経由のみ。ブラウザから直接読ませない。
alter table public.member_affiliation_snapshots enable row level security;

-- default privilege に依存せず権限を明示する。
revoke all on public.member_affiliation_snapshots from anon, authenticated;
revoke all on public.member_affiliation_snapshots from service_role;

-- append-only を権限で担保する: service_role は SELECT / INSERT のみ。
-- UPDATE / DELETE は付与しない（訂正は新しい observed_on のsnapshotを追加して行う）。
-- 不要になった行は、親の member_term を削除したときの ON DELETE CASCADE でだけ消える。
grant select, insert on public.member_affiliation_snapshots to service_role;
