-- Apply the approved difficulty-specific titles for R8 4th regular session.
-- Reviewer source of truth:
--   docs/difficulty-content-decisions/r8-dai4-bill-title-editorial-review.json
--   commit 937d55b1254278ee7542e6076c049a8ce153361b
--
-- Scope:
--   - 16 approved bills (Bills 36-41 and 43-52)
--   - 32 explicitly identified bill_contents rows
--   - title only
--
-- Bill 42, bills.name, summary, content, and every non-target row are excluded.
-- The existing update_bill_contents_updated_at trigger updates updated_at for
-- rows whose title changes; no other application field is assigned here.

begin;
set transaction isolation level serializable;

create temp table _r8_dai4_title_target_bills (
  bill_number integer primary key,
  bill_id uuid not null unique,
  official_bill_name text not null
) on commit drop;

insert into _r8_dai4_title_target_bills
  (bill_number, bill_id, official_bill_name)
values
  (36, 'af3d7d0d-e943-42c1-b78e-1df1663cef57'::uuid, '議案第36号 石垣市宿泊税基金条例'),
  (37, 'eacc3ff7-8158-42e2-8cd6-d24aaf7610ab'::uuid, '議案第37号 石垣市火葬場の設置及び管理に関する条例'),
  (38, 'f6485217-fd51-4f67-8780-6ec3cddd5e72'::uuid, '議案第38号 石垣市母子及び父子家庭等医療費助成に関する条例の一部を改正する条例'),
  (39, '887473f9-3877-4583-bfc9-272394b678ef'::uuid, '議案第39号 石垣市下水道条例の一部を改正する条例'),
  (40, '00f6cac1-3ec1-4545-9d58-d553d3576336'::uuid, '議案第40号 石垣市営住宅の設置及び管理に関する条例の一部を改正する条例'),
  (41, 'f00da203-9d45-40c8-a054-c6c0c7558d1c'::uuid, '議案第41号 桃原用昇奨学基金条例及び桃原用昇高等学校奨学基金条例の特例並びに廃止に関する条例'),
  (43, 'c7472bf2-22b9-4b4a-9a4b-deb723bfda25'::uuid, '議案第43号 令和8年度石垣都市計画土地区画整理事業特別会計補正予算（第1号）'),
  (44, '1358ebc5-ffe7-4362-b9e4-f3c09925abe5'::uuid, '議案第44号 令和8年度石垣市港湾事業特別会計補正予算（第1号）'),
  (45, '3083e8b4-1895-4b98-814d-fd6be2b68591'::uuid, '議案第45号 中華民国基隆市との国際友好都市提携について'),
  (46, 'aa3babc3-334a-475f-8662-f735a7d1fd17'::uuid, '議案第46号 八重山広域市町村圏事務組合規約の変更について'),
  (47, '29064eb3-8ece-4a8d-b251-329e701f8958'::uuid, '議案第47号 訴えの提起について'),
  (48, '59c68afe-bc47-41f5-b293-3fb7bc28ad91'::uuid, '議案第48号 財産の取得について［石垣市学習者用GIGA端末］'),
  (49, 'bb78e020-e6f2-4b2d-a9ce-0ffc2c691565'::uuid, '議案第49号 財産の取得について［石垣市指導者用GIGA端末］'),
  (50, 'a38b88bd-c27e-4486-bbf1-cff49871d08b'::uuid, '議案第50号 財産の取得について［救助工作車］'),
  (51, '1e76df71-9e50-4d01-a21e-ced0601be4f9'::uuid, '議案第51号 財産の取得について［高規格救急自動車］'),
  (52, '722564a1-2e89-4589-a3b2-f6614f10c200'::uuid, '議案第52号 石垣市ハラスメント調査に関する第三者委員会設置条例の一部を改正する条例');

create temp table _r8_dai4_title_decisions (
  bill_id uuid not null,
  content_id uuid primary key,
  difficulty_level difficulty_level_enum not null,
  expected_old_title text not null,
  approved_title text not null,
  unique (bill_id, difficulty_level)
) on commit drop;

insert into _r8_dai4_title_decisions
  (bill_id, content_id, difficulty_level, expected_old_title, approved_title)
