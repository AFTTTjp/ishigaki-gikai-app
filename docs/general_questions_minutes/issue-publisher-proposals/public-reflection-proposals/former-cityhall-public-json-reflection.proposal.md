# former-cityhall public JSON reflection proposal

## Purpose

- この doc は `former-cityhall` を public JSON に反映する前の、人間レビュー用 proposal です
- まだ JSON 反映ではありません
- DB / import / revalidation は対象外です
- 実際の JSON 編集は、別タスクで最小差分として行う前提です

## Source review memo

- 根拠 memo:
  - `docs/general_questions_minutes/issue-publisher-proposals/editorial-review/former-cityhall-public-reflection-review.md`
- この proposal は、上記 memo の `needs_human_edit_before_reflection` 判定を前提にしています
- 今回は `ready` 判定に変えるものではなく、「人間がどの field をどう編集し得るか」を先に明文化するための proposal です

## Target public JSON

- 対象ファイル:
  - `docs/ishigaki_gikai_topics_dev_set/old_city_hall.topic.json`
- target topic slug / id:
  - `ishigaki-old-city-hall`
- 現在の主な field 構造:
  - `description`
  - `content`
  - `content_hard`
  - `current_status`
  - `topic_updates`
  - `topic_bill_candidates`
- 現在の `current_status`:
  - `協議継続・着工時期は未確定`
- 現在の `topic_updates` 状態:
  - 既存 update は `decision / progress / news / question / council` の kind で構成されています
  - 直近の broad council update として、`複数の定例会で市から進捗状況の説明が行われている` という整理が既に存在します

## Reflection scope

### 反映対象にするもの

- 6月定例会の一般質問で、旧庁舎跡地の今後の活用について、庁内検討や関係者との協議状況、跡地管理や優先交渉権者決定経緯が説明された、という範囲
- `attributed_speech` の範囲に限定した整理
- 「何が決まったか」ではなく、「議会で何が説明されたか」という update

### 反映対象にしないもの

- 新しい政策判断の断定
- 市の方針が確定したかのような表現
- 議案との無理な紐づけ
- `related_bill_ids` の追加
- `current_status` の大幅更新
- `topic_bill_candidates` の変更
- 議会資料にない推測補完

## Proposed JSON changes

以下は実際の JSON patch ではなく、人間が読める変更案です。

### Candidate change area

- 最小候補:
  - `topic_updates` に 1件追加
- 追加候補:
  - `content` または `content_hard` に、議会答弁で確認された論点を 1段落だけ補足
- 今回は提案しない:
  - `current_status` 編集
  - `description` 編集
  - `related_bills_summary_normal` 編集
  - `related_bills_summary_hard` 編集
  - `topic_bill_candidates` 編集

### Proposed `topic_updates` entry

- kind:
  - `council`
  - 理由: import script と schema の既存 enum に含まれており、議会答弁由来の update として最も自然です
- published_at:
  - `2026-06-15T00:00:00+09:00`
  - 要確認: 友寄永三・後上里厚司の一般質問を同じ 6月15日 起点でまとめてよいか
- title 案:
  - `6月定例会の一般質問で旧庁舎跡地活用の進捗や協議状況が説明される`
- summary 案:
  - `6月定例会の一般質問で、旧庁舎跡地活用事業について、協議の継続状況、跡地の維持管理、優先交渉権者決定の経緯などが説明されました。`
- content 案:
  - `### 一般質問で説明されたこと\n\n- 旧庁舎跡地活用事業について、協議継続や見直し案提出待ちの状況が説明されました\n- 跡地の維持管理と仮囲い継続の状況が説明されました\n- 優先交渉権者決定の手続きや、公募条件・変更可能範囲に関する説明がありました\n\nこれは6月定例会の答弁内容を整理するための update であり、事業の最終状態を transcript だけで確定するものではありません。`
- status_label 案:
  - `一般質問答弁`
- source_label 案:
  - `令和8年第4回定例会 一般質問`
- source_url:
  - `null` 案
  - 理由: 現時点ではこの proposal で確実な public URL を確定しない
  - 要確認: 既存 public topic 運用で、当該一般質問の公式公開 URL を使うか

### Optional `content` / `content_hard` supplement

- `content` 追記案:
  - `この定例会の一般質問では、旧庁舎跡地活用事業について、協議の継続状況や跡地管理の考え方、優先交渉権者決定の経緯が説明されました。`
- `content_hard` 追記案:
  - `令和8年第4回定例会の一般質問では、旧庁舎跡地活用事業について、優先交渉権者との協議継続、見直し案提出待ち、跡地の維持管理、優先交渉権者決定の経緯に関する答弁がありました。`

この補足は optional です。最小編集にするなら `topic_updates` のみを優先します。

## Proposed wording

### 短め案

`6月定例会の一般質問では、旧庁舎跡地の活用について、事業の進み具合や今後の協議状況、跡地管理の考え方が説明されました。`

### 詳しめ案

`6月定例会の一般質問では、旧庁舎跡地活用事業について、優先交渉権者との協議継続、見直し案の提出待ち、跡地の維持管理、優先交渉権者決定の経緯に関する答弁がありました。これは議会答弁の内容を整理するためのもので、事業の最終状態を transcript だけで確定するものではありません。`

### wording constraints

- `確認されました` `説明されました` を使う
- `決まりました` `確定しました` は使わない
- 着工時期や基本協定締結を断定しない
- related bill を推測で足さない
- `related_bill_ids` は空のまま

## Human review checklist

- anchor paraphrase が発言の範囲を超えていないか
- `old_city_hall.topic.json` の `current_status` と競合しないか
- `topic_updates` 追加だけで十分か
- `current_status` は触らない方針でよいか
- `source_label` / `source_url` の扱いは妥当か
- `related_bill_ids` を空のままにすることで誤解が生まれないか
- 既存の broad `council` update と重複しすぎていないか
- `content` / `content_hard` 補足を入れるなら、topic 全体説明を上書きしていないか

## Recommendation

- `needs_human_wording_edit_before_json`

### Reason

- `topic_updates` に限定した最小 reflection 案は作れます
- 既存 enum に `council` があり、追加先の field は明確です
- ただし wording を少しでも強くすると、協議状況や事業状態の確定表現に見えやすいです
- そのため、次タスクで即 JSON 編集に入る前に、人間が wording を一度確認した方が安全です

## Next action

- 人間がこの proposal doc の wording 案を確認する
- 問題なければ、別タスクで `old_city_hall.topic.json` の `topic_updates` だけを最小編集する
- `content` / `content_hard` 追記は、その最小編集後に必要性を再判断する
- import / DB / revalidation は、その JSON 編集タスクの後段フェーズで別途判断する
