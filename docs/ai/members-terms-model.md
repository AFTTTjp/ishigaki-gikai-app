# 議員の任期・所属履歴モデル（members / council_terms / member_terms / member_affiliations）

石垣市議会の改選（2026-09 改選など）に対応するための基盤。Phase 1 ではスキーマのみ追加済みで、UI・データは未切り替え。

## テーブルの役割

| テーブル | 役割 |
|---|---|
| `members` | 人物マスター。`id` は任期をまたいで不変。退任議員も**削除しない** |
| `council_terms` | 議会任期（開始日・終了日） |
| `member_terms` | 議員 × 議会任期。同一人物が再選しても `members.id` は変えず、新しい行を作る |
| `member_affiliations` | 任期内の政党・会派の履歴（期間付き）。`valid_from`（所属の開始日）が一次資料で確定したときだけ使う。政党・会派のマスターは持たない |
| `member_affiliation_snapshots` | 「ある時点の資料ではこの所属だった」という観測値。所属の開始日が不明でも保存できる。append-only |
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

## member_affiliation_snapshots の使い方

- **スナップショットは所属の開始日を意味しない。** `observed_on`（記録の基準日）、`party_observed_on` / `party_group_observed_on`（各資料が示す基準日）を、`member_affiliations.valid_from` に流用しない
- **append-only**: 値を書き換えず、新しい観測は新しい `observed_on` の行を追加する。`service_role` には SELECT / INSERT しか付与していない（UPDATE / DELETE は権限エラー）。訂正も新しい行の追加で行う。`updated_at` があっても通常のUPDATEで現在値を書き換えない
- 「現在の所属」は、current な `member_term` の最新（`observed_on` が最大）のスナップショットを使う（取得ロジックは後続フェーズ）
- `party_group` が NULL は「公式資料で確定できない/記載がない」。「無会派」は公式資料が明記した場合にだけ文字列で保存する
- 開始日が一次資料で確定したら、`member_affiliations` に履歴行を作る（スナップショットは残す）
- **日付の整合はDBでは検証しない**（cross-tableの日付検証triggerは作らない）。取り込み側（`scripts/import-council-members-validation.mjs`、Phase 2A.2 で実装済み）が、次を fail-closed で検証する
  - `observed_on` が、その `member_term` の在職期間内（`start_date` 〜 実効終了日）であること
  - `observed_on` が、その議会任期（`council_terms`）の期間内であること
  - `party_observed_on` / `party_group_observed_on` が対象任期と矛盾しないこと
  - 出典URLが https であること（DBは空文字・空白だけを拒否するまで）
- 親の `member_terms` を削除するとスナップショットも消える（`ON DELETE CASCADE`）。退任者の `member_terms` を消さないこと

## 権限（Phase 1）

- 任期・所属系の新規テーブル（`council_terms` / `member_terms` / `member_affiliations` / `member_affiliation_snapshots`）は RLS 有効・policy なし。anon / authenticated には権限を付与しない。
- `service_role` のみ SELECT / INSERT / UPDATE / DELETE を明示 grant（`member_affiliation_snapshots` だけは append-only のため SELECT / INSERT のみ）。アクセスは `createAdminClient()` 経由。
- 既存の `members` / `member_links` の公開 read policy は変更していない。

## 議員一覧・詳細の mode（Phase 3）

`/members` と `/members/[id]` は、新モデルのデータが**完全に揃ったときだけ** current mode で表示し、揃っていなければ legacy mode（従来表示）を維持する。判定は `web/src/features/members/shared/utils/member-roster.ts`（純粋関数）、データ取得は `web/src/features/members/server/repositories/member-repository.ts`（server-only・admin client）。

