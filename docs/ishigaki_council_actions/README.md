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

Revalidation は `REVALIDATE_SECRET` を使った API 呼び出しで実行する（`Authorization: Bearer` ヘッダ + `tags` 配列の body）。  
具体的なコマンド例はワークフロー A の Step 8 を参照。  
UI 実装後、追加の確認手順は `docs/ai/verification.md` の Tier B/C を参照。

---

## 公開ワークフロー

council_action を新規追加・または draft → published に変更して prod UI に反映するまでの安全な手順。

### 原則

- **JSON が source of truth**。DB を直接 UPDATE して公開しない
- **dry-run 必須**。prod import の前に必ず dry-run で確認する
- **環境を混同しない**。`.env` / `.env.test` / `.env.prod` を明示してコマンドを実行する
- **secrets は書かない**。コマンド例に実 URL・API key を記載しない
- **fuzzy matching 禁止**。`related_bill_names` は `bills.name` と完全一致のみ

---

### ワークフロー A: 新規 council_action を追加して公開する

#### Step 1 — JSON ファイルを作成する

```bash
# ファイル名: {slug}.council-action.json
# 配置場所: docs/ishigaki_council_actions/
```

- `slug` はケバブケース・英数字のみ（例: `ishigaki-old-city-hall-inspection-2026`）
- `status` は最初 `"draft"` にする
- `related_bill_names` は `bills.name` の **完全一致** 文字列を記載する
- スキーマは `council-action.schema.json` を参照

チェックリスト:
- [ ] `slug` がケバブケース・英数字のみ
- [ ] `kind` が enum に含まれる値（`advocacy` / `request` / `inspection` / `submission` / `resolution_delivery`）
- [ ] `action_date` が `YYYY-MM-DD` 形式
- [ ] `related_bill_names` の文字列が DB の `bills.name` と完全一致することを確認（Supabase Studio または psql で SELECT）
- [ ] `status: "draft"` で作成

#### Step 2 — local で dry-run する

```bash
npx dotenv-cli -e .env -- node scripts/import-council-actions.mjs --dry-run
```

確認ポイント:
- [ ] バリデーションエラーがないこと
- [ ] `unmatched` に `related_bill_names` の名称が出ていないこと（bill 照合成功）
- [ ] 追加予定の slug が `insert` または `upsert` として表示されること

#### Step 3 — local に import する

```bash
pnpm db:council-actions:import
```

- [ ] エラーなく完了すること
- [ ] `SELECT slug, status FROM council_actions;` で `draft` で登録されていること

#### Step 4 — JSON の status を `published` に変更する

```json
{
  "status": "published"
}
```

- [ ] JSON ファイルを保存したこと

#### Step 5 — local に再 import する（公開状態で検証）

```bash
pnpm db:council-actions:import
```

- [ ] local の dev server（`pnpm dev`）でトピック詳細・議案詳細に「議会のアクション」セクションが表示されること
- [ ] kind バッジ・日付・タイトル・宛先・説明が正しいこと
- [ ] `status=draft` の別アクションは表示されないこと

#### Step 6 — test 環境で dry-run → import → 確認する

```bash
# dry-run
npx dotenv-cli -e .env.test -- node scripts/import-council-actions.mjs --dry-run

# 問題なければ import
pnpm db:council-actions:import:test
```

- [ ] dry-run でエラー・unmatched がないこと
- [ ] import 完了後、Supabase test Studio で `status=published` を確認

#### Step 7 — prod に dry-run → import する ⚠️

```bash
# dry-run（必須）
npx dotenv-cli -e .env.prod -- node scripts/import-council-actions.mjs --dry-run

# 内容確認後に本 import
pnpm db:council-actions:import:prod
```

- [ ] dry-run のログを必ず読んでから import を実行する
- [ ] `unmatched` がゼロであること（bill 照合漏れがないこと）
- [ ] import 完了後、Supabase prod Studio で `status=published` を確認

#### Step 8 — revalidation を実行する

prod にデータが入ったら ISR キャッシュを破棄する。

**API 仕様**（`web/src/app/api/revalidate/route.ts`）:
- 認証: HTTP ヘッダ `Authorization: Bearer <REVALIDATE_SECRET>`
- body: `{"tags": ["<tag1>", "<tag2>", ...]}`（複数形・配列、1リクエストで複数タグ同時可）
- 成功時: `200 OK` で `{"success": true, "revalidated": true, "tags": [...]}` を返す

