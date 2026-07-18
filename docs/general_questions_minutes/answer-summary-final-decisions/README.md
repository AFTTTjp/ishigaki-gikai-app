# Answer Summary Final Decisions

このディレクトリは、`answer-summary-candidates/` に記録した
reviewer-only の市側答弁 summary 候補について、人間レビュー後の
decision を保存する hand-authored decision record store です。

## Boundary

- ここにある artifact は reviewer-only です
- public General Questions JSON とは分離されています
- `confirmed_facts`、Topic JSON、DB、import、revalidation、UI へ直接接続しません
- `approve_as_written` / `approve_with_revision` は public 反映済みを意味しません
- 将来の public JSON 反映は、別 PR・別承認・別検証で行います

## Relationship To Candidate Artifact

- source candidate artifact:
  - `answer-summary-candidates/`
- final decision artifact:
  - `answer-summary-final-decisions/`

candidate artifact は抽出候補と source anchor を保持します。
final decision artifact は、その候補を人間レビューでどう扱うかだけを記録します。

## Decision And Final Approval

`decision` は reviewer の現時点の判断です。

- `approve_as_written`
  - candidate artifact の summary をそのまま採用候補として保持します
- `approve_with_revision`
  - reviewer が採用した revision 済み summary を保持します
- `hold_attribution`
  - speaker attribution が確定しないため public 反映候補から除外します
- `reject`
  - 今回は該当なしです

`final_approval_status` は public JSON へ反映してよいかを示す別の状態です。
この artifact では全件 `not_approved` です。

## Public Eligibility

`public_eligibility` は手入力フィールドとして保存しません。
将来は少なくとも次の条件から派生判定します。

- `decision` が approve 系であること
- `attribution_confidence` が `high` であること
- `item_match_confidence` が `high` であること
- `final_summary` が `null` ではないこと
- `final_approval_status` が `approved_for_public_json` であること

## Attribution Safety

- hold 候補を public JSON へ流しません
- speaker や役職を推測で補完しません
- `source_utterance_id` を根拠の主識別子とします
- `evidence_excerpt` は短いレビュー補助用抜粋に限定します
- source にない語句を加えません

## Validation Expectations

- JSON parse が通ること
- local schema に整合すること
- decisions が10件であること
- `approve_as_written` が2件であること
- `approve_with_revision` が1件であること
- `hold_attribution` が7件であること
- `reject` が0件であること
- 全件 `final_approval_status: not_approved` であること
- hold 7件の `final_summary` が `null` であること
- approve 3件の attribution confidence と item match confidence が `high` であること
- candidate ID / question ID / item number / utterance ID が source candidate artifact と一致すること
- local absolute path を混ぜないこと

## Batch Decision Artifacts

Batch 2以降の追加候補レビューは、既存の初回final decision artifactを
上書きせず、batch-specific artifactとして保存します。

- `r8-dai4-teireikai.city-answer-summaries-batch-2-decisions.json`
- `r8-dai4-teireikai.city-answer-summaries-batch-3-decisions.json`
- schema:
  `schemas/city-answer-summary-batch-decisions.schema.json`

Batch decision artifact は reviewer-only です。public General Questions
JSON、DB、import、revalidation、UIには接続しません。

Batch 3では、Batch 2でholdまたはrejectにした候補を再確認し、
3件を `approve_with_revision` として選定しました。Batch 3 artifactも
public JSONへの直接反映ではなく、別PR・別承認・別検証のための
reviewer-only decision recordです。
