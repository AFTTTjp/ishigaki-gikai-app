# r8-dai4 Canonical Item Matching Investigation

## Scope

- 対象は upstream の canonical item matching 改善に限定する。
- 直前 commit `27eb86c` の `build-issue-stories.mjs` 側品質ゲートとは責務を分ける。
- 調査のみであり、実装・commit・push・DB・import・revalidate・deploy は行わない。

## Files Inspected

- `scripts/build-general-questions-canonical-from-minutes.mjs`
- `scripts/build-issue-stories.mjs`
- `docs/general_questions/r8-dai4-teireikai.general-questions.json`
- `docs/general_questions_minutes/r8-dai4-teireikai.canonical.json`
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-review-packet.json`
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-stories.json`
- `local-transcriber/outputs_minutes_input/*一般質問_minutes*.md`
  - 仲間均
  - 仲嶺忠師
  - 後上里厚司
  - 大道夏代
  - 宮良操
  - 花谷史郎
  - 内原英聡
  - 井上美智子
  - 長浜信夫
  - 伊良部和摩
  - 石垣達也

## Current Canonical Flow

### 1. Canonical JSON generator

- canonical JSON を生成している script は `scripts/build-general-questions-canonical-from-minutes.mjs`。
- minutes ファイルは `local-transcriber/outputs_minutes_input` から `*一般質問_minutes.md` を列挙する。
- public JSON `docs/general_questions/r8-dai4-teireikai.general-questions.json` と `question_date + member_name_raw` の exact match で対応付ける。

### 2. Canonical question の組み立て

- `parseMinutesMarkdown()` が minutes から以下を読む。
- `extracted_overview`
- `keywords`
- `review_flags`
- `question_items`
- `full_text`
- `question_items` は `parseQuestionItems()` が `## 質問項目候補` の bullet を読むだけで生成している。
- 各 candidate に保存されるのは実質 `raw_anchor_text` と `confidence`、および `inferItemNumber()` で取れた `item_number` のみ。
- line 番号は input では存在するが canonical JSON には保存されていない。
- `item_title` と `sub_item_text` は canonical には保存されていない。

### 3. item_number 推定ルール

- `inferItemNumber()` は先頭の数表現だけを見る。
- `(\d+)項目目`
- `(\d+)点目`
- `(\d+)番目`
- そのため、`次石垣市4番目石垣台湾定期航路` のような崩れた行、`項目7...`、`質問第一点目...`、`次に国民保護計画について...` のような非定型行はほぼ取りこぼす。

### 4. story builder が canonical から使っているフィールド

- `scripts/build-issue-stories.mjs` は `buildCanonicalQuestionMap()` で canonical `question_items` を `item_number` ごとに bucket 化する。
- `item_number === undefined` の candidate は story builder から見えなくなる。
- `resolveRelatedQuestion()` は review packet の `questionSlug + itemNumber` で canonical bucket を引き、そこから anchor 候補を選ぶ。
- つまり current story builder は canonical 側の `item_number` に強く依存しており、upstream で誤ると後段では補正しきれない。

## Root Cause

### Root cause 1. Canonical は「質問項目候補」をそのまま保存しており、item への再マッチをしていない

- canonical は minutes 側で抽出された `raw_anchor_text` をそのまま持つだけで、public JSON の `items[]` / `sub_items[]` に再対応付けしていない。
- そのため `2点目に低所得高齢者...` のような sub-item 候補が、そのまま parent item と同列に置かれる。
- 逆に `次に国民保護計画について...` のような item title に近いが番号を持たない行は、後段で使えない。

### Root cause 2. item_number 推定が「先頭の数字パターン」だけ

- `質問第一点目は石垣台湾定期行動事業についてであります`
- `項目7有事国民保護に関する計画や訓練の進捗と課題について質問します`
- `次石垣市4番目石垣台湾定期航路`
- `次に国民保護計画についてお伺いいたします`
- 上のような候補は public item に強く近いが、現行 canonical では `item_number` を持てないか、誤った番号を持つ。

### Root cause 3. sub_item matching が存在しない

- public JSON には `items[].sub_items[]` があるが、canonical `question_items` には `sub_item_index` も `sub_item_text` もない。
- その結果、`基金管理` や `シニア向け市営団地建設` のように item 配下で 1点目〜6点目が並ぶ質問は、正しい sub-item を持っていても canonical では parent item としか接続できない。

