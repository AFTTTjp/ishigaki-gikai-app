# Issue Publisher Proposals

このディレクトリは published content ではなく、Issue Publisher の
proposal store / sample / schema を置く場所です。ここにある proposal は
人間レビュー前の公開候補であり、そのまま public JSON や UI に出しません。

## Directory purpose

- `samples/`
  - validator や schema を確認するための sample proposal
- `schemas/`
  - proposal の JSON Schema

Proposal は published JSON ではありません。公開物にするには、
validation gate と human review を通し、approved になった proposal だけを
export 対象にします。

`publication_status: approved_for_export` は、
public JSON に反映済みという意味ではありません。
human review を通過し、既存の JSON source of truth / import / revalidate
フローに載せる候補として扱える状態を指します。

## Proposal lifecycle

```text
draft proposal
  ↓
schema validation
  ↓
anchor validation
  ↓
human review
  ↓
approved proposal only
  ↓
published JSON export
```

## Approval metadata

proposal を `approved` / `approved_for_export` に進める場合は、
review / approval metadata を残します。

- `review.reviewer`
  - 誰が human review を行ったか
- `review.reviewed_at`
  - いつ review したか
- `review.approval_note`
  - 何を根拠に export 候補として安全と判断したか
- `review.export_readiness`
  - `not_ready` / `ready_for_export` / `blocked`
- `review.export_blockers`
  - export を止める理由がある場合のメモ
- `export`
  - 実際に public JSON へ反映した後の記録
  - `target`, `source_proposal_id`, `exported_at`, `exported_by` など

approved proposal であっても、public JSON への反映は別フェーズです。
proposal store から public JSON へ自動反映しません。

## Evidence policy

### Transcript evidence supports attributed speech, not fact

文字起こしは「発言があった」ことの根拠です。
そのため transcript evidence は `claim_type: attributed_speech` に使えますが、
transcript-only で `claim_type: fact` を通してはいけません。

- `claim_type: attributed_speech`
  - transcript evidence だけでも可
- `claim_type: fact`
  - transcript-only は不可
  - 将来的に official evidence が必要

現状の validator / evidence resolver は transcript utterance index を中心に
見ています。official evidence layer はまだ未実装のため、
`claim_type: fact` は export-ready / `approved_for_export` に進めない
fail-closed design です。これは現段階の意図した制約であり、バグではありません。

fact claim を通すために official evidence を transcript utterance index に
混ぜてはいけません。official evidence は将来、別 index / 別 locator として
設計します。

### Review artifacts are not publishable evidence

以下は探索や注意喚起には使えても、publishable evidence にはしません。

- `review_draft`
- `issue_review_packet`
- `issue_editorial_decisions`
- `session_editorial_map`
- `editorial_note`
- `issue_graph`

## Approval gate

`review.status: approved` または
`publication_status: approved_for_export` に進める前に、
少なくとも次を満たす必要があります。

- evidence anchors が exact resolve できる
- publishable evidence only である
- review-only artifact を evidence に含めない
- `claim_type: attributed_speech` は発言帰属表現に留める
- `claim_type: fact` は official evidence を別途要求する
- `related_bill_ids` は exact ID のみを使う

`publication_status: approved_for_export` は、
「human review 済みで export 候補として扱える」ことを表します。
「public JSON へ反映済み」を表す状態ではありません。

## Export boundaries

export 前は次を禁止します。

- sample / draft proposal から public JSON へ自動反映する
- DB を直接更新して公開内容を変える
- revalidate だけで content が変わるとみなす
- transcript-only `fact` claim を export する

public JSON への実反映は、既存の JSON source of truth を編集し、
import と revalidate を別フェーズで行う運用に従います。

proposal store と public JSON の乖離を防ぐため、実反映フェーズでは
`source_proposal_id` や `approval_note` を参照できる形を維持します。

## Dry-run export

approved proposal から public JSON へ直接書く前に、review-only の
dry-run artifact を生成できます。

- dry-run artifact は人間レビュー用であり、public JSON を変更しません
- target は `proposal.export.target` / `proposal.export.target_slug` の
  exact match でのみ解決します
- 明示 target がない、または exact resolve できない場合は blocked になります
- artifact には `approval_state` / `application_status` / `reviewer_guidance`
  を含め、誰が承認した proposal か、未反映であること、次に reviewer が
  何を確認すべきかを dry-run 単体で読めるようにします
- DB / revalidation は不要です
- public JSON 反映は別フェーズで行います

## Optional `candidate_v2`

既存 `issue-publisher-proposal.v0` を壊さずに、市側答弁を含む構造化 candidate を
review-only artifact へ出したい場合は、optional な `candidate_v2` を追加できます。

- `source_scope`
  - どの一般質問 item を対象にした candidate か
- `question`
  - 議員が何を問うたかの summary と anchor
- `city_answer`
  - 市側がどう答えたかの summary と anchor
- `confirmed_facts`
  - 答弁で確認できる範囲
- `unresolved_or_not_confirmed`
  - transcript だけでは確定しない点
- `recommended_reflection`
  - 将来の public reflection を検討する際の safe scope

`candidate_v2` は現段階では optional です。既存 fixture / proposal に無くても、
validator と dry-run export は従来どおり動作します。

Phase 1-A では `candidate_v2` の shape と anchor existence を確認し、
speaker role mismatch は hard fail にせず、dry-run の
`anchor_role_summary` で reviewer が確認できるようにします。

Phase 1-B では、`candidate_v2.question` の anchor が resolve しても
speaker role が `unknown` の場合、dry-run artifact の
`candidate_v2_review_warnings` に reviewer 向け warning を出します。
これは hard fail ではなく review attention list です。

## Validator responsibilities

現在の validator (`scripts/issue-publisher/validate-proposal-anchors.mjs`) は、
最低限の shape / enum check と evidence gate を担当します。

- required fields があるか
- `claim_type` / `proposal_type` / `publication_status` などの enum が妥当か
- evidence があるか
- anchor が exact resolve できるか
- review-only source を reject するか
- transcript-only fact を reject するか
- approved proposal に必要な最小 review metadata があるか

現時点では、JSON Schema を外部依存で完全評価する仕組みは入れていません。
Schema は proposal 形状の明文化、validator は運用 gate の実装です。

将来の validator では以下を追加できます。

- JSON Schema の完全 validation
- `claim_type` / `proposal_type` ごとの細かい rule
- official evidence layer
- approved export validation

## What not to do

- Proposal を published JSON として扱わない
- AI generator から public JSON に直接書かない
- DB を直接更新しない
- fuzzy matching をしない
- review artifact を公開根拠にしない

## Current sample

- `samples/r8-dai4-rito-koshien.sample.proposal.json`
  - `claim_type: attributed_speech`
  - transcript evidence による sample
  - `publication_status: not_published`

## Negative samples

- `negative-samples/`
  - validator regression 用の fixture
  - publishable proposal ではない
  - 意図的に invalid な shape や policy 違反を含む

このディレクトリには、次のような運用 gate を壊していないか確認するための
fixture を置きます。

- review-only source を publishable evidence にしない
- transcript-only `fact` claim を通さない
- invalid anchor を reject する
- required field / enum / nested shape の崩れを reject する

negative sample は public JSON に export せず、validator regression の確認だけに
使います。