| mode | 条件 | 一覧 | 政党・会派・当選回数の出所 |
|---|---|---|---|
| legacy | 下の gate を満たさない（Phase 3 deploy 直後の Production はこの状態） | `members.election_count` が非 NULL の人だけ（旧22人。**members 全件ではない**） | `members` の legacy 列（従来どおり） |
| current | 下の gate をすべて満たす | 在職中の議員（現任期の `member_terms`） | 当選回数 = `member_terms.election_count`、政党・会派 = 基準日以前の最新 `member_affiliation_snapshots`（**legacy 列は使わない**） |

**current mode の gate**（1つでも欠けたら legacy。partial な名簿を出さない）
1. 基準日（日本時間の今日）を含む `council_terms` がちょうど1件（0件は legacy、2件以上は**データ不整合としてエラー**）
2. 初回名簿（議会任期の開始日に就任した `member_terms`）が席 1..22 を過不足なく埋めている（欠員が出て在職者が21人になっても、初回名簿が揃っていれば current のまま）
3. 在職中の各議員に、当選回数（非 NULL）、`members` 行、基準日以前の最新 snapshot（`party` が非 NULL）がある。`party_group` の NULL は可（「会派不明」。「無会派」の文字列とは区別して表示する）
4. 同じ議員の `member_terms` が現任期に重複していない（重複はエラー）

- 基準日より後の `observed_on` の snapshot は現在値に使わない。同じ `member_term` に複数 snapshot があれば `observed_on` が最新のものを使う
- legacy が `election_count IS NOT NULL` で旧22人に限定できるのは、Phase 2A の importer が新人・歴史上の人物（砥板芳行）の `members` 行に `election_count` を書かないため。**`members.election_count` を後から誰かが書かないこと**（書くと legacy 一覧に混ざる）

**議員詳細**
- 名簿（current または legacy）に載っている議員は、その mode の値で表示
- current mode で名簿に載っていない議員は、`members` に存在し、`member_terms`（過去・終了済みを含む）で在任実績を確認できれば**前議員として表示**（404にしない。過去の採決などからのリンクを維持するため）。`members` 行だけで `member_terms` が無い人物は、前議員とは断定せず404前議員では legacy の政党・会派・当選回数を現在の情報として出さず、在任期間だけを `member_terms` と議会任期から表示する
- 存在しない ID は 404

**採決表示（Phase 4A）**: `bill_member_votes.member_term_id` を読み取り結果へ通し、採決一覧から legacy の `members.party / party_group` JOIN を外す。採決日を正本化するまでは、採決時点の所属を推測せず、氏名・採決時点の議席番号・賛否だけを表示する。既存票の `member_term_id` backfill と、snapshot / affiliation の as-of 表示は別フェーズで行う。

**Production import 前後の read-only 確認**（Production への書き込みなし。SQL は参照のみ）
- **deploy 前（必須）**: `select count(*) from members;` と `select count(*) from members where election_count is not null;` がどちらも 22 であること。legacy 一覧は `election_count` が NULL の行を除くため、`members` に `election_count` が NULL の行が混ざっていると、Phase 3 の deploy で一覧から消える（従来は members 全件だった）
- import 前: `select count(*) from members where election_count is not null;` が旧22人（22）であること。新人・歴史上の人物がまだ無いか、あっても `election_count` が NULL であること
- import 前: `select count(*) from council_terms;` が 0（未投入）なら legacy mode の想定。投入途中（partial）で legacy に戻った場合は、サーバーログに `[members] current roster is incomplete; using legacy roster: <理由>` が出る
- import 後: `/members` が新任期22人（新人4人を含み、退任者4人を含まない）になっていること。ならなければログの理由を確認する

## 次フェーズ

- 既存票の `member_term_id` は `pnpm db:member-votes:term-backfill:plan:prod` で Production read-only 計画し、unresolved を監査する。このコマンドはSELECTのみで、UPDATE / INSERT / DELETEを行わない
- 採決日の正本フィールドを決め、所属を「採決時点」で解決できるようにする
- 採決日の根拠がある場合だけ `member_affiliations` / `member_affiliation_snapshots` から as-of 所属を表示する
- 新任期の採決 import は `member_term_id` を必須にしてから行う
