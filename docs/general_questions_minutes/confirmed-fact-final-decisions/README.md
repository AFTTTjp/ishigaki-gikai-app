# Confirmed Fact Final Decisions

このディレクトリは、`confirmed-fact-promotion-review/` に記録した
reviewer-only 候補のうち、最終承認判断を別 artifact として保存する
hand-authored decision record store です。

## Boundary

- ここにある artifact は reviewer-only です
- `approve_as_written` / `approve_with_revision` は public 反映済みを意味しません
- public `confirmed_facts` を自動更新しません
- Topic JSON / General Question JSON / DB / import / revalidation / UI へ
  直接接続しません
- proposal 作成、dry-run、validation、最終承認後の public 反映は別工程です

## Relationship To Source Review

- source review artifact:
  - `confirmed-fact-promotion-review/`
- final decision artifact:
  - `confirmed-fact-final-decisions/`

source review では候補の監査根拠を保持し、
final decision では reviewer の判断結果だけを保持します。

## Wording Layers

この artifact では、次の3層を区別します。

- `original_candidate`
  - inventory builder が残した reviewer-only candidate
- `source_review_proposed_fact`
  - promotion review artifact 側で保持していた review wording
- `final_recommended_fact`
  - 最終承認判断時点の推奨 wording

## Unresolved Notes

`unresolved_note` は、public 反映前に再確認が必要な論点を記録します。

例:

- OCR / transcription 揺れ
- 主語補完の再確認
- 原会議録または音源での確認が必要な箇所

`approve_with_revision` であっても、
`unresolved_note` が残る場合は public fact として即時反映しません。

## Validation Expectations

- JSON parse が通ること
- local schema に整合すること
- decision ID が一意であること
- candidate ID が source promotion review の ready 8件に解決できること
- source utterance が全件解決できること
- 全件 `speaker_role: executive` を維持すること
- 全件 `answer_anchor_source: direct_item_match` を維持すること
- 全件 `answer_anchor_confidence: high` を維持すること
- 全件 `public_reflection_status: not_reflected` を維持すること
- 全件 `proposal_status: not_created` を維持すること
- `final_recommended_fact` に相対日付を残さないこと
- local absolute path を混ぜないこと