```bash
# council-actions / topics / bills を 1 リクエストで一括破棄
curl -X POST https://<prod-url>/api/revalidate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <REVALIDATE_SECRET>" \
  -d '{"tags": ["council-actions", "topics", "bills"]}'
```

または `.env.prod` から値を読み込んで実行:

```bash
npx dotenv-cli -e .env.prod -- node -e '
let base = process.env.PROD_WEB_URL.trim();
if (!/^https?:\/\//.test(base)) base = "https://" + base;
fetch(base + "/api/revalidate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + process.env.REVALIDATE_SECRET,
  },
  body: JSON.stringify({ tags: ["council-actions", "topics", "bills"] }),
}).then(async (r) => console.log(r.status, await r.text()));
'
```

- [ ] レスポンスが `200 OK` で `revalidated: true` を含むこと
- [ ] レスポンス body の `tags` 配列に渡したタグが全て含まれていること
- `<prod-url>` と `<REVALIDATE_SECRET>` は `.env.prod` に設定した値を使う（secrets はチャット・PR 本文・コミットメッセージに貼らない）

> **注**: 旧 API 仕様（`{"tag": "...", "secret": "..."}` を body に入れる方式）は廃止されている。`secret` を body に入れたり `tag` を単数で送ると **401 Unauthorized** を返す。

> **対象タグの選び方**: council_action 公開時は最低限 `council-actions` + `bills` を含める。Topic 詳細にも表示される（= `topic_bills` 経由で紐付く）場合のみ `topics` も追加する。

#### Step 9 — prod UI で表示を確認する

- [ ] `/topics/<slug>` の「議会のアクション」セクションにアクションが表示されること（トピックが紐づいている場合）
- [ ] `/bills/<id>` の「議会のアクション」セクションにアクションが表示されること（議案が紐づいている場合）
- [ ] kind バッジ・日付・タイトル・宛先・説明・リンクが正しいこと
- [ ] 0件の議案・トピックではセクションが非表示であること

#### Step 10 — JSON を commit して PR を作成する

```bash
git add docs/ishigaki_council_actions/<slug>.council-action.json
git commit -m "content: <アクション名> を追加"
```

- [ ] secrets（実 URL・service role key 等）が JSON に含まれていないこと
- [ ] `status: "published"` の状態で commit すること（prod の状態と一致）

---

### ワークフロー B: 既存 council_action を draft → published に変更する

既に DB に `draft` で入っているアクションを公開する場合。

#### Step 1 — JSON の status を変更する

```json
- "status": "draft"
+ "status": "published"
```

#### Step 2 — local dry-run → import → 確認

```bash
npx dotenv-cli -e .env -- node scripts/import-council-actions.mjs --dry-run
pnpm db:council-actions:import
```

- [ ] local dev server で表示されること

#### Step 3 — prod dry-run → import → revalidation

```bash
# dry-run
npx dotenv-cli -e .env.prod -- node scripts/import-council-actions.mjs --dry-run

# import
pnpm db:council-actions:import:prod

# revalidation（council-actions / topics / bills の 3 tag）
# → ワークフロー A Step 8 と同じコマンド
```

- [ ] prod UI に表示されること
- [ ] JSON を commit（`status: "published"` 状態で）

---

### rollback 方針

| 状況 | 対応 |
|---|---|
| JSON の内容が間違っていた | JSON を修正 → 各環境に再 import → revalidation |
| 公開を取り消したい（draft に戻す） | JSON の `status` を `"draft"` に変更 → 各環境に再 import → revalidation |
| bill 照合が間違っていた | `related_bill_names` を修正 → 再 import → revalidation |
| import スクリプトのバグで DB がおかしくなった | JSON が source of truth なので JSON を基準に再 import で上書きできる |

**DB を直接 UPDATE して修正することは禁止。** 必ず JSON を修正して import し直す。

---

### よくある失敗パターン

| 失敗 | 原因 | 対策 |
|---|---|---|
| `unmatched` に bill 名が出る | `related_bill_names` の文字列が `bills.name` と微妙に違う | Supabase Studio で `bills.name` をコピーして完全一致させる |
| UI に表示されない（prod） | revalidation を忘れた / キャッシュが残っている | `council-actions` + `topics` + `bills` の 3 tag を revalidate する |
| test 環境のデータが prod に入ってしまった | `.env.test` を使うべきところで `.env.prod` を使った | コマンド実行前に env ファイルのパスを必ず確認する |
| `status: "draft"` のまま公開した | JSON の status を変え忘れた | dry-run ログで status を必ず確認する |