### Root cause 4. procedural / answer-like 行を canonical 側で弱めていない

- `3点目はこの後で質問を変えていきたいと思いますので`
- `3点目は削除します`
- `続きまして5項目目 ハーディ広場整備についての質問にお答えします`
- `最後から2番目の質問者となりました`
- これらは story builder 側では now defensive に落ちるが、canonical 側では依然として `question_items` に残っている。
- upstream で `candidate_kind` を持たないため、後段で毎回弾き直す必要がある。

### Root cause 5. source line と周辺文脈を失っている

- minutes 側の `質問項目候補` には `line` があるが、canonical JSON では保存していない。
- 後段が `raw_anchor_text` だけを見る構造なので、発話順や近傍候補のまとまりを使えない。

## Issue-Centric Findings

### rito-koshien

- `後上里厚司 item 7 離島甲子園について`
  - canonical には `最後に離島公支援についてお伺いします` があるのに、`item_number` を持たないため story builder から見えない。
- `長浜信夫 item 3 離島甲子園大会出場について`
  - canonical には `児童公支援大会についてお伺いいたします` があるのに、`item_number` を持たない。
- 問題の中心は item boundary ではなく、`番号なしだが title に近い行` の未活用。

### municipal-housing

- `仲間均 item 2 シニア向け市営団地建設`
  - canonical には `1点目〜6点目` がきれいに取れている。
  - しかし `2番目東原陽昌氏の寄附金活用...` も同じ `item_number: 2` で混入している。
  - つまり番号推定だけで item に紐付けると false positive が起きる。
- `石垣達也 item 3 / item 5`
  - `3点目はこの後で質問を変えていきたいと思いますので`
  - `5項目目`
  - など procedural 候補が `item_number` を持ってしまっている。
  - 一方で `団地周辺における公共交通及び道路環境の改善について...` のような意味的に強い行は `item_number` なし。

### lodging-tax-finance

- `伊良部和摩 item 2 石垣市宿泊税基金条例と税の活用について`
  - canonical の `item_number: 2` は `実証輸送を通じたニーズ把握...` で、完全に別論点。
  - 同じ質問内の別 item から数字だけを拾って誤対応している。
- `仲嶺忠師 item 1 基金管理について`
  - `1点目に各種基金の詳細について`
  - `2点目に各種基金の活用並びに運用状況について`
  - ここは sub-item が strong に取れている。
  - ただし `1点目に、土地利用計画の進捗状況について...` も `item_number: 1` で混入しており、question 内の別 item を誤って同じ bucket に入れている。
- `仲間均 item 3 桃原用昇氏寄付金活用`
  - canonical の `item_number: 3` は `公営団地における高齢者...` で別論点。
  - 逆に `次に東原養生市の寄附金活用についての質問を行いますが` は `item_number` を持たない。

### school-education

- `花谷史郎 item 3 市立小中学校の統廃合`
  - canonical は空港アクセス道路や土地区画整理の `1番目 / 2番目` を拾っており、教育 item の候補がほぼ取れていない。
  - 質問項目抽出そのものが broad/general で、item matching 以前に candidate quality が弱い。
- `井上美智子 item 2 国民保護計画について`
  - canonical には `次に国民保護計画についてお伺いいたします` がある。
  - しかし `item_number` がなく、代わりに `2点目に` のような弱い断片も存在しない。
  - title phrase を使えば item 2 にかなり高精度で寄せられる。

### disaster-fire-rescue

- `内原英聡 item 6 地震津波の避難の在り方`
  - `項目7有事国民保護...` は取れているが、item 6 の anchor は弱い。
  - `続いて項目の5に入ります` など手続き行が残る一方、避難 item title に近い行が見つかっていない。
- `井上美智子 item 2 国民保護計画について`
  - 上と同じく、title phrase はあるが item_number がない。
  - item title match を使えば改善余地が大きい。

### keelung-route

- `後上里厚司 item 4 石垣・台湾定期航路`
  - canonical に `次石垣市4番目石垣台湾定期航路` がある。
  - OCR/ASR 崩れで `4番目` が文中に埋まり、現行 `inferItemNumber()` では拾えない。
- `後上里厚司 item 5 クルーズ船専用バースの利用状況について`
  - canonical に `5.クルーズ船専用バース利用状況についてお伺いします` がある。
  - これも現行番号抽出が弱い。
