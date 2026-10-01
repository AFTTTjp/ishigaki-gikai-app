# 議員・議会任期データ（council-members）運用メモ

石垣市議会の議員（人物）・議会任期・任期別の在職・所属スナップショットの正本。
DB スキーマと凍結ルールは [docs/ai/members-terms-model.md](../ai/members-terms-model.md) を参照。

## JSON source of truth

`ishigaki-council-members.2022-2030.json`（`schema_version: council-members/v1`）が正本。

- 必ずこの JSON を編集してから import スクリプト経由で DB に反映する。DB の直接編集で済ませない
- 検証: `scripts/import-council-members-validation.mjs`（fail-closed。1件でも問題があれば import しない）
- 計画・実行: `scripts/import-council-members-plan.mjs`（create-only。update / delete / upsert はしない）

## 中身

| キー | 内容 |
|---|---|
| `sources` | 出典（https URL、ページ更新日、観測時点、確認メモ） |
| `council_terms` | 議会任期（2022-09-28〜2026-09-27 / 2026-09-28〜2030-09-27） |
| `persons` | 人物27人。`existing` 22（既存UUIDを明示）/ `newcomer` 4 / `historical` 1（砥板芳行） |
| `member_terms` | 旧任期23行 + 新任期22行。NULL の項目は `holds` で明示 |
| `affiliation_entries` | 所属スナップショット。`status: ready` だけが `member_affiliations` の行になる |
| `source_discrepancies` | 公式ページ間の矛盾（補正せず記録） |
| `holds` | 未確認事項（旧任期の所属履歴など）と、確認に必要な一次資料 |
| `production_import_gate` | `blocked` の間は Production への書き込みをスクリプトが拒否する |

**現時点（Phase 2A）では所属スナップショット22件はすべて `hold` で、`member_affiliations` に入る行は 0 件。**
各議員の所属開始日（`effective_from`）を一次資料で確認できていないため。DBに所属データが入るのは、有効日が確定した後の別PRから。

## ルール

1. **人物は `member_id`（UUID）でのみ識別する。** 氏名による照合・補完・ID 生成をしない。importer は既存人物の氏名を「完全一致の安全確認」にだけ使い、一致しなければ中止する
2. **legacy 列（`members.party` / `party_group` / `election_count`）と `birth_date` は書かない。** 新人の生年は `birth_year_label`（証跡）としてのみ保持し、`birth_date` に変換しない
3. **所属は `effective_from` が一次資料で確定したものだけを `ready` にする。** 観測日（`*_observed_on`）や会派の結成日（`caucus_formed_on`）を `valid_from` に代用しない。確定できないものは `hold`（DB行にならない）
4. **source precedence**: 席・当選回数・政党は「議員名簿」、会派は「会派の構成」を優先する。公式間の矛盾は黙って補正せず `source_discrepancies` に記録する
5. **退任者を削除しない。** 新任期に残らない議員は新任期の `member_terms` を作らないだけ

## 使い方

```bash
# 検証 + dry-run（既定。書き込みなし。DB接続情報が無ければ offline）
node scripts/import-council-members.mjs
pnpm db:council-members:import          # .env（ローカル）でDB照合つきdry-run
pnpm db:council-members:import:prod     # .env.prod でread-only照合（既定はdry-run）

# 書き込み（ローカルのみ）
node scripts/import-council-members.mjs --execute
```

## Production への書き込みは禁止（現時点）

`members` に新人4人と砥板芳行を追加すると、現行 UI（`getMembers()` は任期フィルタなしの全件取得）が
退任者を含む27人を現任として表示する。Phase 3 の UI 互換 PR を Production に deploy するまで、
`production_import_gate.status` は `blocked` のままとし、リモートへの `--execute` を拒否する。
解除は Phase 3 の deploy 後に、この JSON の gate を `open` にする PR で行う。
