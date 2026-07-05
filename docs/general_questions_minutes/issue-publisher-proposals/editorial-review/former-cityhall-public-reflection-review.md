# former-cityhall public reflection review

## Purpose

- この memo は `former-cityhall` の public JSON 反映前に行う editorial re-audit です
- public JSON 反映リストではありません
- DB / import / revalidation は対象外です
- proposal 用 anchor と issue story 側 warning を切り分けて、人間が reflection 可否を判断するためのメモです

## Source files

- proposal file:
  - `docs/general_questions_minutes/issue-publisher-proposals/approved-state-fixtures/positive/approved-attributed-speech-former-cityhall-real-topic-target.proposal.json`
- dry-run file:
  - `docs/general_questions_minutes/issue-publisher-export-dry-runs/approved-attributed-speech-former-cityhall-real-topic-target.dry-run.json`
- issue story file:
  - `docs/general_questions_minutes/issue-stories/r8-dai4/former-cityhall.md`
- issue stories review file:
  - `docs/general_questions_minutes/r8-dai4-teireikai.issue-stories-review.md`
- current public topic JSON:
  - `docs/ishigaki_gikai_topics_dev_set/old_city_hall.topic.json`

## Current candidate status

- target surface: `topic`
- target slug / id: `ishigaki-old-city-hall`
- claim_type: `attributed_speech`
- proposal_type: `discussion_point`
- anchor count: `2`
- related_bill_ids: `[]`
- application_status:
  - `applied: false`
  - `public_json_written: false`
  - `db_written: false`
  - `revalidation_needed: false`
- public reflection readiness:
  - `not ready`
  - current recommendation: `needs_human_edit_before_reflection`

## Anchor review

### Proposal anchors

proposal で使っている 2 件の anchor は、いずれも exact resolve しています。

1. `ishigaki-r8-dai4-teireikai.gq.ishigaki-r8-dai4-ippan-tomoyose-eizo.u0011`
   - 旧庁舎跡地活用事業の進捗、協議継続、見直し案提出待ちを支える答弁です
   - 「進捗や協議の継続状況が説明された」という attributed speech を支えます
2. `ishigaki-r8-dai4-teireikai.gq.ishigaki-r8-dai4-ippan-shiuezato-atsushi.u0008`
   - 跡地維持管理、優先交渉権者の決定経緯、公募条件や変更可能範囲を支える答弁です
   - 「維持管理や優先交渉権者決定の経緯が説明された」という attributed speech を支えます

### Issue story warning

issue story 側の warning は、proposal の 2 anchors そのものへの reject ではありません。

- issue story では `anchor_selection_status: needs_review`
- `issue-stories-review` では、`former-cityhall` の high confidence 1件が論点不一致と指摘されています
- 指摘対象は、story generator / story review の採用 anchor 品質であり、proposal fixture が採用した exact utterance anchors とは別の問題です

### Interpretation

- proposal candidate と issue story warning は、完全に同一の問題ではありません
- proposal candidate 側:
  - exact utterance anchors で、旧庁舎論点自体は支えている
- issue story 側:
  - story 用に採られた anchor 1件がズレており、story 全体の public draft 化判断を弱くしている

### Human checks required before reflection

public JSON 反映前に人間が確認すべき anchor は以下です。

- proposal anchor 2件の paraphrase が、発言の範囲を超えていないこと
- `進捗` と `協議継続` を、事業状態の確定事実として断定していないこと
- `優先交渉権者の決定経緯` と `維持管理` を、現時点の政策評価や是非の断定に変換していないこと
- issue story review のズレ anchor をそのまま public 向け根拠として再利用しないこと

## Public topic reflection analysis

`old_city_hall.topic.json` は既に active な topic で、current status も `協議継続・着工時期は未確定` という広い状態整理を持っています。

### 反映候補 field

現時点で反映候補になり得るのは、狭い discussion-point としての field です。

- `content`
  - 一般質問で何が説明されたかを補助的に書く短い段落
- `content_hard`
  - どの論点が議会で確認されたかを、attributed speech として限定的に書く段落
- `topic_updates`
  - 追加する場合でも `decision` ではなく、議会での説明・確認を表す narrow な entry を人手で設計する場合に限る

### 反映してはいけない field

この candidate をそのまま入れるべきでない field は以下です。

- `current_status`
  - transcript-only 由来の説明を、topic の現状確定として上書きするのは危険です
- `description`
  - topic の全体説明を、今回の attributed speech candidate で塗り替えるべきではありません
- `related_bills_summary_normal`
- `related_bills_summary_hard`
- `topic_bill_candidates`
  - `related_bill_ids` が空であり、proposal から bill を推測補完しない方針のためです
- `topic_updates` の `decision` / `progress` 断定文
  - transcript-only で制度状態や工程進捗を確定したように読める更新は避けるべきです

### 既存 topic との競合

- 現在の public topic は、旧庁舎跡地活用を中長期の topic として扱っており、`current_status` も broad です
- proposal candidate の内容は、この broad 状態と大きく矛盾していません
- ただし、proposal は「6月定例会の一般質問で何が説明されたか」を示すだけなので、topic 全体の状態説明に昇格させるには wording の粒度調整が必要です

### 市民向けの誤解リスク

- 「議会で説明された」ことと、「事業状態が確定した」ことが混同されるリスクがあります
- 特に `進捗` や `協議継続` は、確定事実の要約文に見えやすいので注意が必要です
- 市民向け文面では、「答弁では」「一般質問では」「説明されました」といった attribution を残す方が安全です

### related_bill_ids

- `related_bill_ids` は空のまま扱うべきです
- issue story 側でも会期 bill 候補は未確定です
- 今回の candidate は一般質問答弁由来の attributed speech であり、bill を推測で足すべきではありません

## Recommended public wording draft

以下は public JSON に載せる場合の候補文案です。まだ実ファイルへ入れる文ではなく、人間レビュー用の案です。

- easy draft:
  - 「6月定例会の一般質問では、旧庁舎跡地の活用について、事業の進み具合や今後の協議状況、跡地管理の考え方が説明されました。」
- detailed draft:
  - 「6月定例会の一般質問では、旧庁舎跡地活用事業について、優先交渉権者との協議継続、見直し案の提出待ち、跡地の維持管理、優先交渉権者決定の経緯に関する答弁がありました。これは議会答弁の内容を示すものであり、事業の最終状態を transcript だけで確定するものではありません。」

この wording 案では、以下を維持する必要があります。

- `答弁では` / `一般質問では` を残す
- `進んでいる` ではなく `説明された` を使う
- 着工時期や基本協定の成立を断定しない
- bill や committee との接続を足さない

## Judgment

- `needs_human_edit_before_reflection`

### Reason

- proposal / dry-run 自体は整合しています
- proposal anchors 2件は exact resolve し、旧庁舎論点を支えています
- target も `ishigaki-old-city-hall` に exact resolve しています
- 一方で、issue story 側は `keep_as_issue_only` / `needs_review` のままです
- `issue-stories-review` に anchor 1件ズレの指摘が残っており、story review 上の caution を無視して即 reflection するのは危険です
- public topic との大きな時系列矛盾はないものの、public wording は transcript-only fact に見えないよう人手で絞る必要があります

## Next action

- 人間が proposal wording 案を確認する
- proposal anchors 2件を public-facing paraphrase にして問題ないか再確認する
- issue story warning を踏まえ、story 用 anchor と proposal 用 anchor を混同しないことを確認する
- 問題なければ、別タスクで public JSON reflection proposal を作る
- JSON / import / DB / revalidation は、その別タスクまで行わない
