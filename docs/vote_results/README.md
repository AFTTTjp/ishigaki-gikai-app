# Vote result artifacts and `bills.result_date`

`bills.result_date` は、議案の採決・結果確定日を議案単位で保持する。

## Source policy

- 日付は一次資料で確認できた場合だけ保存する
- repository の reviewed vote-results artifact には、各行の official source reference を残す
- `needs_review=true` や `confidence != high` の行は import 対象にしない
- DBとの紐付けで fuzzy matching を使わない
- 対象会期は artifact の `session.slug` と完全一致
- 対象議案は DB の `bills.name` が
  `${bill_number} ${bill_name}`
  と完全一致し、かつ `document_type=bill` の行だけ
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

Production write は別PR・別承認とする。read-only planner PRのmergeだけでは
`bills.result_date` の既存データは変更しない。
