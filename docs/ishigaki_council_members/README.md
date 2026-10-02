# 議員・議会任期データ（council-members）運用メモ

石垣市議会の議員（人物）・議会任期・任期別の在職・所属（履歴候補と観測スナップショット）の正本。
DB スキーマと凍結ルールは [docs/ai/members-terms-model.md](../ai/members-terms-model.md) を参照。

## JSON source of truth

`ishigaki-council-members.2022-2030.json`（`schema_version: council-members/v2`）が正本。validator は v2 を厳密に検証し、v1 など他のバージョンを v2 として解釈しない。

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
| `affiliation_entries` | **所属履歴候補（effective-dated affiliation candidate）。** `status: ready`（`effective_from` が一次資料で確定）だけが `member_affiliations` の行になる。現在は22件すべて `hold` |
| `affiliation_snapshots` | **観測スナップショット。** 「`observed_on` 時点の資料ではこの所属だった」という記録で、所属の開始日ではない。`member_affiliation_snapshots` の行になる（現任期22件）。出典は root `sources` の id で参照し、import 時に URL へ解決する |
| `source_discrepancies` | 公式ページ間の矛盾（補正せず記録） |
| `holds` | 未確認事項（旧任期の所属履歴など）と、確認に必要な一次資料 |
| `production_import_gate` | `blocked` の間は Production への書き込みをスクリプトが拒否する |

### 用語の整理

| 正本 JSON | DB | 意味 |
|---|---|---|
| `affiliation_entries` | `member_affiliations` | 有効期間つきの所属**履歴**。`valid_from` が一次資料で確定したものだけが DB 行になる（`ready`）。現時点は ready 0 / hold 22 で、DB 行は 0 件 |
| `affiliation_snapshots` | `member_affiliation_snapshots` | **観測**された所属。開始日が不明でも保存できる。現任期22件。append-only |

- `affiliation_entries` を「スナップショット」と呼ばない。観測スナップショットは `affiliation_snapshots` だけ
- snapshot を履歴（ready な所属）に変換しない。観測日（`observed_on`、`*_observed_on`）や会派の結成日を `valid_from` に代用しない
- 初回 snapshot の `observed_on` は 2026-10-02（Phase 2A で正本の内容を確認した基準日。所属の開始日ではない）
- `party_group` が null は「公式資料で確定できない/記載がない」（null を「無会派」に変換しない）。「無会派」は公式資料が明記した場合だけ文字列で保持する
- 議員名簿が「無会派」と明記した3人（田村博孝・大浜雅史・大道夏代）の snapshot は、出典を議員名簿、`party_group_observed_on` を議員名簿の更新日（2026-09-30）としている（`affiliation_entries` の 2026-09-29 は会派名簿の時点で、値の出所が違うため）。
- snapshot の値は、既存の確定値（`affiliation_entries` と `sources` / `source_discrepancies`）をそのまま使う。このデータで現在の所属を再解釈・再収集しない
- snapshot は append-only。値が違う行が DB にあっても importer は UPDATE せずエラーにする。新しい観測は新しい `observed_on` の snapshot として追加する

## ルール

1. **人物は `member_id`（UUID）でのみ識別する。** 氏名による照合・補完・ID 生成をしない。importer は既存人物の氏名を「完全一致の安全確認」にだけ使い、一致しなければ中止する
2. **legacy 列（`members.party` / `party_group` / `election_count`）と `birth_date` は書かない。** 新人の生年は `birth_year_label`（証跡）としてのみ保持し、`birth_date` に変換しない
3. **所属履歴（`affiliation_entries`）は `effective_from` が一次資料で確定したものだけを `ready` にする。** 観測日（`*_observed_on`）や会派の結成日（`caucus_formed_on`）を `valid_from` に代用しない。確定できないものは `hold`（DB行にならない）
4. **source precedence**: 席・当選回数・政党は「議員名簿」、会派は「会派の構成」を優先する。公式間の矛盾は黙って補正せず `source_discrepancies` に記録する
5. **退任者を削除しない。** 新任期に残らない議員は新任期の `member_terms` を作らないだけ
6. **snapshot の日付はfail-closedで検証する。** `observed_on` が `member_term` の在職期間内かつ議会任期内であること、`party_observed_on` / `party_group_observed_on` が対象任期内かつ `observed_on` 以前であること、出典 id が `sources` に存在し URL が https であること（DB は cross-table の日付を検証しない）

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
