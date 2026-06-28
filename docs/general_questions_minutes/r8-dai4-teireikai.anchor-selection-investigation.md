# Anchor Selection Investigation

## Original Objective

r8-dai4 の `issue-stories` で `related_questions / anchors` の誤対応が多いため、現行の生成フローと anchor 選定ロジックを調査し、最小改善案と検証計画を整理する。  
今回は調査のみで、実装・JSON 更新・DB 反映・import・revalidate は行わない。

## Files Inspected

- `scripts/build-issue-stories.mjs`
- `scripts/build-issue-review-packet.mjs`
- `scripts/build-general-questions-canonical-from-minutes.mjs`
- `scripts/build-general-questions-review-draft.mjs`
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-graph-pilot.json`
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-review-packet.json`
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-editorial-decisions.json`
- `docs/general_questions_minutes/r8-dai4-teireikai.canonical.json`
- `docs/general_questions/r8-dai4-teireikai.general-questions.json`
- `docs/general_questions_minutes/issue-stories/r8-dai4/*.md`
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-stories.json`

## Current Flow Summary

### 1. canonical general questions を作る段階

- `build-general-questions-canonical-from-minutes.mjs` が `*_minutes.md` から `question_items` を抽出する。
- `question_items` の `item_number` は `raw_anchor_text` 冒頭の数詞パターンから `inferItemNumber()` で推定している。
- 使っているパターンは `1項目目 / 1点目 / 1番目` 系のみで、`item title` や `sub_items` 本文との照合はしていない。
- 抽出結果は `canonical.json` の `question_items[]` に入り、`raw_anchor_text` と `confidence` を持つ。

関連箇所:

- `inferItemNumber()`:
  `scripts/build-general-questions-canonical-from-minutes.mjs:258`
- `parseQuestionItems()`:
  `scripts/build-general-questions-canonical-from-minutes.mjs:271`

### 2. issue review packet を作る段階

- `build-issue-review-packet.mjs` は `issue-graph-pilot.json` の `related_general_question_items` を public general questions JSON に解決している。
- ここでは `questionSlug + itemNumber + subItemIndex` を正引きして `item_title` や `sub_item_text` を補完する。
- つまり issue 側はすでに `item 単位 ref` を持っている。

関連箇所:

- `buildPacket()`:
  `scripts/build-issue-review-packet.mjs:478`

### 3. issue stories を作る段階

- `build-issue-stories.mjs` が `issue-review-packet.json` と `canonical.json` を読み、`related_questions` と `evidence_anchors` を作る。
- `related_questions` は `reviewPacketIssue.related_general_question_items` を 1 件ずつ `resolveRelatedQuestion()` で処理する。
- anchor 選定は:
  1. 同じ `questionSlug` の canonical question を探す
  2. その中から `item_number === ref.itemNumber` の candidates を取る
  3. `confidence` と `raw_anchor_text` 長さで並べ替えて先頭 1 件を採用
  4. それがなければ `issue_graph.evidence_anchors` から同一 question の最初の `raw_anchor_text` を fallback 採用

関連箇所:

- `pickCanonicalAnchor()`:
  `scripts/build-issue-stories.mjs:236`
- `pickIssueEvidenceAnchor()`:
  `scripts/build-issue-stories.mjs:244`
- `resolveRelatedQuestion()`:
  `scripts/build-issue-stories.mjs:265`

## Current Anchor Selection Logic

### 選定単位

- 現在は「question 内 candidate 群から `item_number` 一致だけを見る」ロジック。
- `item title`、`sub_item_text`、`issue title`、`citizen_question`、`topic`、`bill` は anchor 採用判定に使っていない。
- `subItemIndex` は story 出力では保持しているが、anchor 選定そのものには使っていない。

### score / confidence の扱い

- embedding は使っていない。
- keyword score も使っていない。
- LLM 検証も使っていない。
- `pickCanonicalAnchor()` は `confidence` 優先、同率なら文字長優先の deterministic ソートだけ。
- fallback 側は `issue_graph.evidence_anchors` の最初の 1 行を `low` として採るだけ。

関連箇所:

- `rankCandidate()`:
  `scripts/build-issue-stories.mjs:226`

## Root Cause

### 1. `item_number` 推定が脆く、誤 item に高 confidence が付いたまま canonical に入る

- canonical 側は `raw_anchor_text` の先頭数詞だけで `item_number` を振っている。
- そのため:
  - `2番目東原陽昌氏の寄附金活用...` が `item_number: 2`
  - `3点目はこの後で質問を変えていきたい...` が `item_number: 3`
  - `5項目目` が `item_number: 5`
  のように、「数詞は合うが論点は違う」候補が `high` で残る。

### 2. `item_number` が合った後の second-pass verification が存在しない

- `build-issue-stories.mjs` は `item_number` 一致 candidate があれば、その中から最も高い `confidence` と長さで 1 件を選ぶだけ。
- `item_title` と `raw_anchor_text` の意味的一致確認がない。
- 結果として:
  - `旧庁舎跡地開発について` に `2点目は収集体制の再構築...`
  - `基金管理について` に `土地利用計画の進捗状況...`
  のようなズレがそのまま採用される。

### 3. fallback anchor が `question-level` で、item 単位に絞られていない

- `pickIssueEvidenceAnchor()` は `questionSlug` 単位で最初の 1 anchor だけを返す。
- `itemNumber` や `item_title` で絞っていない。
- そのため:
  - `rito-koshien` では `離島甲子園` に `市職員の窓口対応`
  - `school-education` では `市立小中学校の統廃合` に `県道石垣空港線アクセス道路`
  が落ちてくる。

### 4. `high confidence` は「抽出器の確信度」であって「issue story 用として妥当」の意味ではない

- `confidence` は `make_minutes.sh` の質問項目候補抽出レベルの値。
- これは public item との一致保証でも、topic anchor としての品質保証でもない。
- それでも story 側では `high` をほぼ採用可能値として扱っている。

### 5. split 対象 story でも同じ anchor 採用ルールを使っている

- `needs_split` issue は、そもそも複数 topic cluster を内包している。
- それでも現在は 1 本の story として全 ref を一括処理しているため、候補の混線が起きやすい。

## Evidence from Representative 6 Stories

### `rito-koshien`

- public item:
  - `離島甲子園について`
  - `離島甲子園大会出場について`
- canonical candidate count:
  - どちらも `0`
- 現状 fallback:
  - `市職員の一項目め市職員の窓口の対応について...`
  - `最後から2番目の質問者となりました`

### `municipal-housing`

- `シニア向け市営団地建設`
  - candidates:
    - `2点目に低所得者高齢者に対する住宅支援制度...`
    - `2番目東原陽昌氏の寄附金活用...`
- `真喜良地域公営住宅周辺...`
  - candidates:
    - `3点目はこの後で質問を変えていきたい...`
    - `3点目は削除します`
- `家賃高騰下...`
  - candidate:
    - `5項目目`

### `former-cityhall`

- `旧庁舎跡地開発について`
  - candidate:
    - `2点目は収集体制の再構築と市民の周知...`

### `lodging-tax-finance`

- `石垣市宿泊税基金条例と税の活用について`
  - candidate:
    - `2点目は実証輸送を通じたニーズ把握と人材育成...`
- `基金管理について`
  - candidates:
    - `1点目に各種基金の詳細について`
    - `1点目に、土地利用計画の進捗状況について...`
- `桃原用昇氏寄付金活用`
  - candidate:
    - `3点目に公営団地において高齢者が申し込みできる枠...`

### `school-education`

- `市立小中学校の統廃合`
  - canonical candidates: `0`
  - fallback:
    - `1番目 県道石垣空港線アクセス道路について`

### `disaster-fire-rescue`

- `地震津波の避難の在り方`
  - canonical candidates: `0`
  - fallback:
    - `3 医療体制の影響や市の計画性について質問します`

## Proposed Minimal Implementation

### 方針

- `question-level` anchor をそのまま story 採用しない。
- まず `item ref` に対して `item-aware` に候補を絞る。
- そのうえで採用状態を `verified / needs_review / split_recommended` に寄せる。
- `confidence` は参考値として残しつつ、story 側の品質判定とは分離する。

### 最小変更の中心

- 変更対象:
  - `scripts/build-issue-stories.mjs`
- 必要に応じて次段:
  - `scripts/build-general-questions-canonical-from-minutes.mjs`
- 変更しない:
  - public `docs/general_questions/*.json`
  - DB / Supabase / import / revalidate / deploy
  - bill exact matching ロジック
  - issue graph / editorial decisions の source JSON

### Minimal Step A

- `build-issue-stories.mjs` に `item-aware verification` を追加する。
- 採用条件:
  - `item_number` 一致に加え、`raw_anchor_text` が `item_title` または `sub_item_text` の主要語を一定数含む
  - もしくは `item_title` 側の主要語が anchor に NFKC 正規化後で部分一致する
- 除外条件:
  - `1項目目`, `2点目`, `5項目目` のみで具体語がない
  - `削除します`, `次に移ります`, `最後から2番目の質問者`, `見解をお伺いします` など procedural/generic 行

### Minimal Step B

- `pickIssueEvidenceAnchor()` を廃止するのではなく、story 採用用ではなく `reference_only` 扱いに落とす。
- fallback を採用 anchor にしない方針:
  - canonical item-aware match がない場合は `anchor_text = null`
  - `anchor_status = needs_review`
  - `reference_evidence_anchors[]` に question-level 候補を保持

### Minimal Step C

- story 側の表示を `confidence_summary` 主体から `anchor_status` 主体に寄せる。
- 例:
  - `verified`
  - `needs_review`
  - `split_recommended`
- `confidence` は補助列に残す。

### Minimal Step D

- `needs_split` issue は story 生成時点で:
  - `anchor_status = split_recommended`
  - `related_questions` を「そのまま public 候補」とみなさない
  - `sub_issue_candidates` の review 前提表示にする

## Candidate 2-Stage Design

### Stage 1: deterministic candidate selection

- 入力:
  - `questionSlug`
  - `itemNumber`
  - `subItemIndex`
  - `item_title`
  - `sub_item_text`
  - canonical `question_items[]`
- 出力:
  - `accepted_candidates[]`
  - `rejected_candidates[]`
  - `reference_only_evidence_anchors[]`

### Stage 2: verification

- 最小案では LLM をまだ使わず rule-based verification でもよい。
- 将来案として:
  - accepted candidate だけを LLM に渡し
  - `item_title / sub_item_text / anchor` の一致性だけを yes/no 判定
  - 出力は `verified / needs_review`
- この段階でも本文外補完は禁止。

## Verification Plan

### 変更後に見るコマンド案

- `node --check scripts/build-issue-stories.mjs`
- `node scripts/build-issue-stories.mjs`
- `node -e '... representative 6 stories の anchor_status 集計 ...'`
- `rg -n "anchor_status|anchor_text|reference_evidence_anchors|split_recommended" docs/general_questions_minutes/r8-dai4-teireikai.issue-stories.json`

### 代表 6 件での改善確認

#### `rito-koshien`

- 現状の fallback 2件が採用 anchor から消えること
- `anchor_status` が `needs_review` になってもよい
- `ready_for_keypoint_draft` と anchor 状態の整合が取れること

#### `municipal-housing`

- `寄附金活用` が `シニア向け市営団地建設` の採用 anchor から外れること
- `3点目は削除します` / `5項目目` のような generic 行が採用されないこと

#### `former-cityhall`

- `収集体制の再構築...` が外れること
- `旧庁舎` を含む候補だけが残る、または `needs_review` へ落ちること

#### `lodging-tax-finance`

- `実証輸送`, `土地利用計画`, `公営団地` の誤 candidate が採用から外れること
- `基金`, `宿泊税`, `寄付金` 系の candidate だけが残ること

#### `school-education`

- `県道石垣空港線アクセス道路` が採用 anchor から外れること
- `split_recommended` で public 採用を保留できること

#### `disaster-fire-rescue`

- `医療体制の影響や市の計画性` が `地震津波の避難` から外れること
- `消防救急車両` と `避難・国民保護` の混線を story status 上で明示できること

## Not Changed

- public `docs/general_questions/r8-dai4-teireikai.general-questions.json`
- canonical JSON schema そのもの
- issue graph pilot source
- editorial decisions source
- bill / topic exact matching 方針
- DB / Supabase / import / revalidate / deploy

## Risks / Review Points

- rule-based だけでは、ASR 崩れが強いケースで `verified` を増やしすぎると取りこぼしが出る。
- 一方で保守的にしすぎると `needs_review` だらけになり、story の実用性が下がる。
- `subItemIndex` を活かす場合、public JSON 側の sub_items 粒度と canonical 候補の粒度がずれることがある。
- split issue は anchor 改善だけでは限界があり、issue 自体の再分割が並行して必要。

DB reflection needed: no  
Revalidation needed: no  
JSON source updated: no
