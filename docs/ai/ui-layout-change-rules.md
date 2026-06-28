# UIレイアウト変更時の絶対ルール（再発防止）

会期ページ・Topicページなどの**UIレイアウトを変更するとき**、Codex / Claude Code が新規レイアウトや抽象を勝手に導入し、既存の正解レイアウトから外れる事故を防ぐための運用ルール。

> 背景: 過去に `PageWithChatLayout`（AI用の常時2カラムグリッド）と `pcLayout="inline"/"floating"` という新規抽象が導入され、会期ページ・Topicページの本文幅が AI パネルに削られて破綻した。現 main では `/bills/[id]`・`/kokkai/[slug]/bills`・`/topics/[slug]` が同じレイアウト思想に揃っている。**この状態を基準とし、勝手に逸脱しないこと。**

## 0. まず既存の正解ページを確認する（最優先）

UIレイアウトを変更する前に、**必ず既存の正解ページの実装を読む**。新しく「似たUIを設計する」のではなく、**既存の正解ページとの差分だけ直す**。

- **PCレイアウトの正解基準は `/bills/[id]`（議案詳細ページ）。**
  - 実装: `web/src/features/bills/server/components/bill-detail/bill-detail-layout.tsx`
  - AI連携: `web/src/features/bills/client/components/bill-detail/bill-detail-client.tsx`

## 1. 正解ページのレイアウト思想（これに合わせる）

`/bills/[id]` が体現している思想。会期・Topic もこれに揃える。

- **本文は content-first**（本文が主役。AIは補助）。
- **本文幅は `max-w-4xl`**。
- **セクション器は既存の `<Container>`**（`@/components/layouts/container`、中身は `max-w-4xl mx-auto px-4 sm:px-6 lg:px-8`）。新しいラッパーを手書きしない。
- **AI は既存 `ChatButton` / `ChatWindow` の既定挙動に任せる**。
  - 呼び出しは `<ChatButton .../>`（議案詳細）または `<PageChatClient .../>`（会期・Topic）を**props追加なし**で置くだけ。
  - PCでは右下に補助として表示され、モバイルでは下部導線になる。**この挙動はコンポーネント側が持つ。ページ側で配置を再設計しない。**
- **本文幅を AI のために削らない / 2カラム化しない。**

### 現状の一致状況（参考）

| ページ | 本文幅 | セクション器 | AI |
|---|---|---|---|
| `/bills/[id]`（基準） | `max-w-4xl` | `<Container>` | `ChatButton`（props追加なし＝既定挙動） |
| `/kokkai/[slug]/bills` | `max-w-4xl` | `<Container>` | `PageChatClient` → `ChatButton`（既定挙動） |
| `/topics/[slug]` | `max-w-4xl` | `<Container>` | `PageChatClient` → `ChatButton`（既定挙動） |

## 2. 禁止事項（やってはいけない）

以下は**作らない・追加しない・復活させない**。

- ❌ 新規レイアウト抽象を作る。
- ❌ 「将来のため」の汎用レイアウトを作る。
- ❌ `PageWithChatLayout`（またはそれに類する AI 同居用レイアウトコンポーネント）を作る。
- ❌ `ChatDesktopLayout` 型を作る。
- ❌ `pcLayout` props を追加する。
- ❌ `inline` / `floating` などの AI 配置モードを追加する。
- ❌ AI用の2カラム grid（`grid-cols-[...]` で本文＋AIを並べる等）を作る。
- ❌ AIボタンの場所を空けるために本文へ `padding-right` を入れる。
- ❌ AIの場所を確保するための placeholder（`aria-hidden` の空セル等）を入れる。
- ❌ 本文幅・余白・`Container` を既存ページと変える（独自の `max-w` 値を持ち込む）。

## 3. 会期 / Topic ページを触るときの手順

1. **まず `/bills/[id]` の実装を読み、対象ページと比較する。**
2. **差分だけ修正する**（レイアウト思想は基準ページに合わせる）。
3. 以下の既存改善は**維持する**（戻さない）:
   - Topic本文の改善
   - 「確認中」→「照合中」の文言
   - 「情報源を見る」
   - 内部ID・`web/src`・`SESSION_OVERVIEWS` などの非表示
   - suggested questions / AI質問機能そのもの
4. **DB / JSON / revalidate は一切触らない。**
5. `/bills/[id]` と**差分が必要な場合は、その理由を Review packet に明記する**（例: ヘッダー白帯の全幅表示など、ページ固有の正当な差分のみ許容）。

## 4. Review packet に必須の項目

UIレイアウト変更の完了報告には、最低限これらを含める。

- Original objective
- Changed files
- Diff stat（`git diff --stat`）
- 採用方針（なぜ基準ページに合わせたか／必要な差分とその理由）
- Verification commands and results
- Not changed（DB / JSON / revalidate / 既存改善が無傷であること）
- `DB reflection needed: no`（該当時）
- `Revalidation needed: no`（該当時）
- `JSON source updated: no`（該当時）
- Risks / review points

### 禁止語が実装側に増えていないことの確認（コマンド例）

```bash
# 実装側（web/src）に禁止抽象が存在しないこと
grep -rn "PageWithChatLayout\|ChatDesktopLayout\|pcLayout\|\"inline\"\|\"floating\"" web/src
# → 0件であること

# AI用の独自grid / placeholder / padding逃がしが会期・Topicに無いこと
grep -nE "grid-cols-\[|aria-hidden|pr-\[|pl-\[" \
  "web/src/app/(main)/kokkai/[slug]/bills/page.tsx" \
  "web/src/app/(main)/topics/[slug]/page.tsx"
# → AIレイアウト目的の該当が0件であること
```

## 5. 一言まとめ

> **「似たUIを新しく設計する」のではなく、「既存の正解ページ（`/bills/[id]`）との差分だけ直す」。**
