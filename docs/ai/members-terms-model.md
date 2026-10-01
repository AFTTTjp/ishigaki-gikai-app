# 議員の任期・所属履歴モデル（members / council_terms / member_terms / member_affiliations）

石垣市議会の改選（2026-09 改選など）に対応するための基盤。Phase 1 ではスキーマのみ追加済みで、UI・データは未切り替え。

## テーブルの役割

| テーブル | 役割 |
|---|---|
| `members` | 人物マスター。`id` は任期をまたいで不変。退任議員も**削除しない** |
| `council_terms` | 議会任期（開始日・終了日） |
| `member_terms` | 議員 × 議会任期。同一人物が再選しても `members.id` は変えず、新しい行を作る |
| `member_affiliations` | 任期内の政党・会派の履歴（期間付き）。政党・会派のマスターは持たない |
| `bill_member_votes.member_term_id` | 採決時点の議員任期。NULL は従来どおり有効 |

## 守るべきルール

1. **`members.party` / `party_group` / `election_count` は legacy snapshot。改選後も更新しない。**
   - 再選議員の値を上書きすると、過去の採決表示（`bill_member_votes` と members の JOIN）が現在の所属に変わってしまう。
   - 新しい所属は `member_affiliations`、新しい当選回数は `member_terms.election_count` に記録する。
   - 列の削除は、全ての読み手（名簿・詳細・チャット・採決表示）を新モデルへ移行した後の別PRで行う。
2. **退任議員を `members` から削除しない。** `member_terms` / `bill_member_votes` / `bills.proposer_member_id` / `general_questions.member_id` から参照されている。
3. **`bill_member_votes.(member_term_id, member_id)` は `member_terms.(id, member_id)` への複合FK。** 票の議員と任期の議員が別人になる組み合わせはDBが拒否する。
4. **名前による照合（fuzzy matching）で ID を決めない。** member / member_term の紐づけは ID でのみ行う。
5. **期間のoverlapはDB制約にしていない**（extension が必要になるため）。任期・所属の投入時に validation する。
   期間判定は `web/src/features/members/shared/utils/term-period.ts`（開始日・終了日を含む、`end = null` は継続中）。

## 権限（Phase 1）

- 新規3テーブルは RLS 有効・policy なし。anon / authenticated には権限を付与しない。
- `service_role` のみ SELECT / INSERT / UPDATE / DELETE を明示 grant。アクセスは `createAdminClient()` 経由。
- 既存の `members` / `member_links` の公開 read policy は変更していない。

## 次フェーズ（未実施）

- 2022-2026 任期の backfill（`member_terms` / `member_affiliations` / 既存票の `member_term_id`）
- 2026-2030 任期データの投入
- 名簿・採決表示の新モデルへの切り替え（**2026-2030 の `member_terms` 投入前に名簿を切り替えると一覧が空になる**）
