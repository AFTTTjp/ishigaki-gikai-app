# Topics 運用メモ

- Topic 内容の正本は `docs/ishigaki_gikai_topics_dev_set/*.topic.json` を想定します。
- `topic.schema.json` は Topic JSON の共通フォーマットを定義するためのスキーマです。
- `scripts/import-topics-json.mjs` は JSON 正本を `topics` / `topic_updates` / `topic_bills` に反映する import レイヤーです。
- `topic_bill_candidates.bill_name` は `bills.name` と完全一致で照合します。fuzzy matching は使いません。
- `db:topics:import:test` と `db:topics:import:prod` で test / prod Supabase を分離して使います。
- この変更では DB反映・migration実行・revalidate実行は行いません。実行は次フェーズで扱います。

---

## ⚠️ import スクリプトの destructive 動作（必読）

`scripts/import-topics-json.mjs` は **JSON にない関連を破棄する** 動作を含みます。「ちょっと import を流す」では済まないため、prod に対しては特に注意してください。

### 各テーブルの書き込み方式

| テーブル | 方式 | スコープ | 該当行 |
|---|---|---|---|
| `topics` | **UPSERT**（`onConflict: slug`） | slug 単位で更新 | `import-topics-json.mjs` line 279-283 |
| `topic_updates` | **DELETE → INSERT**（destructive replace） | `topic_id` 単位 | line 309-324 |
| `topic_bills` | **DELETE → INSERT**（destructive replace） | `topic_id` 単位 | line 343-358 |

つまり、対象 topic について JSON に書かれていない `topic_updates` / `topic_bills` の関連は **import 実行と同時に削除されます**。

> ※ 同じパターンは `scripts/import-council-actions.mjs` の `council_action_bills` にもあります（line 249-266）。council_action 単位で全削除→再挿入。

### destructive 動作の影響範囲

- ✅ 影響を受けない: 別の topic（slug が違うレコード）の `topic_bills` / `topic_updates`
- ⚠️ 影響を受ける: 対象 topic に紐付く既存の関連（DB 側で手作業や別マイグレーションで追加していたものは消える）

### prod import 前の必須チェックリスト

prod に対して `pnpm db:topics:import:prod` を実行する前に、以下を **すべて** 確認してください。

- [ ] **dry-run を実行した**（書き込みなし。validation / unmatched / 件数を表示）
  ```bash
  npx dotenv-cli -e .env.prod -- node scripts/import-topics-json.mjs --dry-run
  ```
- [ ] **unmatched ゼロ**（`related_bill_names` / `bill_name` の typo は本実行で sliently insert スキップになる）
- [ ] **既存 `topic_bills` / `topic_updates` 件数を確認した**（destructive replace で消える分がないか）
  ```bash
  npx dotenv-cli -e .env.prod -- node -e "
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  (async () => {
    const { data: t } = await sb.from('topics').select('id, slug').eq('slug','<対象 slug>').single();
    if (!t) { console.log('topic not found'); return; }
    const { count: bc } = await sb.from('topic_bills').select('*', { count: 'exact', head: true }).eq('topic_id', t.id);
    const { count: uc } = await sb.from('topic_updates').select('*', { count: 'exact', head: true }).eq('topic_id', t.id);
    console.log('existing topic_bills:', bc, ' / topic_updates:', uc);
  })();
  "
  ```
- [ ] **JSON に記載した想定 insert 件数と一致する**（既存件数 == JSON 件数 が理想。減る場合は意図通りか確認）
- [ ] **commit 済みの JSON を import している**（未保存ファイル / 別 worktree の JSON を間違って読み込んでいないか）

### local で Topic 詳細を確認する場合

local Supabase の `topic_bills` が空だと、Topic 詳細ページの「議会のアクション」セクションが表示されません。確認のため `pnpm db:topics:import` で JSON を local DB に流してください。

```bash
# local 反映（.env が local Supabase を指していることを確認してから）
npx dotenv-cli -e .env -- node scripts/import-topics-json.mjs --dry-run
pnpm db:topics:import
```

local では destructive replace のリスクが低い（試験データの再投入は容易）ため通常運用で問題ありません。

### prod では絶対にやらない運用

- ❌ JSON を編集せずに「キャッシュ更新目的」で `pnpm db:topics:import:prod` を流す（既存 `topic_bills` / `topic_updates` を一旦消して再挿入する分、瞬間的に空になるタイミングがある）
- ❌ dry-run せずに本実行する
- ❌ unmatched が出ているのに無視して本実行する
- ❌ `.env` と `.env.prod` を取り違える（運用は必ず `dotenv-cli -e .env.prod` または `pnpm db:topics:import:prod` を経由）

### rollback 方針

DB を直接修正せず、JSON を修正して再 import で上書きしてください。JSON が source of truth なので、JSON 状態に DB を揃え直すのが正しい復旧手順です。
