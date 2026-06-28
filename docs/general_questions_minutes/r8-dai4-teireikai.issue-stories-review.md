# Issue Stories Review

## Original Objective

Issue Story 7本が、市民向け公開前の編集下書きとして使える品質かを確認する。  
特に、本文外補完の混入、anchor の弱さ、normal/hard draft の公開下書きとしての成立性、split 必要性をレビューする。

## Reviewed Files

- `docs/general_questions_minutes/r8-dai4-teireikai.issue-stories.json`
- `docs/general_questions_minutes/issue-stories/r8-dai4/keelung-route.md`
- `docs/general_questions_minutes/issue-stories/r8-dai4/rito-koshien.md`
- `docs/general_questions_minutes/issue-stories/r8-dai4/former-cityhall.md`
- `docs/general_questions_minutes/issue-stories/r8-dai4/lodging-tax-finance.md`
- `docs/general_questions_minutes/issue-stories/r8-dai4/municipal-housing.md`
- `docs/general_questions_minutes/issue-stories/r8-dai4/school-education.md`
- `docs/general_questions_minutes/issue-stories/r8-dai4/disaster-fire-rescue.md`
- 参照:
  - `docs/general_questions_minutes/r8-dai4-teireikai.issue-review-packet.json`
  - `docs/general_questions_minutes/r8-dai4-teireikai.canonical.json`
  - `docs/general_questions/r8-dai4-teireikai.general-questions.json`

## Findings

### 1. `ready_for_keypoint_draft` の `rito-koshien` でも、採用 anchor が2件とも論点不一致で、現状のまま public 下書きには進めない

- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/rito-koshien.md:27`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/rito-koshien.md:28`
- `離島甲子園` の item に対して、採用 anchor が `市職員の窓口対応` と `最後から2番目の質問者` になっており、どちらも論点説明の根拠になっていない。
- `current_editorial_status: ready_for_keypoint_draft` という表示と、anchor 品質が釣り合っていない。

### 2. `municipal-housing` は high confidence 表示でも anchor が複数誤対応しており、confidence 表示をそのまま信頼できない

- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/municipal-housing.md:28`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/municipal-housing.md:29`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/municipal-housing.md:30`
- `シニア向け市営団地建設` に対して `東原陽昌氏の寄附金活用...`、`真喜良地域公営住宅周辺...` に対して `3点目はこの後で質問を変えていきたい...`、`家賃高騰下...` に対して `5項目目` が採用されている。
- いずれも story 本文の関連づけ根拠として弱く、公開下書きの根拠欄としては危険。

### 3. `former-cityhall` も high confidence の1件が論点不一致で、見た目より安定していない

- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/former-cityhall.md:27`
- `旧庁舎跡地開発について` に対して `2点目は収集体制の再構築と市民の周知...` が採用されており、旧庁舎跡地の論点と一致しない。
- もう1件は妥当だが、2件中1件がずれているので、story 全体としてはまだ review 必須。

### 4. `lodging-tax-finance` は bill 整理は比較的良いが、anchor が主要論点と食い違う

- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/lodging-tax-finance.md:27`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/lodging-tax-finance.md:28`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/lodging-tax-finance.md:30`
- `宿泊税基金条例` に対して `実証輸送を通じたニーズ把握と人材育成`、`基金管理` に対して `土地利用計画...宅地分譲...`、`桃原用昇氏寄付金活用` に対して `公営団地...` が採用されている。
- issue の束ね方自体は理解できるが、根拠 anchor は現状のままでは使えない。

### 5. `keelung-route` は issue の幅が広く、fallback anchor が多すぎる

- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/keelung-route.md:18`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/keelung-route.md:30`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/keelung-route.md:35`
- 10件中、fallback/low/unknown が多く、`ホルムズ海峡封鎖...` のような周辺論点まで同列に入っている。
- `定期航路` と `運賃` と `物流交流` と `クルーズ船バース` を1本にまとめるなら、少なくとも anchor の再選別が必要。

### 6. `school-education` と `disaster-fire-rescue` は split 警告自体は妥当だが、現状は 1 本の story として広すぎる

- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/school-education.md:28`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/school-education.md:31`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/disaster-fire-rescue.md:29`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/disaster-fire-rescue.md:31`
- `school-education` では `市立小中学校の統廃合` に `県道石垣空港線アクセス道路` がぶら下がっている。
- `disaster-fire-rescue` では `地震津波の避難の在り方` に `医療体制の影響や市の計画性` がぶら下がっている。
- split 警告を出していても、現在の related_questions が広すぎるため、編集者レビューの負荷が高い。

### 7. bill/topic の status と note の文言が一部食い違っていて、候補なのか確定なのか読者が迷いやすい

- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/rito-koshien.md:34`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/municipal-housing.md:36`
- 対象: `docs/general_questions_minutes/issue-stories/r8-dai4/lodging-tax-finance.md:36`
- `status` は `confirmed` だが、`note` には `bill紐付けは候補` と残っている。
- 編集内部なら読めるが、public に近い下書きとしてはステータスの意味が濁る。

### 8. `normal_draft` / `hard_draft` には本文外補完は見当たらないが、説明としてはまだ薄く、anchor 不安定さを隠せていない

- 各 story の draft はほぼ「何が関連づけられたか」の整理に徹しており、本文外の答弁や評価を足していない点は安全。
- 一方で、anchor のズレが大きい story では、`関連づけられています` という文言だけでも市民には十分な説明になりにくい。

## 7 Story の評価表

| Story | Draft安全性 | Anchor品質 | Bill/Topic整理 | Public化の近さ | 判定 |
| --- | --- | --- | --- | --- | --- |
| `former-cityhall` | 高い | 中 | 高い | 中 | topic story 候補だが anchor 1件修正前提 |
| `rito-koshien` | 高い | 低い | 高い | 中 | 構造は最有力だが anchor 再選定必須 |
| `municipal-housing` | 高い | 低い | 中〜高 | 低〜中 | 主要 anchor の入れ替え必須 |
| `lodging-tax-finance` | 高い | 低い | 中 | 低〜中 | issue は成立、anchor と topic 方針整理が必要 |
| `keelung-route` | 高い | 低い | 中 | 低 | issue の幅が広く anchor も弱い |
| `disaster-fire-rescue` | 高い | 低〜中 | 中 | 低 | split 前提。現状 public には広すぎる |
| `school-education` | 高い | 低 | 低〜中 | 低 | split 前提。広さ・anchor ともに未整理 |

## Public 化しやすい順

1. `former-cityhall`
   - 既存 topic confirmed が強い。
   - bill 不在でも topic story としては組みやすい。
   - ただし 友寄永三の anchor は差し替え必要。
2. `rito-koshien`
   - bill / topic の整理は最も強い。
   - ただし現行 anchor は 2/2 で不適切。
3. `municipal-housing`
   - 議案第40号が中心に置きやすい。
   - new topic 候補も素直。
   - ただし anchor がかなり崩れている。
4. `lodging-tax-finance`
   - issue の編集軸はある。
   - ただし item ごとの根拠が現状弱い。
5. `keelung-route`
   - 候補 bill / topic はあるが、issue 幅と anchor の両面で再整理が必要。
6. `disaster-fire-rescue`
   - split 後なら一部は進められる。
7. `school-education`
   - split が前提で、かつ current related_questions の再仕分け量が大きい。

## 本文外補完の疑い

- 明確な本文外補完は見当たらない。
- `normal_draft` / `hard_draft` は概ね source 制約を守っている。
- ただし、anchor が不適切な場合でも story 側では `参照されています` と自然文で流れるため、読者には「根拠が足りない」ことが見えにくい。

## Anchor 弱い箇所

### 明確に弱い、または論点不一致

- `rito-koshien`
  - `市職員の一項目め市職員の窓口の対応について...`
  - `最後から2番目の質問者となりました`
- `municipal-housing`
  - `東原陽昌氏の寄附金活用による一般財団法人施設...`
  - `3点目はこの後で質問を変えていきたいと思いますので`
  - `5項目目`
- `former-cityhall`
  - `2点目は収集体制の再構築と市民の周知...`
