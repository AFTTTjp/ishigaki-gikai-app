# Confirmed Fact Promotion Review

このディレクトリは、`candidate-inventory` に残った
`confirmed_fact_candidates` を人間レビューし、
将来 `confirmed_facts` へ昇格させる候補だけを reviewer-only で保存する
ための review artifact store です。

## Boundary

- ここにある artifact は public JSON ではありません
- `confirmed_facts` 本体を自動更新しません
- Topic JSON / General Question JSON / DB / import / revalidation / UI へ
  直接接続しません
- final approval がない候補は public fact として扱いません

## Intended use

- `ready_for_final_review`
  - 人手レビューで A 判定になった候補
- `needs_wording_or_source_resolution`
  - B 判定で、主語補完や source resolution が必要な候補
- `transcription_review_queue`
  - transcription / OCR 疑いのため原文再確認が必要な候補
- `excluded_from_promotion`
  - C / D / E 判定で、現段階では昇格対象にしない候補

## Hand-authored review source

この artifact は generator の出力ではなく、
reviewer の人手判断を正本として保持する hand-authored review artifact です。

- generated artifact:
  - `candidate-inventory/`
- hand-authored review artifact:
  - `confirmed-fact-promotion-review/`

## Approval rule

全候補は `final_approval_status: "not_approved"` から開始します。

- `not_approved`
  - reviewer-only 候補。public JSON に反映してはいけない
- 将来の最終承認や proposal 化は別フェーズ

## Validation expectations

- JSON parse が通ること
- local schema に整合すること
- candidate ID が一意であること
- `ready_for_final_review` と `needs_wording_or_source_resolution` の候補は
  `speaker_role: executive`
  `answer_anchor_source: direct_item_match`
  `answer_anchor_confidence: high`
  を維持すること
- `proposed_confirmed_fact` に相対日付を残さないこと
- local absolute path を混ぜないこと
