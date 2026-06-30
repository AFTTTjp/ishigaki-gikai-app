# 文字起こし由来データの公開ゲート（Transcript Publish Gate）

YouTube議会動画の文字起こし由来データ（speech-canonical / issue-graph / event-graph / timeline-review / issue-stories など）を**市民向けUIに出してよい条件**を定めた運用ルール。

> 背景: 文字起こし pipeline（minutes → speech-canonical → issue/event-graph → timeline-review / issue-stories）は review-first の artifact 群であり、そのまま public 表示すると未確定・推測・内部IDが市民に漏れる。`rito-koshien` の `TopicTimelineReview` は、サニタイズ component 経由で**確定済み・根拠接続済みの timeline-review/v1 だけ**を出す正解パターン。全体設計は [docs/architecture/transcript-event-evidence-editorial-architecture.md](../architecture/transcript-event-evidence-editorial-architecture.md) を参照。

## 0. 一言原則

> **「出せるものから出す」ではなく、「`confirmed` と `evidence` が揃ったものだけ出す」。**

## 1. 公開してよい必須条件（すべて満たすこと）

文字起こし由来データを Topic / 会期 / 一般質問などの**公開ページに出す**には、以下を**全部**満たすこと。1つでも欠ければ**出さない**。

1. **`confirmed` があること** — 公開する timeline / event の重要項目が `status: "confirmed"`。**全項目が `candidate` のものは公開不可**。
2. **`evidence_id` が接続されていること** — 各項目に stable な `evidence_id`（speech block 由来）が紐づき、「情報源を見る」が**実際の一次根拠（発言）を指す**こと。`evidence_ids: []` のままは不可。
3. **event-graph 止まりでは出さないこと** — `event-graph/v1-review` は中間 artifact。公開には次段の **`timeline-review/v1` まで生成済み**であること。
4. **`timeline-review/v1` 形式まで生成済みであること** — `build-topic-timeline-review.mjs` で `timeline-review/v1` を生成し、`schema === "timeline-review/v1"` を満たす。
5. **review artifact をそのまま public に出さないこと** — `docs/general_questions_minutes/**` の review 原本を直接 UI から読まない。公開には **runtime-safe な fixture コピー**を `web/src/.../fixtures/` 配下に置き、それを読む。
6. **raw の review フィールドを表示しないこと** — `candidate` / `review_required` / `evidence_id` / `source_locator` / `generated_at`（および `full_text` / raw transcript / 内部ID / 絶対パス）を**そのまま市民に出さない**。
7. **サニタイズ component 経由で出すこと** — 既存の `TopicTimelineReview` のような、review フィールドを安全に変換する component を通す。新規の生表示パスを作らない。

## 2. サニタイズの基準（TopicTimelineReview の正解例）

review フィールドは「消す」のではなく、component で**安全な形に変換**して出す。

| review フィールド | 市民向けの扱い |
|---|---|
| `status: "candidate"` | ラベル **「照合中」** に変換（enum 値を raw 表示しない） |
| `status: "confirmed"` | 確定として表示（チェック等。raw enum は出さない） |
| `evidence_id` / `source_locator` | raw 非表示。**「情報源を見る」** リンク化（実根拠を指す場合のみ） |
| `review_required` | **boolean gate としてのみ**使用（「この表示について」の curated note を出す。raw な review メモは出さない） |
| `generated_at` / 内部ID / 絶対パス / `full_text` | **一切出さない** |

`candidate` を「照合中」に変換、`review_required` を gate にのみ使う、`evidence_id` を「情報源を見る」にするのは**許容**。raw のまま出すのは**禁止**。

## 3. fuzzy matching 禁止

- bill は **exact bill number / exact title** でのみ結ぶ。
- topic は **既存 `topic_slug`**、または review 中の candidate として扱う。
- 「近いから採用」で議案・Topic・一般質問をつながない。推測で議会内容を補完しない。

## 4. 公開までの標準フロー

```text
raw minutes (../local-transcriber, repo外)
  → speech-canonical（evidence_id 付与）      [review]
  → issue-graph / event-graph                 [review]
  → 人間レビューで candidate → confirmed       [review]
  → timeline-review/v1 生成                    [review]
  → runtime-safe fixture へコピー（web/src）   [public 化]
  → サニタイズ component で表示 + revalidate   [public]
```

review artifact から直接 DB / public JSON / UI に入れない。`reviewed` / `confirmed` は**人間が確定**する（AI は draft 止まり）。

## 5. チェックリスト（公開PR時）

- [ ] 公開対象の timeline_item に `confirmed` がある（全 candidate でない）
- [ ] それらに `evidence_id` が接続され「情報源を見る」が実根拠を指す
- [ ] `timeline-review/v1` 形式で生成済み（event-graph 止まりでない）
- [ ] `review_required` の根幹リスクが解消 or 明示的に対象外と確定済み
- [ ] fixture は runtime-safe copy で、サニタイズ component 経由でのみ表示
- [ ] `candidate` / `review_required` / `evidence_id` / `source_locator` / `generated_at` / `full_text` が raw 表示されない
- [ ] 表示が変わるため revalidate（例: `topics` タグ）を Review Packet に明記

## 6. 一言まとめ

> 文字起こしの価値は「全部見せる」ことではなく、**「確定した出来事を、根拠付きで、わかりやすく見せる」**こと。`confirmed` と `evidence` が揃うまで public には出さない。