- `大道夏代 item 1 定期航路事業について`
  - canonical 候補が一般的すぎて item boundary を持たない。
  - question 全体 candidate と item candidate を分ける必要がある。
- `宮良操 item 1 定期航路事業について`
  - `質問第一点目は石垣台湾定期行動事業についてであります` はかなり strong だが、現行 `inferItemNumber()` が取れない。
- `長浜信夫 item 4 台湾・石垣定期船就航について`
  - `台湾医者駅定期航路就航についてお伺いします` は title phrase で救える。

## Proposed Upstream Improvement

### Goal

- canonical で `question_items` を単なる raw anchor の列ではなく、`public JSON の item / sub_item に再対応付けされた候補列` にする。
- story builder は引き続き consumer / quality gate に留める。
- 「より多く拾う」は canonical 側で行い、「間違いを採用しない」は story builder 側で続ける。

### Proposed matching model

- `question_items` に以下の additive fields を持たせる。
- `source_line`
- `detected_item_number`
- `detected_sub_item_number`
- `candidate_kind`
  - `item_heading`
  - `sub_item_detail`
  - `procedural`
  - `answer_like`
  - `other`
- `matched_item_number`
- `matched_item_title`
- `matched_sub_item_index`
- `matched_sub_item_text`
- `match_basis`
  - `explicit_number`
  - `item_title_phrase`
  - `sub_item_phrase`
  - `sequence_inference`
  - `manual_review_only`
- `match_confidence`
  - `high`
  - `medium`
  - `low`

### Matching stages

#### Stage 1. Candidate normalization

- `raw_anchor_text` を normalize して、ASR 崩れを軽く吸収する。
- `4番目 商船八重間` → `4番目 商船やいま`
- `項目7有事国民保護` → `項目7 有事 国民保護`
- この段階では rewrite しすぎず、match 用 normalized text を別で持つ。

#### Stage 2. Candidate classification

- procedural / answer-like / heading / detail を分ける。
- `次に移ります`
- `削除します`
- `お答えします`
- `質問者となりました`
- これらは canonical `question_items` に残すとしても `candidate_kind=procedural` として弱める。

#### Stage 3. Public item alignment

- public JSON の `items[].title` と `sub_items[]` を normalize して match dictionary を作る。
- item title phrase の strong match があれば `matched_item_number` を与える。
- sub_item phrase の strong match があれば `matched_item_number + matched_sub_item_index` を与える。
- explicit number がある candidate は、その number と phrase match が一致するかを確認する。
- explicit number と phrase が衝突する場合は `low` に落とす。

#### Stage 4. Sequence inference

- 同一 question 内で `1点目〜6点目` の連続列が取れている場合、近傍候補と発話順から item/sub_item の並びを補助推定する。
- `仲間均`
- `仲嶺忠師`
- `石垣達也`
- などの multi-sub-item 型で特に有効。

#### Stage 5. Optional LLM verification

- LLM を入れるなら canonical builder の後、`複数 item に同程度で当たる候補` のみを review-enrichment する段階がよい。
- 全候補に LLM を掛けるのではなく、rule-based で 1〜2 候補に絞った後の tie-break に限定する。
- story builder 側の verification と重複させないため、canonical 側 LLM は `item/sub_item assignment` にだけ責務を絞る。

## Proposed Minimal Implementation

### Change targets

- 主対象:
  - `scripts/build-general-questions-canonical-from-minutes.mjs`
- 検証時のみ再生成対象:
  - `docs/general_questions_minutes/r8-dai4-teireikai.canonical.json`
  - 必要なら確認用に `docs/general_questions_minutes/r8-dai4-teireikai.issue-stories.json`
  - 必要なら確認用に `docs/general_questions_minutes/issue-stories/r8-dai4/*.md`

### Not changing in the first upstream PR

- `scripts/build-issue-stories.mjs`
- public `docs/general_questions/r8-dai4-teireikai.general-questions.json`
- DB / Supabase / import / revalidate / deploy

### Minimal implementation shape

- `parseQuestionItems()` で `line` を保持する。
- `inferItemNumber()` を number-prefix only から拡張する。
  - 文頭以外の `4番目`
  - `項目7`
  - `質問第一点目`
  - `次に3項目目`
  - `最後に...` を item heading 候補として扱う
