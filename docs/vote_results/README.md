# Vote result artifacts and `bills.result_date`

`bills.result_date` は、議案の採決・結果確定日を議案単位で保持する。

## Source policy

- 日付は一次資料で確認できた場合だけ保存する
- repository の reviewed vote-results artifact には、各行の official source reference を残す
- `needs_review=true` や `confidence != high` の行は import 対象にしない
- DBとの紐付けで fuzzy matching を使わない
- 対象会期は artifact の `session.slug` と完全一致
- 対象議案は `document_type=bill` に限定し、原則として DB の `bills.name` が `${bill_number} ${bill_name}` と完全一致する行だけ
- 公式HTMLの半角角括弧 `[]` と既存DBの全角角括弧 `［］` の差だけは、両側を半角角括弧へ限定正規化した後に完全一致を要求する
- 空白・丸括弧・語句・表記ゆれ等は正規化しない
- 既存の `result_date` が artifact と異なる場合は上書きせず停止する
- artifact の日付が会期外なら停止する

## Production read-only plan

```bash
pnpm db:bill-result-dates:plan:prod
```

既定入力:

```text
docs/vote_results/r8-dai4-teireikai.vote-results.review.json
```

このコマンドは SELECT のみで、UPDATE / INSERT / DELETE を行わない。

出力:

- update候補
- alreadySet
- unresolved
- unresolved理由

`unresolved=0` を人間が確認するまでは Production write を行わない。

## Write phase

Production write は別PR・別承認とする。実行時には read-only plan を再計算し、
以下をすべて満たさなければ書き込みを開始しない。

- Production Supabase host が `sjjesaheibvpteoytbpy.supabase.co`
- reviewed total = 17
- reviewed session = `ishigaki-r8-dai4-teireikai`
- reviewed result_date = `2026-06-24`
- artifact bills = 17
- unresolved = 0
- updates + alreadySet = 17
- match_mode は `exact` または `exact_after_bracket_width_normalization` のみ

対象行は plan で確定した `bill_id` / `bill_name` / `document_type=bill` が一致し、
かつ `result_date IS NULL` の行だけを1件ずつ更新する。既存の非NULL値は上書きしない。

実行コマンド:

```bash
pnpm db:bill-result-dates:execute:prod -- \
  --execute \
  --prod \
  --confirm-reviewed-plan \
  --expected-total 17 \
  --expected-session ishigaki-r8-dai4-teireikai \
  --expected-result-date 2026-06-24
```

事後に同じartifactとDBを再読込し、次を要求する。

- updates = 0
- alreadySet = 17
- unresolved = 0

executor PRのmergeだけでは `bills.result_date` の既存データは変更しない。
