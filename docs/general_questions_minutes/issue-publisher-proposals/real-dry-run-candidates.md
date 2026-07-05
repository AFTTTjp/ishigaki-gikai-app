# Real Dry-Run Candidates

この文書は、Issue Publisher の merge 済み real dry-run fixture を
人間レビュー用に棚卸しするための一覧です。

- public JSON 反映リストではありません
- DB / import / revalidation は対象外です
- review-only dry-run artifact を見ながら editorial judgment する候補だけを載せます

## Ready For Human Review

現時点で、人間レビューに並べる候補は次の 2 件です。

- `former-cityhall`
- `rito-koshien`

| Candidate | Proposal File | Dry-Run File | Target Surface | Target Slug / ID | claim_type | proposal_type | Anchor Count | related_bill_ids | Review / Export Status | Application Status | Human Review Note | Public Reflection Readiness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `former-cityhall` | `approved-state-fixtures/positive/approved-attributed-speech-former-cityhall-real-topic-target.proposal.json` | `issue-publisher-export-dry-runs/approved-attributed-speech-former-cityhall-real-topic-target.dry-run.json` | `topic` | `ishigaki-old-city-hall` | `attributed_speech` | `discussion_point` | 2 | `[]` | `approved` / `approved_for_export` / `ready_for_export` | `applied: false`, `public_json_written: false`, `db_written: false`, `revalidation_needed: false` | exact topic target と exact transcript anchors はあるが、issue story 側 review は未完了 | `not ready` |
| `rito-koshien` | `approved-state-fixtures/positive/approved-attributed-speech-rito-koshien-real-topic-target.proposal.json` | `issue-publisher-export-dry-runs/approved-attributed-speech-rito-koshien-real-topic-target.dry-run.json` | `topic` | `rito-koshien-r8-dai4` | `attributed_speech` | `discussion_point` | 2 | `[]` | `approved` / `approved_for_export` / `ready_for_export` | `applied: false`, `public_json_written: false`, `db_written: false`, `revalidation_needed: false` | 6月議会答弁 only の candidate として narrow 化済みだが、topic の 7月状態と混同しない review が必要 | `not ready` |

## Candidate Notes

### `former-cityhall`

- exact topic target あり
- exact transcript anchors あり
- review-only dry-run としては安定しています
- ただし issue story 側には `anchor_selection_status: needs_review` が残っています
- `issue-stories-review` では anchor 1 件ズレの指摘が残っています
- public reflection には進めず、まず editorial review 対象として扱います

### `rito-koshien`

- exact topic target あり
- exact transcript anchors あり
- 6月議会答弁に限定した `attributed_speech` candidate です
- public topic はすでに 7 月の出場決定状態を含んでいます
- そのため、6月答弁 candidate と 7 月決定状態を混同しない review が必要です
- issue story 側では anchor 再選定必須の注意が残っています
- public reflection には進めず、review-only として扱います

## Not Ready / Not Included

### `lodging-tax`

- sample proposal はあります
- ただし topic 未確定です
- issue story 側の anchor review も未完了です
- まだ real dry-run 候補には進めません

### Generic Approved Fixtures

以下は regression / dry-run path coverage 用であり、人間レビュー候補には含めません。

- `approved-attributed-speech.proposal.json`
- `approved-attributed-speech-topic-target.proposal.json`
- `approved-attributed-speech-general-question-target.proposal.json`
- `approved-attributed-speech.blocked.dry-run.json`

### Negative Fixtures

以下は validator / approval gate regression 用です。

- `negative-samples/`
- `approved-state-fixtures/negative/`

人間レビュー候補には含めません。

## Next Judgment

- まずは `former-cityhall` と `rito-koshien` の 2 件を人間レビューで読む
- public reflection へ進める場合は、別タスクで source / anchor / topic 整合を再監査する
- JSON source of truth / DB / revalidate のフローは別フェーズとして扱う
