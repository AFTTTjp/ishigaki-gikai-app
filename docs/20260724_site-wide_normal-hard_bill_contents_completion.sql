-- Site-wide normal/hard content completion for published bills.
-- Source basis: official Ishigaki City Council bill PDFs and proposal/result pages for R8 3rd and 4th regular sessions.
-- The bill_id values below were verified against production before this PR update.
-- Run after review approval against production. This script writes only bill_contents rows.

BEGIN;

create temp table _site_wide_difficulty_bill_contents_source (
  bill_id uuid not null,
  session_slug text not null,
  session_name text not null,
  official_bill_name text not null,
  difficulty_level difficulty_level_enum not null,
  title text not null,
  summary text not null,
  content text not null
) on commit drop;

insert into _site_wide_difficulty_bill_contents_source
  (bill_id, session_slug, session_name, official_bill_name, difficulty_level, title, summary, content)
values
  ('ba1f6e2a-902b-4071-b7cb-89fcbf67482d'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '同意第1号 固定資産評価審査委員会委員の選任について', 'normal', '固定資産評価審査委員会委員の選任同意', '任期満了に伴い、固定資産評価審査委員会委員を選任するため議会の同意を求めるものです。', '固定資産評価審査委員会委員の任期満了に伴い、委員1名の選任について議会の同意を求める議案です。')
  ,('ba1f6e2a-902b-4071-b7cb-89fcbf67482d'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '同意第1号 固定資産評価審査委員会委員の選任について', 'hard', '固定資産評価審査委員会委員の選任同意', '固定資産評価審査委員会委員の任期満了に伴う選任について、地方税法第423条第3項に基づき議会の同意を求めるものです。', '固定資産評価審査委員会委員の任期が2026年3月29日に満了するため、委員1名を選任する同意案件です。地方税法第423条第3項により、固定資産評価審査委員会の委員は議会の同意を得て選任する必要があるため、提案されています。')
  ,('b0e07f9d-5008-4b9c-b9eb-c77d454e0469'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '同意第2号 固定資産評価審査委員会委員の選任について', 'normal', '固定資産評価審査委員会委員の選任同意', '任期満了に伴い、固定資産評価審査委員会委員を選任するため議会の同意を求めるものです。', '固定資産評価審査委員会委員の任期満了に伴い、委員1名の選任について議会の同意を求める議案です。')
  ,('b0e07f9d-5008-4b9c-b9eb-c77d454e0469'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '同意第2号 固定資産評価審査委員会委員の選任について', 'hard', '固定資産評価審査委員会委員の選任同意', '固定資産評価審査委員会委員の任期満了に伴う選任について、地方税法第423条第3項に基づき議会の同意を求めるものです。', '固定資産評価審査委員会委員の任期が2026年3月29日に満了するため、委員1名を選任する同意案件です。地方税法第423条第3項により、固定資産評価審査委員会の委員は議会の同意を得て選任する必要があるため、提案されています。')
  ,('3e1233e8-8b65-4297-9756-e2119a645576'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '報告第1号 石垣市職員倫理条例の運用状況報告について', 'normal', '職員倫理条例の運用状況報告', '石垣市職員倫理条例に基づき、職員倫理に関する取組状況を議会へ報告するものです。', '石垣市職員倫理条例の運用状況として、職員への周知や倫理保持に関する取組の状況を議会へ報告する案件です。')
  ,('3e1233e8-8b65-4297-9756-e2119a645576'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '報告第1号 石垣市職員倫理条例の運用状況報告について', 'hard', '職員倫理条例の運用状況報告', '2025年2月1日から2026年1月31日までの職員倫理条例の運用状況について、通知や服務規律、審査会意見を含めて報告するものです。', '報告対象期間は2025年2月1日から2026年1月31日までです。服装、服務規律、市民駐車場の利用などに関する通知を行ったことや、職員倫理審査会からおおむね適正に運用されているとの意見が示されたことを議会へ報告しています。')
  ,('5cd6c944-4d6b-4d43-819e-00b03590841c'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '報告第2号 専決処分の報告について', 'normal', '専決処分の報告', '公用車事故に関する損害賠償について、市長が専決処分した内容を議会へ報告するものです。', '公用車の物損事故について、市が損害賠償額を定めた専決処分の内容を議会へ報告する案件です。')
  ,('5cd6c944-4d6b-4d43-819e-00b03590841c'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '報告第2号 専決処分の報告について', 'hard', '専決処分の報告', '地方自治法第180条第1項に基づき、市長が専決処分した公用車事故の損害賠償について、同条第2項により議会へ報告するものです。', '2025年9月12日に石垣市字平得で発生した公用車の物損事故について、損害賠償額11万9,261円を定めた専決処分を報告しています。市長の専決処分事項として処理したため、地方自治法第180条第2項に基づき議会に報告されています。')
  ,('baa5052b-ce71-4a15-81c8-cc2eb8fb633f'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '請願第1号 観音堂地区におけるヘリコプター離着陸場の運用見直しに関する請願', 'normal', '観音堂地区のヘリ離着陸場運用見直し請願', '観音堂地区のヘリコプター離着陸場について、運用の見直しを求める請願です。', '観音堂地区にあるヘリコプター離着陸場の運用について、見直しを求める請願です。')
  ,('baa5052b-ce71-4a15-81c8-cc2eb8fb633f'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '請願第1号 観音堂地区におけるヘリコプター離着陸場の運用見直しに関する請願', 'hard', '観音堂地区のヘリ離着陸場運用見直し請願', '観音堂地区におけるヘリコプター離着陸場の運用見直しに関する請願で、第3回定例会では継続審査となっています。', '観音堂地区のヘリコプター離着陸場について、運用のあり方を見直すよう求める請願です。市議会の提出議案等一覧では、第3回定例会で継続審査とされています。')
  ,('acfe03eb-31e6-424f-956f-ceb202926985'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '議案第31号 沖縄県宿泊税の賦課徴収に関する事務委託について', 'normal', '沖縄県宿泊税の徴収事務委託', '沖縄県宿泊税の徴収事務を石垣市が扱うため、県との事務委託について議会の議決を求めるものです。', '沖縄県宿泊税について、石垣市内の宿泊施設に係る賦課徴収事務を市が行うため、県との事務委託を定める議案です。')
  ,('acfe03eb-31e6-424f-956f-ceb202926985'::uuid, '2026-3rd-regular', '令和8年第3回石垣市議会（定例会）', '議案第31号 沖縄県宿泊税の賦課徴収に関する事務委託について', 'hard', '沖縄県宿泊税の徴収事務委託', '沖縄県宿泊税条例に基づく宿泊税のうち、石垣市内の宿泊施設に係る賦課徴収事務を市が処理するため、県との協議により規約を定めるものです。', '地方自治法第252条の14第1項に基づき、沖縄県宿泊税の賦課徴収に関する事務の一部を石垣市が受託する議案です。市内宿泊施設に係る宿泊税の申告受付、納入通知、過誤納金還付などを市が扱い、経費負担や取扱交付金などは県知事と市長の協議で定める内容です。')
  ,('c7472bf2-22b9-4b4a-9a4b-deb723bfda25'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第43号 令和8年度石垣都市計画土地区画整理事業特別会計補正予算（第1号）', 'normal', '土地区画整理事業特別会計の補正予算', '土地区画整理事業特別会計で、歳入歳出をそれぞれ316千円増額する補正予算です。', '令和8年度石垣都市計画土地区画整理事業特別会計について、歳入歳出予算をそれぞれ316千円増額し、総額を2億2,159万3千円とする補正予算です。')
  ,('c7472bf2-22b9-4b4a-9a4b-deb723bfda25'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第43号 令和8年度石垣都市計画土地区画整理事業特別会計補正予算（第1号）', 'hard', '土地区画整理事業特別会計の補正予算', '土地区画整理事業特別会計の第1号補正として、既定予算に316千円を追加し、地方債の変更もあわせて定めるものです。', '歳入歳出それぞれ316千円を追加し、予算総額を2億2,159万3千円とする補正予算です。あわせて地方債の補正として、南大浜地区沿道区画整理事業債の限度額を変更する内容が含まれています。')
  ,('1358ebc5-ffe7-4362-b9e4-f3c09925abe5'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第44号 令和8年度石垣市港湾事業特別会計補正予算（第1号）', 'normal', '港湾事業特別会計の補正予算', '港湾事業特別会計で、歳入歳出をそれぞれ4,799千円増額する補正予算です。', '令和8年度石垣市港湾事業特別会計について、歳入歳出予算をそれぞれ4,799千円増額し、総額を15億2,974万3千円とする補正予算です。')
  ,('1358ebc5-ffe7-4362-b9e4-f3c09925abe5'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第44号 令和8年度石垣市港湾事業特別会計補正予算（第1号）', 'hard', '港湾事業特別会計の補正予算', '港湾事業特別会計の第1号補正として、既定予算に4,799千円を追加し、予算総額を15億2,974万3千円に改めるものです。', '歳入歳出それぞれ4,799千円を追加し、予算総額を15億2,974万3千円とする補正予算です。第1表で歳入歳出予算補正の款項ごとの増額内容を定めています。')
  ,('aa3babc3-334a-475f-8662-f735a7d1fd17'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第46号 八重山広域市町村圏事務組合規約の変更について', 'normal', '八重山広域市町村圏事務組合規約の変更', '介護認定審査会に関する共同処理事務の見直しに伴い、組合規約を変更する議案です。', '八重山広域市町村圏事務組合の共同処理事務から、介護認定審査会に関する事務を削るため、組合規約を変更する議案です。')
  ,('aa3babc3-334a-475f-8662-f735a7d1fd17'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第46号 八重山広域市町村圏事務組合規約の変更について', 'hard', '八重山広域市町村圏事務組合規約の変更', '介護情報基盤の全国運用開始に伴い、介護認定審査会事務を組合で共同処理し続けることが困難となるため、規約を変更するものです。', '令和10年度から介護情報基盤が全国で運用開始されることを受け、組合が共同処理している介護認定審査会に関する事務を削除する規約変更です。八重山3市町が協議して規約を改める必要があるため、地方自治法第290条に基づき議会の議決を求めています。')
  ,('29064eb3-8ece-4a8d-b251-329e701f8958'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第47号 訴えの提起について', 'normal', '市営住宅の明渡し等を求める訴え', '市営住宅の長期家賃滞納に対し、住宅の明渡しなどを求めて訴えを提起する議案です。', '市営住宅の長期家賃滞納を理由に、住宅の明渡し、未納家賃などの支払いを求める訴えを提起するため、議会の議決を求めるものです。')
  ,('29064eb3-8ece-4a8d-b251-329e701f8958'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第47号 訴えの提起について', 'hard', '市営住宅の明渡し等を求める訴え', '市営住宅の長期家賃滞納者に対して、住宅の明渡し、未納家賃、期限後の損害賠償金などを求める訴えを提起するものです。', '市営住宅の長期家賃滞納に対し、住宅の明渡しと未納家賃の支払い、明渡し期限後の近傍同種家賃2倍相当の損害賠償金、訴訟費用の負担などを求める訴えを提起する議案です。訴訟は弁護士に委任し、必要に応じて控訴や和解もできる内容です。')
  ,('59c68afe-bc47-41f5-b293-3fb7bc28ad91'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第48号 財産の取得について［石垣市学習者用GIGA端末］', 'normal', '児童生徒用GIGA端末の取得', '学校で使う児童生徒用GIGA端末を取得するため、契約内容について議会の議決を求めるものです。', '児童生徒が学校で使用するGIGA端末を取得するため、契約方法、取得金額、契約相手方を定める財産取得議案です。')
  ,('59c68afe-bc47-41f5-b293-3fb7bc28ad91'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第48号 財産の取得について［石垣市学習者用GIGA端末］', 'hard', '児童生徒用GIGA端末の取得', '石垣市学習者用GIGA端末を随意契約で取得するため、2億9,904万1,798円の契約について議会の議決を求めるものです。', '石垣市学習者用GIGA端末の取得について、地方自治法第96条第1項第8号などに基づき議会の議決を求める議案です。取得方法は随意契約、取得金額は2億9,904万1,798円、契約相手方はOCC・興洋電子・学映システム共同企業体です。')
  ,('bb78e020-e6f2-4b2d-a9ce-0ffc2c691565'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第49号 財産の取得について［石垣市指導者用GIGA端末］', 'normal', '教員用GIGA端末の取得', '学校で使う教員用GIGA端末を取得するため、契約内容について議会の議決を求めるものです。', '教員が学校で使用するGIGA端末を取得するため、契約方法、取得金額、契約相手方を定める財産取得議案です。')
  ,('bb78e020-e6f2-4b2d-a9ce-0ffc2c691565'::uuid, 'ishigaki-r8-dai4-teireikai', '令和8年第4回定例会', '議案第49号 財産の取得について［石垣市指導者用GIGA端末］', 'hard', '教員用GIGA端末の取得', '石垣市教員用GIGA端末を随意契約で取得するため、2,786万3,000円の契約について議会の議決を求めるものです。', '石垣市教員用GIGA端末の取得について、地方自治法第96条第1項第8号などに基づき議会の議決を求める議案です。取得方法は随意契約、取得金額は2,786万3,000円、契約相手方はOCC・興洋電子・学映システム共同企業体です。');

do $$
declare
  target_bill_count integer;
  target_row_count integer;
  normal_row_count integer;
  hard_row_count integer;
  duplicate_key_count integer;
  unknown_difficulty_count integer;
  missing_bill_count integer;
  bill_name_mismatch_count integer;
begin
  select count(distinct bill_id), count(*), count(*) filter (where difficulty_level = 'normal'), count(*) filter (where difficulty_level = 'hard')
  into target_bill_count, target_row_count, normal_row_count, hard_row_count
  from _site_wide_difficulty_bill_contents_source;

  select count(*)
  into duplicate_key_count
  from (
    select bill_id, difficulty_level
    from _site_wide_difficulty_bill_contents_source
    group by bill_id, difficulty_level
    having count(*) > 1
  ) duplicated;

  select count(*)
  into unknown_difficulty_count
  from _site_wide_difficulty_bill_contents_source
  where difficulty_level not in ('normal', 'hard');

  select count(*)
  into missing_bill_count
  from _site_wide_difficulty_bill_contents_source source
  left join bills b on b.id = source.bill_id
  where b.id is null;

  select count(*)
  into bill_name_mismatch_count
  from _site_wide_difficulty_bill_contents_source source
  join bills b on b.id = source.bill_id
  where b.name <> source.official_bill_name;

  if target_bill_count <> 12 then
    raise exception 'Expected 12 target bills, got %', target_bill_count;
  end if;
  if target_row_count <> 24 then
    raise exception 'Expected 24 target rows, got %', target_row_count;
  end if;
  if normal_row_count <> 12 then
    raise exception 'Expected 12 normal rows, got %', normal_row_count;
  end if;
  if hard_row_count <> 12 then
    raise exception 'Expected 12 hard rows, got %', hard_row_count;
  end if;
  if duplicate_key_count <> 0 then
    raise exception 'Expected 0 duplicate bill_id/difficulty rows, got %', duplicate_key_count;
  end if;
  if unknown_difficulty_count <> 0 then
    raise exception 'Expected 0 unknown difficulty rows, got %', unknown_difficulty_count;
  end if;
  if missing_bill_count <> 0 then
    raise exception 'Expected all explicit bill UUIDs to exist, missing %', missing_bill_count;
  end if;
  if bill_name_mismatch_count <> 0 then
    raise exception 'Expected all explicit bill UUIDs to match official names, mismatches %', bill_name_mismatch_count;
  end if;
end $$;

insert into bill_contents (bill_id, difficulty_level, title, summary, content)
select bill_id, difficulty_level, title, summary, content
from _site_wide_difficulty_bill_contents_source
on conflict (bill_id, difficulty_level) do update set
  title = excluded.title,
  summary = excluded.summary,
  content = excluded.content,
  updated_at = now();

do $$
declare
  written_row_count integer;
  written_normal_count integer;
  written_hard_count integer;
  duplicate_written_key_count integer;
begin
  select count(*), count(*) filter (where bc.difficulty_level = 'normal'), count(*) filter (where bc.difficulty_level = 'hard')
  into written_row_count, written_normal_count, written_hard_count
  from bill_contents bc
  join _site_wide_difficulty_bill_contents_source source
    on source.bill_id = bc.bill_id
   and source.difficulty_level = bc.difficulty_level;

  select count(*)
  into duplicate_written_key_count
  from (
    select bc.bill_id, bc.difficulty_level
    from bill_contents bc
    where exists (
      select 1
      from _site_wide_difficulty_bill_contents_source source
      where source.bill_id = bc.bill_id
        and source.difficulty_level = bc.difficulty_level
    )
    group by bc.bill_id, bc.difficulty_level
    having count(*) > 1
  ) duplicated;

  if written_row_count <> 24 then
    raise exception 'Expected 24 written target rows, got %', written_row_count;
  end if;
  if written_normal_count <> 12 then
    raise exception 'Expected 12 written normal rows, got %', written_normal_count;
  end if;
  if written_hard_count <> 12 then
    raise exception 'Expected 12 written hard rows, got %', written_hard_count;
  end if;
  if duplicate_written_key_count <> 0 then
    raise exception 'Expected 0 duplicate written bill_id/difficulty rows, got %', duplicate_written_key_count;
  end if;
end $$;

-- Verification: this query should return 12 target bills and 24 target rows.
select
  count(distinct source.bill_id) as target_bills,
  count(*) as target_content_rows,
  count(*) filter (where bc.difficulty_level = 'normal') as normal_rows,
  count(*) filter (where bc.difficulty_level = 'hard') as hard_rows
from _site_wide_difficulty_bill_contents_source source
join bill_contents bc
  on bc.bill_id = source.bill_id
 and bc.difficulty_level = source.difficulty_level;

COMMIT;
