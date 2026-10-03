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
| `affiliation_snapshots` | **観測スナップショット。** 「`observed_on` 時点の資料ではこの所属だった」という記録で、所属の開始日ではない。`member_affiliation_snapshots` の行になる（初回の正本は現任期の22議員分で22行。将来の追加で増えてよい）。出典は root `sources` の id で参照し、import 時に URL へ解決する |
| `source_discrepancies` | 公式ページ間の矛盾（補正せず記録） |
| `holds` | 未確認事項（旧任期の所属履歴など）と、確認に必要な一次資料 |
| `production_import_gate` | `blocked` の間は Production への書き込みをスクリプトが拒否する。Phase 3 の本番互換確認後は `open` とし、実行時フラグによる確認を残す |

### 用語の整理

| 正本 JSON | DB | 意味 |
|---|---|---|
| `affiliation_entries` | `member_affiliations` | 有効期間つきの所属**履歴**。`valid_from` が一次資料で確定したものだけが DB 行になる（`ready`）。現時点は ready 0 / hold 22 で、DB 行は 0 件 |
| `affiliation_snapshots` | `member_affiliation_snapshots` | **観測**された所属。開始日が不明でも保存できる。初回の正本は22行（現任期の議員22人分）。append-only で、同じ議員に新しい `observed_on` の行を追加できる |

- `affiliation_entries` を「スナップショット」と呼ばない。観測スナップショットは `affiliation_snapshots` だけ
- snapshot を履歴（ready な所属）に変換しない。観測日（`observed_on`、`*_observed_on`）や会派の結成日を `valid_from` に代用しない
- 現任期の完全性は「snapshot の行数」ではなく「現任期の `member_terms` の議員22人全員が、少なくとも1件の snapshot を持つ（snapshot に登場する distinct な議員の集合が `member_terms` の集合と一致する）」で判定する。初回の正本は22行だが、将来は同じ議員に新しい `observed_on` の snapshot を追加（append）してよい（総行数は22を超えてよい。同一議員・同一 `observed_on` の重複は不可）
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

## Production import gate（open）

Phase 3 の UI 互換対応は Production へ deploy 済み。2026-10-03 に Production で以下を read-only 確認した。

- `members`: 22 件
- `members.election_count is not null`: 22 件
- `council_terms` / `member_terms` / `member_affiliations` / `member_affiliation_snapshots`: データ行 0 件
- Production の `/members`: legacy 22 人表示を維持

この確認を受け、正本 JSON の `production_import_gate.status` は `open` とする。

ただし gate が open でも Production 書き込みは自動では行わない。リモートへの実行には引き続き
`--execute --prod --confirm-ui-compat-deployed` が必要で、`--input` による別 JSON からの実行も拒否する。
Production 反映前には必ず read-only dry-run を行い、計画差分をレビューしてから明示承認を得る。