values
  ('af3d7d0d-e943-42c1-b78e-1df1663cef57'::uuid, 'f73818fe-ba01-4368-991e-9464336fff91'::uuid, 'normal'::difficulty_level_enum, '石垣市宿泊税基金条例', '宿泊税の税収を管理し観光振興に活用する基金の新設'),
  ('af3d7d0d-e943-42c1-b78e-1df1663cef57'::uuid, '4ca92022-3fcc-4c01-a384-2c4754c3e6e8'::uuid, 'hard'::difficulty_level_enum, '石垣市宿泊税基金条例', '石垣市宿泊税基金条例'),
  ('eacc3ff7-8158-42e2-8cd6-d24aaf7610ab'::uuid, 'ede76acd-4b51-4079-aa79-2b3aaca05b91'::uuid, 'normal'::difficulty_level_enum, '石垣市火葬場の設置及び管理に関する条例', '火葬場に指定管理者制度を導入するための条例改正'),
  ('eacc3ff7-8158-42e2-8cd6-d24aaf7610ab'::uuid, '53442250-c7a4-42ae-b899-e4aefa4969ac'::uuid, 'hard'::difficulty_level_enum, '石垣市火葬場の設置及び管理に関する条例', '石垣市火葬場の設置及び管理に関する条例'),
  ('f6485217-fd51-4f67-8780-6ec3cddd5e72'::uuid, 'a03eb839-c049-42c4-9afa-8531f80a0e77'::uuid, 'normal'::difficulty_level_enum, '石垣市母子及び父子家庭等医療費助成に関する条例の一部を改正する条例', 'ひとり親家庭などの医療費助成における児童の定義見直し'),
  ('f6485217-fd51-4f67-8780-6ec3cddd5e72'::uuid, 'aad8cd49-b0dd-4984-8458-d94df430b70e'::uuid, 'hard'::difficulty_level_enum, '石垣市母子及び父子家庭等医療費助成に関する条例の一部を改正する条例', '石垣市母子及び父子家庭等医療費助成に関する条例の一部を改正する条例'),
  ('887473f9-3877-4583-bfc9-272394b678ef'::uuid, '28809dbf-f2d8-4f5f-bc02-0fb69c15e877'::uuid, 'normal'::difficulty_level_enum, '石垣市下水道条例の一部を改正する条例', '災害時の下水道復旧工事を担う工事店の範囲拡大'),
  ('887473f9-3877-4583-bfc9-272394b678ef'::uuid, 'f0d9adaf-d1c6-448f-9341-fee02c62b819'::uuid, 'hard'::difficulty_level_enum, '石垣市下水道条例の一部を改正する条例', '石垣市下水道条例の一部を改正する条例'),
  ('00f6cac1-3ec1-4545-9d58-d553d3576336'::uuid, '5d086568-c9ff-4985-b56f-5713f6f55136'::uuid, 'normal'::difficulty_level_enum, '石垣市営住宅の設置及び管理に関する条例の一部を改正する条例', '市営住宅の入居選考見直しと子育て世帯向け期限付き入居制度の新設'),
  ('00f6cac1-3ec1-4545-9d58-d553d3576336'::uuid, '77c61f74-ae7e-42fc-b7d7-e4e9bf6c6a8e'::uuid, 'hard'::difficulty_level_enum, '石垣市営住宅の設置及び管理に関する条例の一部を改正する条例', '石垣市営住宅の設置及び管理に関する条例の一部を改正する条例'),
  ('f00da203-9d45-40c8-a054-c6c0c7558d1c'::uuid, 'a4b5feaa-6cde-42bf-8e3a-2ec9d7403528'::uuid, 'normal'::difficulty_level_enum, '桃原用昇奨学基金条例及び桃原用昇高等学校奨学基金条例の特例並びに廃止に関する条例', '2つの奨学基金事業を新設財団へ引き継ぐための条例整備'),
  ('f00da203-9d45-40c8-a054-c6c0c7558d1c'::uuid, '71e24e24-b3ff-41a9-a481-2d4fb5389f55'::uuid, 'hard'::difficulty_level_enum, '桃原用昇奨学基金条例及び桃原用昇高等学校奨学基金条例の特例並びに廃止に関する条例', '桃原用昇奨学基金条例及び桃原用昇高等学校奨学基金条例の特例並びに廃止に関する条例'),
  ('c7472bf2-22b9-4b4a-9a4b-deb723bfda25'::uuid, '7aaba7af-95d3-4211-90e9-8ea022899896'::uuid, 'normal'::difficulty_level_enum, '土地区画整理事業特別会計の補正予算', '土地区画整理事業特別会計の補正予算'),
  ('c7472bf2-22b9-4b4a-9a4b-deb723bfda25'::uuid, '9be4e357-fa95-48d9-b118-4c169b900cf0'::uuid, 'hard'::difficulty_level_enum, '土地区画整理事業特別会計の補正予算', '令和8年度石垣都市計画土地区画整理事業特別会計補正予算（第1号）'),
  ('1358ebc5-ffe7-4362-b9e4-f3c09925abe5'::uuid, '5e4d669f-0fa0-4fd1-a844-371bf91737fe'::uuid, 'normal'::difficulty_level_enum, '港湾事業特別会計の補正予算', '港湾事業特別会計の補正予算'),
  ('1358ebc5-ffe7-4362-b9e4-f3c09925abe5'::uuid, '3666bc34-bd3f-4ce1-9ee3-4c266d7357fa'::uuid, 'hard'::difficulty_level_enum, '港湾事業特別会計の補正予算', '令和8年度石垣市港湾事業特別会計補正予算（第1号）'),
  ('3083e8b4-1895-4b98-814d-fd6be2b68591'::uuid, '179803a8-97bc-40b2-b2d7-18c2cd1a8795'::uuid, 'normal'::difficulty_level_enum, '中華民国基隆市との国際友好都市提携について', '台湾・基隆市との国際友好都市提携'),
  ('3083e8b4-1895-4b98-814d-fd6be2b68591'::uuid, 'b3967ccf-6a5d-458a-9fd4-0662269d2766'::uuid, 'hard'::difficulty_level_enum, '中華民国基隆市との国際友好都市提携について', '中華民国基隆市との国際友好都市提携について'),
  ('aa3babc3-334a-475f-8662-f735a7d1fd17'::uuid, '2875f958-1879-4f8a-9446-b5c3df8ed2c0'::uuid, 'normal'::difficulty_level_enum, '八重山広域市町村圏事務組合規約の変更', '介護認定審査会事務を共同処理から外す八重山広域市町村圏事務組合の規約変更'),
  ('aa3babc3-334a-475f-8662-f735a7d1fd17'::uuid, 'a9c75008-dcda-4bd2-8be8-1ca300cf8b62'::uuid, 'hard'::difficulty_level_enum, '八重山広域市町村圏事務組合規約の変更', '八重山広域市町村圏事務組合規約の変更について'),
  ('29064eb3-8ece-4a8d-b251-329e701f8958'::uuid, '376ec95c-dc1a-46e4-93b0-7fb787ef7b9f'::uuid, 'normal'::difficulty_level_enum, '市営住宅の明渡し等を求める訴え', '市営住宅の明渡し等を求める訴え'),
  ('29064eb3-8ece-4a8d-b251-329e701f8958'::uuid, '65042ce2-1b6f-47fc-960e-10497bc4e4a2'::uuid, 'hard'::difficulty_level_enum, '市営住宅の明渡し等を求める訴え', '訴えの提起について'),
  ('59c68afe-bc47-41f5-b293-3fb7bc28ad91'::uuid, '8b299050-3e7a-4b19-b6ae-9abfc4dbf3d5'::uuid, 'normal'::difficulty_level_enum, '児童生徒用GIGA端末の取得', '児童生徒用GIGA端末の取得'),
  ('59c68afe-bc47-41f5-b293-3fb7bc28ad91'::uuid, '1f4e5e32-1f83-46c1-afc0-161d45e99110'::uuid, 'hard'::difficulty_level_enum, '児童生徒用GIGA端末の取得', '財産の取得について［石垣市学習者用GIGA端末］'),
  ('bb78e020-e6f2-4b2d-a9ce-0ffc2c691565'::uuid, '67ead6e1-189b-43e6-a6fd-23746fdffd5c'::uuid, 'normal'::difficulty_level_enum, '教員用GIGA端末の取得', '教員用GIGA端末の取得'),
  ('bb78e020-e6f2-4b2d-a9ce-0ffc2c691565'::uuid, '2e551fd7-dca7-4caf-b7dc-70007e99b296'::uuid, 'hard'::difficulty_level_enum, '教員用GIGA端末の取得', '財産の取得について［石垣市指導者用GIGA端末］'),
  ('a38b88bd-c27e-4486-bbf1-cff49871d08b'::uuid, 'eb92fa3f-9b44-4477-87b6-c8e3259643e0'::uuid, 'normal'::difficulty_level_enum, '財産の取得について［救助工作車］', '救助工作車1台の取得'),
  ('a38b88bd-c27e-4486-bbf1-cff49871d08b'::uuid, 'aba9fa07-aeac-4fac-a48e-806828faed8d'::uuid, 'hard'::difficulty_level_enum, '財産の取得について［救助工作車］', '財産の取得について［救助工作車］'),
  ('1e76df71-9e50-4d01-a21e-ced0601be4f9'::uuid, '57f46aa8-a3d4-4203-8c1b-4bf800610e4e'::uuid, 'normal'::difficulty_level_enum, '財産の取得について［高規格救急自動車］', '高規格救急自動車1台の取得'),
  ('1e76df71-9e50-4d01-a21e-ced0601be4f9'::uuid, 'c24d36ed-6411-4ee8-a264-a3d83b5d8e4a'::uuid, 'hard'::difficulty_level_enum, '財産の取得について［高規格救急自動車］', '財産の取得について［高規格救急自動車］'),
  ('722564a1-2e89-4589-a3b2-f6614f10c200'::uuid, 'aabc6e96-c38b-443a-881f-cddc06d7dab9'::uuid, 'normal'::difficulty_level_enum, '石垣市ハラスメント調査に関する第三者委員会設置条例の一部を改正する条例', 'ハラスメント調査の第三者委員会委員報酬等の見直し'),
  ('722564a1-2e89-4589-a3b2-f6614f10c200'::uuid, 'f8b0acf4-998b-40df-8a3e-eed191928133'::uuid, 'hard'::difficulty_level_enum, '石垣市ハラスメント調査に関する第三者委員会設置条例の一部を改正する条例', '石垣市ハラスメント調査に関する第三者委員会設置条例の一部を改正する条例');

