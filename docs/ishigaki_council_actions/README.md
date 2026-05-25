# 議会アクション（council_actions）運用メモ

## 目的

石垣市議会が実施した要請活動・申し入れ・意見書提出などの「議会アクション」を管理するデータ基盤。

議案（bill）に紐づく「議決後のアクション」として記録し、Topic 詳細ページのタイムラインや議案詳細ページの関連アクションセクションに表示することを想定している。

## JSON source of truth

`docs/ishigaki_council_actions/*.council-action.json` が正本。

- データは必ずこの JSON を編集してから import スクリプト経由で DB に反映する
- DB を直接編集して終わらせることは禁止（JSON との乖離が生じるため）
- スキーマ定義: `docs/ishigaki_council_actions/council-action.schema.json`

## 設計上の重要な決定

### council_action_topics テーブルは作らない

`council_actions` と `topics` を直接紐付けるテーブルは存在しない。  
Topic との関係は **bill → topic** の既存経路（`topic_bills`）を経由して辿る設計。

```
council_actions
  └─ council_action_bills（中間テーブル）
       └─ bills
            └─ topic_bills（中間テーブル）
                 └─ topics
```

直接紐付けを作ると、bill と topic の両方でアクションを管理することになり編集ミスが発生しやすい。

### bill_name の照合は完全一致のみ

`related_bill_names` に記載した文字列は `bills.name` カラムと **完全一致** で照合する。  
fuzzy matching（部分一致・類似度照合）は禁止。  
照合に失敗した bill は `unmatched` としてログ出力され、DB には書き込まれない。

## status の扱い

| status | 意味 |
|---|---|
| `draft` | 非公開。UI に表示されない。データ整備中や確認待ちの状態で使う |
| `published` | 公開。UI に表示される（RLS ポリシーで anon も SELECT 可） |

**UI 実装前はすべて `draft` で import して構わない。**  
公開するタイミングで `published` に変更して再 import する。

## import 手順

### 1. JSON を作成・編集する

`docs/ishigaki_council_actions/` に `*.council-action.json` を作成する。  
スキーマは `council-action.schema.json` を参照。

### 2. dry-run で事前確認する（推奨）

```bash
# ローカル Supabase に対して dry-run（書き込みなし）
npx dotenv-cli -e .env -- node scripts/import-council-actions.mjs --dry-run

# test Supabase に対して dry-run
npx dotenv-cli -e .env.test -- node scripts/import-council-actions.mjs --dry-run

# prod Supabase に対して dry-run（prod 反映前は必ず実行）
npx dotenv-cli -e .env.prod -- node scripts/import-council-actions.mjs --dry-run
```

dry-run では DB への書き込みは行わない。バリデーションと bill 照合結果のみ確認できる。

### 3. 本番 import を実行する

```bash
# ローカル Supabase
pnpm db:council-actions:import

# test Supabase（.env.test が必要）
pnpm db:council-actions:import:test

# prod Supabase（.env.prod が必要・ ⚠️ 取り消し困難）
pnpm db:council-actions:import:prod
```

### 4. 確認する

```sql
-- ローカル確認例
SELECT slug, status, kind, action_date FROM council_actions;
SELECT COUNT(*) FROM council_action_bills WHERE council_action_id = '<id>';
```

## 環境分離

| env ファイル | 接続先 | 用途 |
|---|---|---|
| `.env` | ローカル Supabase | 開発・検証 |
| `.env.test` | Supabase test プロジェクト | UI リリース前の staging 検証 |
| `.env.prod` | Supabase prod プロジェクト | 本番反映 |

- `.env.test` / `.env.prod` は **secrets** のため commit 禁止（`.gitignore` で除外済み）
- 作成方法は `.env.test.example` / `.env.prod.example` を参照

## DB reflection / Revalidation タイミング

| タイミング | DB reflection | Revalidation |
|---|---|---|
| データ整備中（draft） | local import のみ | 不要 |
| PR-2 UI 実装・test 確認前 | test import が必要 | 不要（UIが先） |
| UI が prod デプロイ済み・公開したい | prod import（status=published） | **必要** |

Revalidation は `REVALIDATE_SECRET` を使った API 呼び出しで実行する。  
UI 実装後、具体的な手順は `docs/ai/verification.md` の Tier B/C を参照。
