# Answer Summary Candidates

令和8年第4回定例会の一般質問について、市側答弁の要約候補を
reviewer-only で確認するための作業用 artifact です。

この artifact は公開 `confirmed_facts` ではなく、公開
`city_answer_summary` でもありません。General Questions JSON、Topic
JSON、DB、import、revalidation には接続しません。

## Scope

初期版では、candidate inventory のうち次だけを対象にします。

- `unknown_answer_like` entries
- `recoverable_answer_candidates`

`direct_item_match` の 91 件全体には拡張していません。

## Review Policy

- speaker role が `unknown` の候補は `hold_attribution` とします。
- `null_item_proximity` で拾った候補は `hold_item_match` とします。
- item 対応または話者帰属が不確かな候補では、
  `candidate_summary` を生成しません。
- 原文にない主語、時点、数量、制度名を補完しません。
- 議員発言と市側答弁を混同しません。
- 既存 confirmed facts や Topic と重複するものは、公開候補として扱う前に
  reviewer が確認します。

## Files

- `r8-dai4-teireikai.answer-summary-candidates.json`
- `schemas/answer-summary-candidates.schema.json`

## Regeneration

```bash
node scripts/issue-publisher/build-answer-summary-candidates.mjs
```

The generator validates source utterance IDs, source text exact match, line
ranges, duplicate IDs, and hold status for unknown / uncertain anchors.

Reviewer decisions such as `reviewed_speaker_name`,
`attribution_confidence`, `item_match_confidence`, `candidate_summary`, and
`candidate_review_status` are preserved from the existing artifact when the
generator is re-run. The generator provides source data and safe defaults, but
does not hard-code human review decisions.