- `lodging-tax-finance`
  - `実証輸送を通じたニーズ把握と人材育成`
  - `土地利用計画の進捗状況...宅地分譲...`
  - `公営団地において高齢者が申し込みできる枠...`
- `school-education`
  - `県道石垣空港線アクセス道路について`
  - `次に石垣市北部地域西部地域活性化基本構想における旧平久保小学校...`
- `disaster-fire-rescue`
  - `3 医療体制の影響や市の計画性について質問します`
  - `2点目に`

### fallback anchor が多い story

- `keelung-route`: fallback 7/10
- `rito-koshien`: fallback 2/2
- `school-education`: fallback 4/8
- `disaster-fire-rescue`: fallback 1/4

## Split 提案

### `school-education`

- `school-giga-devices`
  - 議案第48号
  - 議案第49号
  - GIGA 端末、教育 ICT、関連機器整備
- `school-environment-and-support`
  - 学校統廃合
  - 老朽校舎
  - 不登校支援
  - 学校図書費
  - 教育支援センター

### `disaster-fire-rescue`

- `fire-and-ambulance-assets`
  - 議案第50号
  - 議案第51号
  - 消防行政
  - 救助工作車、高規格救急自動車
- `tsunami-evacuation-and-civil-protection`
  - 地震津波の避難
  - 国民保護
  - 有事対応

## Story ごとの所見

### `former-cityhall`

- draft 自体は安全。
- topic confirmed が効いていて、7本の中ではもっとも topic story 化しやすい。
- ただし anchor 1件がズレているので、現状のまま public 向け draft に上げるのはまだ早い。

### `rito-koshien`

- bill / topic / committee は最も分かりやすい。
- 一方で anchor が 2/2 崩れており、現状の story だけ読むと何が質問されたのか分からない。
- 構造上は最優先候補だが、anchor 再抽出前提。

### `municipal-housing`

- citizen question と issue 軸は分かりやすい。
- `confirmed bill + new topic candidate` の形も悪くない。
- ただし related_questions の anchor が複数ずれているので、編集下書きとしても根拠欄が不安。

### `lodging-tax-finance`

- issue のまとめ方は理解できる。
- bill の主従関係も見やすい。
- ただし `宿泊税 / 基金 / 寄付金` をまたぐので、anchor 精度が足りないと一気に雑に見える。

### `keelung-route`

- issue 自体が広く、topic 候補も candidate 止まり。
- related_questions が 10 件と多く、しかも low / unknown が多い。
- まず `定期航路` 本体と周辺論点を分けて考えたい。

### `school-education`

- split warning は正しい。
- ただし split warning があるだけでは足りず、related_questions の一部が現在の issue と実際に結び付いていない。
- public 下書きにする前に、sub-issue 単位で rebuild したい。

### `disaster-fire-rescue`

- split warning は正しい。
- `消防救急車両` と `避難・国民保護` は編集上ほぼ別 story と考えた方がよい。
- 内原英聡の `地震津波` anchor が崩れているので、そのままでは story 根拠が弱い。

## 次に修正すべきファイル

1. `scripts/build-issue-stories.mjs`
   - canonical anchor の採用条件見直し
   - low/unknown fallback の扱い見直し
   - `high` でも短すぎる、または論点不一致の anchor を弾く必要あり
2. `docs/general_questions_minutes/r8-dai4-teireikai.issue-stories.json`
   - rebuilt 対象
3. `docs/general_questions_minutes/issue-stories/r8-dai4/*.md`
   - rebuilt 対象
4. 必要なら upstream:
   - `docs/general_questions_minutes/r8-dai4-teireikai.canonical.json`
   - ただし今回は story generator 側の採用ロジック見直しを優先したい

## Conclusion

- 7本とも `本文外補完を避ける` という点では概ね安全。
- ただし `related_questions.anchor_text` の品質差が大きく、story によっては編集下書きとしても根拠欄が不十分。
- 現時点で「すぐ public keyPoint / topic story 化できる」と言えるものはない。
- もっとも近いのは `former-cityhall` と `rito-koshien` だが、どちらも anchor 再選定が先。

DB reflection needed: no  
Revalidation needed: no  
JSON source updated: yes