do $$
declare
  target_bill_count integer;
  target_row_count integer;
  normal_row_count integer;
  hard_row_count integer;
  intended_normal_change_count integer;
  intended_hard_change_count integer;
  unchanged_decision_count integer;
  decision_target_error_count integer;
  incomplete_bill_pair_count integer;
  bill_mapping_error_count integer;
  content_mapping_error_count integer;
  unexpected_current_title_count integer;
begin
  select count(*)
  into target_bill_count
  from _r8_dai4_title_target_bills;

  select
    count(*),
    count(*) filter (where difficulty_level = 'normal'),
    count(*) filter (where difficulty_level = 'hard'),
    count(*) filter (
      where difficulty_level = 'normal'
        and expected_old_title is distinct from approved_title
    ),
    count(*) filter (
      where difficulty_level = 'hard'
        and expected_old_title is distinct from approved_title
    ),
    count(*) filter (where expected_old_title = approved_title)
  into
    target_row_count,
    normal_row_count,
    hard_row_count,
    intended_normal_change_count,
    intended_hard_change_count,
    unchanged_decision_count
  from _r8_dai4_title_decisions;

  select count(*)
  into decision_target_error_count
  from _r8_dai4_title_decisions decision
  left join _r8_dai4_title_target_bills target
    on target.bill_id = decision.bill_id
  where target.bill_id is null;

  select count(*)
  into incomplete_bill_pair_count
  from (
    select
      target.bill_id,
      count(decision.content_id) as row_count,
      count(decision.content_id) filter (
        where decision.difficulty_level = 'normal'
      ) as normal_count,
      count(decision.content_id) filter (
        where decision.difficulty_level = 'hard'
      ) as hard_count
    from _r8_dai4_title_target_bills target
    left join _r8_dai4_title_decisions decision
      on decision.bill_id = target.bill_id
    group by target.bill_id
    having count(decision.content_id) <> 2
      or count(decision.content_id) filter (
        where decision.difficulty_level = 'normal'
      ) <> 1
      or count(decision.content_id) filter (
        where decision.difficulty_level = 'hard'
      ) <> 1
  ) incomplete;

  select count(*)
  into bill_mapping_error_count
  from _r8_dai4_title_target_bills target
  left join bills b on b.id = target.bill_id
  left join diet_sessions ds on ds.id = b.diet_session_id
  where b.id is null
    or b.name is distinct from target.official_bill_name
    or b.publish_status is distinct from 'published'
    or ds.slug is distinct from 'ishigaki-r8-dai4-teireikai';

  select count(*)
  into content_mapping_error_count
  from _r8_dai4_title_decisions decision
  left join bill_contents bc on bc.id = decision.content_id
  where bc.id is null
    or bc.bill_id is distinct from decision.bill_id
    or bc.difficulty_level is distinct from decision.difficulty_level;

  select count(*)
  into unexpected_current_title_count
  from _r8_dai4_title_decisions decision
  join bill_contents bc on bc.id = decision.content_id
  where bc.title is distinct from decision.expected_old_title
    and bc.title is distinct from decision.approved_title;

  if target_bill_count <> 16 then
    raise exception 'Expected 16 target bills, got %', target_bill_count;
  end if;
  if target_row_count <> 32 or normal_row_count <> 16 or hard_row_count <> 16 then
    raise exception
      'Expected 32 rows (16 normal, 16 hard), got % (% normal, % hard)',
      target_row_count,
      normal_row_count,
      hard_row_count;
  end if;
  if intended_normal_change_count <> 11 or intended_hard_change_count <> 6 then
    raise exception
      'Expected 11 normal and 6 hard title changes, got % and %',
      intended_normal_change_count,
      intended_hard_change_count;
  end if;
  if unchanged_decision_count <> 15 then
    raise exception 'Expected 15 already-identical decisions, got %', unchanged_decision_count;
  end if;
  if decision_target_error_count <> 0 then
    raise exception
      'Found % title decisions outside the declared target bill set',
      decision_target_error_count;
  end if;
  if incomplete_bill_pair_count <> 0 then
    raise exception
      'Expected one normal and one hard decision for every target bill; invalid bills: %',
      incomplete_bill_pair_count;
  end if;
  if exists (
    select 1
    from _r8_dai4_title_target_bills
    where bill_number = 42
      or bill_id = 'ed91cc68-3154-49e7-8075-89938057fe0f'::uuid
  ) then
    raise exception 'Bill 42 must not be present in the target bill set';
  end if;
  if exists (
    select 1
    from _r8_dai4_title_decisions
    where content_id in (
      '398d3cd0-744f-447b-926b-e92e4839722a'::uuid,
      '42926f5c-d916-49cf-98d8-f7fe641f3116'::uuid
    )
  ) then
    raise exception 'Bill 42 content IDs must not be present in title decisions';
  end if;
  if bill_mapping_error_count <> 0 then
    raise exception 'Bill mapping preflight failed for % rows', bill_mapping_error_count;
  end if;
  if content_mapping_error_count <> 0 then
    raise exception 'Bill content mapping preflight failed for % rows', content_mapping_error_count;
  end if;
  if unexpected_current_title_count <> 0 then
    raise exception
      'Found % titles that are neither expected-old nor approved',
      unexpected_current_title_count;
  end if;