- public JSON items/sub_items を参照して `matched_item_number` と `matched_sub_item_index` を付与する。
- compatibility のため、`item_number` は `matched_item_number` が `high` のときだけ上書きする。
- それ以外は `detected_item_number` と `matched_*` を追加し、story builder が読まなくても壊れない形にする。

### Expected effect on current consumers

- `build-issue-stories.mjs` は現行のままでも、high-confidence match で補正された `item_number` を拾えるようになる。
- 追加フィールドは無視されるため、最初の upstream PR では story builder のコード変更を必須にしなくてよい。

## Verification Plan

### Commands

- `node --check scripts/build-general-questions-canonical-from-minutes.mjs`
- `node scripts/build-general-questions-canonical-from-minutes.mjs`
- `node scripts/build-issue-stories.mjs`
- `git diff --stat`

### Canonical-level checks

- canonical JSON が valid JSON
- `questions.length === 21`
- 代表 slug で `item_number` / `matched_item_number` / `matched_sub_item_index` が改善していること
- `source_line` が保存されていること

### Representative story checks

- `municipal-housing`
  - 仲間均 item 2 が `寄附金` ではなく `シニア向け市営団地建設` 系 anchor を候補に持つこと
  - 石垣達也 item 3 / 5 が `削除します` や bare `5項目目` だけにならないこと
- `rito-koshien`
  - 長浜信夫 item 3 が `児童公支援大会...` 系に近づくこと
  - 後上里厚司 item 7 が `最後に離島公支援...` を拾える可能性が出ること
- `lodging-tax-finance`
  - 伊良部和摩 item 2 から `実証輸送` を外せること
  - 仲嶺忠師 item 1 は `基金` の sub-item に寄せられること
  - 仲間均 item 3 は `寄附金活用` に戻ること
- `school-education`
  - 井上美智子 item 2 が `次に国民保護計画について...` のような title phrase で救える設計になっていること
  - 花谷史郎 item 3 は no-match のままでも、空港/浄水場 anchor を誤採用しないこと
- `disaster-fire-rescue`
  - 井上美智子 item 2 が `国民保護計画` へ寄ること
  - 内原英聡 item 6 / 7 の分離が改善すること
- `keelung-route`
  - 後上里 item 4 / 5 が `4番目` / `5.` を拾えること
  - 宮良操 item 1 が `質問第一点目...` から拾えること
  - 長浜信夫 item 4 が `台湾...定期航路就航...` へ寄ること

## PR / Commit Sequencing Recommendation

- `27eb86c` は先に push / PR する方がよい。
- 理由:
  - `story builder` 側品質ゲート強化として責務が独立している
  - 今回の upstream 改善は canonical enrichment であり、レビュー観点が別
  - 2つを同じ PR にすると「守りの品質ゲート」と「拾いに行く matching 改善」が混ざる

### Recommended workflow

- PR-1:
  - `27eb86c` をそのまま push / PR
  - title 例: `Tighten issue story anchor verification`
- PR-2:
  - clean worktree か新しい branch/worktree で着手
  - base は `27eb86c`
  - title 例: `Improve canonical item matching from minutes`

### How to avoid mixing with current untracked files

- 現在の repo には未コミットの別ファイル群が多い。
- 次の upstream PR は現在の working tree で続けるより、clean worktree を切る方が安全。
- 推奨:
  - `27eb86c` を push / PR
  - その後、別 worktree を `27eb86c` から作る
  - canonical matching 作業はその clean worktree だけで行う

## Not Changed

- public general questions JSON
- issue-stories builder 実装
- DB / Supabase / import / revalidate / deploy
- fuzzy bill_name matching

## Risks / Review Points

- minutes 側 `質問項目候補` 自体が弱い質問では、canonical だけで完全には救えない。
- 特に `大道夏代`、`花谷史郎` のような broad / noisy 抽出は、canonical matching 改善だけでは no-match が残る可能性が高い。
- `item_number` を自動上書きする場合は backward compatibility に注意が必要。
- 最初の upstream PR では additive fields を持たせ、`high` のみ既存 `item_number` に反映する方が安全。

## Recommendation

- upstream の最小改善は `build-general-questions-canonical-from-minutes.mjs` に閉じるべき。
- まず canonical に `matched_item_number / matched_sub_item_index / candidate_kind / source_line` を持たせる。
- story builder は次段階でその enriched canonical を読むようにしてもよいが、最初の PR は consumer 非変更でも成立する形に寄せる。
