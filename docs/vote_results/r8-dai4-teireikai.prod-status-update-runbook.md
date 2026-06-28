# 令和8年第4回定例会 `bills.status` 本番反映 Runbook

この文書は **手順書** です。実行済み記録ではありません。  
Claude / Codex はこの手順書を作成するだけで、DB接続・SQL実行・revalidation は行いません。  
以下は **人間の実行担当者が内容を確認し、承認を得たうえで手動実行** してください。

---

## 0. 前提

| 項目 | 値 |
|---|---|
| 対象会期 slug | `ishigaki-r8-dai4-teireikai` |
| prod Supabase project ref | `sjjesaheibvpteoytbpy` |
| 対象 | `bills[]` 17件のみ |
| 対象外 | 承認・請願・報告・委員会提出議案・撤回・修正案単体 |
| preview SQL | `docs/vote_results/r8-dai4-teireikai.bill-status-update.preview.sql` |
| update review SQL | `docs/vote_results/r8-dai4-teireikai.bill-status-update.review.sql` |
| vote results artifact | `docs/vote_results/r8-dai4-teireikai.vote-results.review.json` |

> 重要: `supabase db --linked` は **使用禁止**。  
> 接続先が不明な状態で SQL を実行してはいけません。

---

## 1. 実行前チェック

### 1-1. 実行者記録

- 実行者:
- 実行日時:
- 作業目的:

### 1-2. 接続先確認

- Supabase ダッシュボード URL:
- project ref が `sjjesaheibvpteoytbpy` であることを目視確認した:
  - [ ] yes
- 接続先が prod であることを確認した:
  - [ ] yes
- 接続先が不明な場合は **ここで中止**:
  - [ ] yes

### 1-3. 明示的禁止事項

- [ ] `supabase db --linked` を使わない
- [ ] unrelated SQL を同時に実行しない
- [ ] preview SQL と update SQL を同時に実行しない
- [ ] 人間承認なしで prod update を実行しない

---

## 2. 使用SQL

### 2-1. preview SQL

- ファイル:
  - `docs/vote_results/r8-dai4-teireikai.bill-status-update.preview.sql`
- 用途:
  - 対象17件の一致確認
  - `current_status` / `current_status_note` の確認
  - `proposed_status` / `proposed_status_note` の確認
  - `preview_judgement` の確認

### 2-2. update review SQL

- ファイル:
  - `docs/vote_results/r8-dai4-teireikai.bill-status-update.review.sql`
- 用途:
  - `bills.status`
  - `bills.status_note`
  を対象17件だけ更新

---

## 3. 実行前バックアップ SELECT

update 実行前に、対象17件の現状を必ず保存する。  
保存先は SQL Editor の結果エクスポート、または別途記録ファイルでよい。

最低限保存する列:

- `id`
- `name`
- `status`
- `status_note`
- `updated_at`

保存結果メモ:

- 保存先:
- 保存日時:
- 実行者:

---

## 4. Preview 実行

### 4-1. 実行

- preview SQL 実行日時: 2026-06-28 JST
- 実行者: Codex（読み取りのみ）

### 4-2. 結果貼り付け欄

- `matched_count`: 17
- `missing_count`: 0
- `unexpected_count`: 0
- `preview_judgement` の要約: `OK_FOR_REVIEW_SQL` 17件

詳細結果の保存先:

- preview 結果保存先: この runbook とチャット記録

### 4-3. 停止条件

以下のいずれかに該当したら **update 実行禁止**:

- [ ] `matched_count != 17`
- [ ] `missing_count != 0`
- [ ] `unexpected_count != 0`
- [ ] `preview_judgement` に異常がある
- [ ] 接続先が不明
- [ ] 人間承認が未取得

---

## 5. 人間承認

preview 結果を貼り付けたうえで、人間承認を得る。

- 承認者: ユーザー（チャット承認）
- 承認日時: 2026-06-28 JST
- 承認コメント: preview 条件を満たしているため update SQL に進行可

承認取得:

- [ ] yes
- [x] yes

---

## 6. Update 実行

### 6-1. 実行記録

- update 実行開始:
- update 実行終了:
- 実行者:

### 6-2. RETURNING 結果

update review SQL の `RETURNING` 結果を必ず保存する。

- RETURNING 結果保存先:
- 17件すべて返った:
  - [ ] yes

---

## 7. Rollback 方針

rollback は **自動実行しない**。  
必要時は、実行前バックアップ SELECT に保存した `status` / `status_note` をもとに、対象17件だけを手動で戻す。

前提:

- 実行前バックアップが保存済みであること
- rollback 対象が 17件のみであること
- 接続先が prod であることを再確認すること

rollback 実施の要否:

- [ ] 不要
- [ ] 必要（理由を記録）

理由:

---

## 8. Revalidation 手順

DB 反映後は revalidation が必要。

対象 tags:

- `bills`
- `diet-sessions`
- `topics`

使用スクリプト:

- `scripts/revalidate.mjs`

実行メモ:

- 使用 env:
- 使用 URL:
- 実行日時:
- 実行者:
- 結果:

> `REVALIDATE_SECRET` や URL の値そのものは、この runbook に書かない。  
> secret / password / token は記録しない。

---

## 9. UI 確認

反映後に最低限確認する URL:

- `/kokkai/ishigaki-r8-dai4-teireikai/bills`
- `/topics/rito-koshien-r8-dai4`
- `/topics/ishigaki-keelung-route-yaimamaru`
- 代表 bill detail

代表 bill detail 候補:

- 議案第36号
- 議案第42号
- 議案第45号
- 議案第52号

確認項目:

- [ ] 「議会審議中」が更新されている
- [ ] `status_note` が採決結果に変わっている
- [ ] topic 関連議案側も追随している
- [ ] 想定外の議案に変更が出ていない

確認メモ:

---

## 10. 最終チェックリスト

- [ ] 実行者・日時を記入した
- [ ] prod project ref `sjjesaheibvpteoytbpy` を確認した
- [ ] 実行前バックアップ SELECT を保存した
- [ ] preview SQL を実行した
- [ ] `matched_count = 17`
- [ ] `missing_count = 0`
- [ ] `unexpected_count = 0`
- [ ] `preview_judgement` に異常がない
- [ ] 人間承認を取得した
- [ ] update review SQL を実行した
- [ ] RETURNING 結果を保存した
- [ ] revalidation を実行した
- [ ] UI確認を完了した

---

## 11. 参考

- preview SQL:
  - `docs/vote_results/r8-dai4-teireikai.bill-status-update.preview.sql`
- update review SQL:
  - `docs/vote_results/r8-dai4-teireikai.bill-status-update.review.sql`
- vote results review artifact:
  - `docs/vote_results/r8-dai4-teireikai.vote-results.review.json`