end $$;

create temp table _r8_dai4_title_rows_before
on commit drop
as
select
  bc.id,
  bc.bill_id,
  bc.difficulty_level,
  bc.title,
  bc.summary,
  bc.content
from bill_contents bc
join _r8_dai4_title_decisions decision on decision.content_id = bc.id;

create temp table _r8_dai4_bill42_rows_before
on commit drop
as
select
  bc.id,
  bc.bill_id,
  bc.difficulty_level,
  bc.title,
  bc.summary,
  bc.content
from bill_contents bc
where bc.bill_id = 'ed91cc68-3154-49e7-8075-89938057fe0f'::uuid;

do $$
declare
  bill42_row_count integer;
  bill42_mapping_error_count integer;
begin
  select count(*)
  into bill42_row_count
  from _r8_dai4_bill42_rows_before;

  select count(*)
  into bill42_mapping_error_count
  from _r8_dai4_bill42_rows_before
  where (id, difficulty_level, title) not in (
    (
      '398d3cd0-744f-447b-926b-e92e4839722a'::uuid,
      'normal'::difficulty_level_enum,
      '令和8年度石垣市一般会計補正予算（第1号）とは'
    ),
    (
      '42926f5c-d916-49cf-98d8-f7fe641f3116'::uuid,
      'hard'::difficulty_level_enum,
      '令和8年度石垣市一般会計補正予算（第1号）'
    )
  );

  if bill42_row_count <> 2 or bill42_mapping_error_count <> 0 then
    raise exception
      'Bill 42 preflight failed: % rows, % mapping errors',
      bill42_row_count,
      bill42_mapping_error_count;
  end if;
