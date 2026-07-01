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

### Review artifacts are not publishable evidence

以下は探索や注意喚起には使えても、publishable evidence にはしません。

- `review_draft`
- `issue_review_packet`
- `issue_editorial_decisions`
- `session_editorial_map`
- `editorial_note`
- `issue_graph`

## Validator responsibilities

現在の validator (`scripts/issue-publisher/validate-proposal-anchors.mjs`) は、
最低限の shape / enum check と evidence gate を担当します。

- required fields があるか
- `claim_type` / `proposal_type` / `publication_status` などの enum が妥当か
- evidence があるか
- anchor が exact resolve できるか
- review-only source を reject するか
- transcript-only fact を reject するか

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