end $$;

create temp table _r8_dai4_title_run_metrics (
  expected_update_count integer not null
) on commit drop;

insert into _r8_dai4_title_run_metrics (expected_update_count)
select count(*)
from _r8_dai4_title_decisions decision
join bill_contents bc on bc.id = decision.content_id
where bc.title is not distinct from decision.expected_old_title
  and decision.expected_old_title is distinct from decision.approved_title;

create temp table _r8_dai4_updated_content_ids (
  content_id uuid primary key
) on commit drop;

with updated as (
  update bill_contents bc
  set title = decision.approved_title
  from _r8_dai4_title_decisions decision
  where bc.id = decision.content_id
    and bc.bill_id = decision.bill_id
    and bc.difficulty_level = decision.difficulty_level
    and bc.title is not distinct from decision.expected_old_title
    and decision.expected_old_title is distinct from decision.approved_title
  returning bc.id
)
insert into _r8_dai4_updated_content_ids (content_id)
select id
from updated;

do $$
declare
  expected_update_count integer;
  actual_update_count integer;
  final_title_mismatch_count integer;
  target_non_title_change_count integer;
  bill42_change_count integer;
  unexpected_updated_id_count integer;
begin
  select metrics.expected_update_count
  into expected_update_count
  from _r8_dai4_title_run_metrics metrics;

  select count(*)
  into actual_update_count
  from _r8_dai4_updated_content_ids;

  select count(*)
  into final_title_mismatch_count
  from _r8_dai4_title_decisions decision
  join bill_contents bc on bc.id = decision.content_id
  where bc.title is distinct from decision.approved_title;

  select count(*)
  into target_non_title_change_count
  from _r8_dai4_title_rows_before before_row
  join bill_contents bc on bc.id = before_row.id
  where bc.bill_id is distinct from before_row.bill_id
    or bc.difficulty_level is distinct from before_row.difficulty_level
    or bc.summary is distinct from before_row.summary
    or bc.content is distinct from before_row.content;

  select count(*)
  into bill42_change_count
  from (
    (
      select id, bill_id, difficulty_level, title, summary, content
      from _r8_dai4_bill42_rows_before
      except
      select id, bill_id, difficulty_level, title, summary, content
      from bill_contents
      where bill_id = 'ed91cc68-3154-49e7-8075-89938057fe0f'::uuid
    )
    union all
    (
      select id, bill_id, difficulty_level, title, summary, content
      from bill_contents
      where bill_id = 'ed91cc68-3154-49e7-8075-89938057fe0f'::uuid
      except
      select id, bill_id, difficulty_level, title, summary, content
      from _r8_dai4_bill42_rows_before
    )
  ) differences;

  select count(*)
  into unexpected_updated_id_count
  from _r8_dai4_updated_content_ids updated
  left join _r8_dai4_title_decisions decision
    on decision.content_id = updated.content_id
  where decision.content_id is null;

  if actual_update_count <> expected_update_count then
    raise exception
      'Expected % title updates, updated %',
      expected_update_count,
      actual_update_count;
  end if;
  if final_title_mismatch_count <> 0 then
    raise exception 'Post-update title verification failed for % rows', final_title_mismatch_count;
  end if;
  if target_non_title_change_count <> 0 then
    raise exception
      'Detected summary/content or mapping changes in % target rows',
      target_non_title_change_count;
  end if;
  if bill42_change_count <> 0 then
    raise exception 'Bill 42 changed in % verification rows', bill42_change_count;
  end if;
  if unexpected_updated_id_count <> 0 then
    raise exception 'Updated % non-target content rows', unexpected_updated_id_count;
  end if;
end $$;

-- Verification summary. First execution should report 17 updated rows.
-- Re-execution should report 0 updated rows.
select
  16 as target_bills,
  count(*) as target_content_rows,
  count(*) filter (where decision.difficulty_level = 'normal') as normal_rows,
  count(*) filter (where decision.difficulty_level = 'hard') as hard_rows,
  (select expected_update_count from _r8_dai4_title_run_metrics) as updated_rows,
  count(*) filter (where bc.title = decision.approved_title) as approved_title_rows
from _r8_dai4_title_decisions decision
join bill_contents bc on bc.id = decision.content_id;

select
  target.bill_number,
  decision.difficulty_level,
  decision.bill_id,
  decision.content_id,
  decision.approved_title,
  bc.title as persisted_title
from _r8_dai4_title_decisions decision
join _r8_dai4_title_target_bills target on target.bill_id = decision.bill_id
join bill_contents bc on bc.id = decision.content_id
order by target.bill_number, decision.difficulty_level;

commit;
