# 全文字起こし活用アーキテクチャ設計メモ

> 目的: みらい議会における全文字起こしを、単なる補助資料ではなく、Topic / Bill / General Question / Committee / Session / Timeline / Search / AI Chat が共通して参照できる根拠レイヤーとして扱うための中核設計を定義する。
>
> この文書は設計メモであり、実装・DB migration・import・revalidation・deploy を含まない。review artifact と public source を分離し、推測補完や fuzzy matching を避けることを前提とする。

---

## 1. Purpose

みらい議会では、議案・一般質問・topic・会期レポートがそれぞれ個別に整備されてきた。一方で、今後は以下を同じ根拠構造の上に載せたい。

- Topic page
- Bill page
- General Question page
- Committee page
- Session page
- Timeline
- Search
- AI Chat

そのためには、「本文全文を持つ発言データ」と「議会内で起きた出来事」と「それをどう編集して見せるか」を分離して扱う必要がある。

本設計では、中核モデルを以下の4層に分ける。

- Speech: 発言ブロック
- Event: 議会で起きた出来事
- Evidence: 根拠参照
- Editorial: 編集結果

---

## 2. Why This Architecture Matters

### 2.1 いまの課題

現状のみらい議会は、公開 source of truth が複数に分かれている。

- 一般質問: `docs/general_questions/*.json`
- Topic: `docs/ishigaki_gikai_topics_dev_set/*.topic.json`
- 会期レポート / key points: `session-overviews.ts`
- 議案本文: DB `bill_contents`
- council actions: `docs/ishigaki_council_actions/*.council-action.json`

この構造でも個別ページは作れるが、以下の問題がある。

- 一般質問 item と Topic / Bill / Committee の横断リンクが弱い
- key point は TS 内の手動構造で再利用性が低い
- issue / story draft は review 用だが公開 source に接続していない
- AI がどの根拠を使っているかを stable に示しにくい

### 2.2 この設計で解決したいこと

このアーキテクチャが必要なのは、単に検索しやすくするためではない。

- 新聞より詳しく、でも市民にわかりやすく整理するため
- 全文字起こしを根拠として残し、あとから検証可能にするため
- Topic / Bill / Session / AI Chat が別々に推測しないようにするため
- review artifact と public source の責務を分け、公開前に人間レビューを挟むため

### 2.3 最重要原則

- 全文字起こしを根拠にする
- 推測で議会情報を補完しない
- JSON source of truth を崩さない
- fuzzy bill_name matching はしない
- AI は公開本文を自動確定しない
- review artifact と public source を分ける

---

## 3. Current Source-of-Truth Map

### 3.1 上流素材

- `local-transcriber` の `*_minutes.md`
  - 一般質問ごとの全文字起こし由来ファイル
  - `本文 / full_text` を含む
  - review 素材であり、みらい議会の public source ではない

### 3.2 review-first artifact

- `docs/general_questions_minutes/r8-dai4-teireikai.canonical.json`
  - `scripts/build-general-questions-canonical-from-minutes.mjs` が生成
  - question 単位 canonical
- `docs/general_questions_minutes/r8-dai4-teireikai.review-draft.{json,md}`
  - canonical の review 用 draft
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-graph-pilot.json`
  - Issue pilot
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-review-packet.{json,md}`
  - bill/topic/general question ref の review 用 packet
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-editorial-decisions.{json,md}`
  - 編集者判断の draft
- `docs/general_questions_minutes/r8-dai4-teireikai.issue-stories.json`
- `docs/general_questions_minutes/issue-stories/r8-dai4/*.md`
  - Issue story draft

これらは review 用であり、現時点では public source ではない。

### 3.3 現在の public source

- 一般質問:
  - `docs/general_questions/r8-dai4-teireikai.general-questions.json`
  - `scripts/import-general-questions.mjs` で DB 反映
- Topic:
  - `docs/ishigaki_gikai_topics_dev_set/*.topic.json`
  - `scripts/import-topics-json.mjs` で DB 反映
- Council actions:
  - `docs/ishigaki_council_actions/*.council-action.json`
  - `scripts/import-council-actions.mjs` で DB 反映
- Session key points / committees / report:
  - `web/src/features/diet-sessions/shared/data/session-overviews.ts`
  - TS source であり DB source ではない
- Bill 本文:
  - DB `bills` / `bill_contents`

### 3.4 現在の公開 UI との接続

- Topic page は DB `topics` / `topic_bills` / `topic_general_questions` / `topic_updates` を読む
- Bill page は DB `bills` / `bill_contents` を読む
- General Question page は DB `general_questions` / `general_question_items` を読む
- Session page は `session-overviews.ts` と DB / loader を併用する

つまり、review artifact から public UI へはまだ直接つながっていない。

---

## 4. Core Model Overview

### 4.1 Speech

Speech は「発言の最小ブロック」である。

- source は transcript / minutes
- 原文を保持する
- 話者や役割は確定値ではなく hint として持つ
- item / issue / topic / bill の根拠参照の最小単位になる

### 4.2 Event

Event は「議会で起きた出来事」である。

- 一般質問
- 議案提出
- 委員会付託
- 委員会審査
- 採決
- 請願
- 報告

Speech は発言そのもの、Event は議会プロセスの意味単位であり、両者は別物とする。

### 4.3 Evidence

Evidence は「何を根拠にその記述・関係・要約を作ったか」の参照単位である。

- speech block
- minutes section
- bill PDF / ordinance text
- agenda
- committee material
- council action JSON
- session editorial note

Evidence は public 本文そのものではなく、根拠参照のための構造である。

### 4.4 Editorial

Editorial は「人に読ませるために編集した結果」である。

- draft
- reviewed
- published
- normal
- hard
- citizen summary
- detailed summary

Editorial は根拠ではなく表示用成果物であり、Speech / Event / Evidence から生成される。

---

## 5. Speech Canonical v1

Speech Canonical v1 は、既存の question 単位 canonical より upstream の review-first artifact として定義する。

### 5.1 目的

- `*_minutes.md` の `本文 / full_text` を失わずに保持する
- item / issue / topic / bill に紐づく根拠 block を stable に参照できるようにする
- 話者確定や要約完成を目指さず、後段の review と構造化のための source にする

### 5.2 最小 schema 案

```ts
type SpeechCanonicalV1 = {
  schema_version: "speech-canonical/v1";
  diet_session_slug: string;
  question_slug: string;
  question_date: string;
  meeting_type: "general_question";
  member_name_raw: string;
  source_minutes_file: string;
  source_text_file?: string;
  full_text: string;

  speech_blocks: {
    evidence_id: string;          // 例: "{question_slug}#L24-L37"
    block_index: number;
    source_line_start: number;
    source_line_end: number;
    raw_text: string;
    normalized_text: string;
    speaker_hint?: string;
    speaker_role_hint?:
      | "questioner"
      | "executive"
      | "chair"
      | "procedural"
      | "unknown";
    speech_kind:
      | "question_intro"
      | "question_item"
      | "question_followup"
      | "answer"
      | "procedural"
      | "noise"
      | "unknown";
    item_number_candidate?: number;
    confidence: "high" | "medium" | "low";
    review_flags: string[];
  }[];

  item_candidates: {
    candidate_id: string;
    evidence_ids: string[];
    raw_anchor_text: string;
    source_line: number;
    item_number_candidate?: number;
    confidence: "high" | "medium" | "low";
    match_reason?: string;
    match_score?: number;
    unmatched_reason?: string;
  }[];

  review_flags: {
    hallucination_like: string[];
    short_fragments: string[];
    name_or_title_variants: string[];
    possible_asr_errors: string[];
    needs_human_review: string[];
  };
};
```

### 5.3 配置方針

review-first artifact として、既存 `docs/general_questions_minutes/` 配下に置くのが安全。

推奨:

- `docs/general_questions_minutes/speech-canonical/r8-dai4/{question-slug}.speech-canonical.json`

例:

- `docs/general_questions_minutes/speech-canonical/r8-dai4/ishigaki-r8-dai4-ippan-shiuezato-atsushi.speech-canonical.json`

---

## 6. Event Model

### 6.1 Event の定義

Event は、議会における出来事を意味単位で保持するモデルである。

Speech が「何が発言されたか」であるのに対し、Event は「何が起きたか」である。

### 6.2 最小 event type

Phase 1 では、以下を Event として定義する。

- `general_question`
- `bill_introduction`
- `committee_referral`
- `committee_discussion`
- `vote`
- `petition`
- `report`
- `procedural_announcement`

### 6.3 最小 schema 案

```ts
type EventV1 = {
  event_id: string;
  event_type:
    | "general_question"
    | "bill_introduction"
    | "committee_referral"
    | "committee_discussion"
    | "vote"
    | "petition"
    | "report"
    | "procedural_announcement";
  diet_session_slug: string;
  event_date?: string;
  title: string;
  status?: string;

  related_question_slug?: string;
  related_bill_numbers?: string[];
  related_committee_name?: string;
  related_topic_slugs?: string[];

  evidence_ids: string[];
  review_required: boolean;
  notes?: string[];
};
```

### 6.4 Event と既存構造の接続

- `general_question` event は既存 `general-questions.json` と結びやすい
- `bill_introduction` / `committee_referral` / `petition` / `report` は `session-overviews.ts` や議案資料と接続しやすい
- `committee_discussion` は将来拡張向け
- `vote` は最終本会議や議案結果との接続点になる

---

## 7. Evidence Model

### 7.1 Evidence の定義

Evidence は、任意の Event / Editorial / relationship が何を根拠としているかを示す参照単位である。

### 7.2 source type

最小の source type は以下を想定する。

- `speech_block`
- `minutes_section`
- `bill_document`
- `agenda`
- `committee_material`
- `council_action_json`
- `session_overview_note`

### 7.3 最小 schema 案

```ts
type EvidenceV1 = {
  evidence_id: string;
  source_type:
    | "speech_block"
    | "minutes_section"
    | "bill_document"
    | "agenda"
    | "committee_material"
    | "council_action_json"
    | "session_overview_note";
  source_ref: string;       // path / slug / bill number / logical id
  label?: string;
  excerpt?: string;
  source_line_start?: number;
  source_line_end?: number;
  page_ref?: string;
  note?: string;
};
```

### 7.4 Evidence ID 方針

speech block には stable な `evidence_id` を付与する。

例:

- `ishigaki-r8-dai4-ippan-shiuezato-atsushi#L24-L37`

この ID を使って、以下が共通の根拠を参照できるようにする。

- canonical item candidate
- issue evidence anchor
- topic draft note
- session key point draft
- AI Chat citation

### 7.5 fuzzy matching を避けるための原則

- bill は exact bill number / exact title source で結ぶ
- topic は既存 `topic_slug` または review 中の candidate として扱う
- Evidence 自体は「近いから採用」ではなく、参照元が明示できるものだけ使う

---

## 8. Editorial Model

### 8.1 Editorial の定義

Editorial は、人に見せるために編集されたテキストや関係整理である。

ここで重要なのは、Editorial を Speech / Event / Evidence と混ぜないこと。

- Speech は原文
- Event は出来事
- Evidence は根拠参照
- Editorial は説明・整理・公開本文

### 8.2 status

最小 status:

- `draft`
- `reviewed`
- `published`

### 8.3 audience / difficulty

Editorial は audience と difficulty を持てる。

- `citizen_summary`
- `detailed_summary`
- `normal`
- `hard`

### 8.4 最小 schema 案

```ts
type EditorialV1 = {
  editorial_id: string;
  target_type:
    | "issue"
    | "topic"
    | "bill"
    | "general_question"
    | "session_key_point"
    | "timeline_entry";
  target_id: string;
  status: "draft" | "reviewed" | "published";
  variant?: "citizen_summary" | "detailed_summary" | "normal" | "hard";
  summary_text: string;
  review_notes?: string[];
  evidence_ids: string[];
};
```

### 8.5 AI の位置づけ

AI は Editorial layer でのみ使う。

- 公開本文を自動確定しない
- `draft` を作る補助として使う
- `reviewed` / `published` は人間判断を前提とする
- 本文外の補完はしない

---

## 9. Promotion Rules

この設計では、review artifact と public source を明確に分ける。

### 9.1 基本の昇格順

```text
minutes / transcript
  ↓
Speech Canonical (review artifact)
  ↓
Event / Evidence / canonical item matching (review artifact)
  ↓
Issue / story / editorial draft (review artifact)
  ↓
public JSON / TS source
  ↓
DB import
  ↓
UI
```

### 9.2 review artifact → public JSON / TS source

review artifact から public source に昇格してよいのは、人間レビュー済みの確定情報だけ。

- 一般質問:
  - `docs/general_questions/*.json`
  - item / sub_item / topic_slugs を人間確認後に更新
- Topic:
  - `docs/ishigaki_gikai_topics_dev_set/*.topic.json`
  - related bill / narrative / updates を人間確認後に更新
- Session:
  - `session-overviews.ts`
  - key points / committee narrative を人間確認後に更新
- Council actions:
  - `docs/ishigaki_council_actions/*.council-action.json`

### 9.3 public JSON / TS source → DB

DB import は public source が更新された後のみ行う。

- `import-general-questions.mjs`
- `import-topics-json.mjs`
- `import-council-actions.mjs`

review artifact から直接 DB に入れる運用はしない。

### 9.4 DB → UI

現状の UI は DB または public TS/JSON source を読む。

- Topic page は DB topic relations
- Bill page は DB bills / bill_contents
- General Question page は DB general questions
- Session page は TS `session-overviews.ts` と DB loader

この構造を崩さず、review artifact は編集補助として扱う。

---

## 10. Minimal Pilot: `rito-koshien`

最初の pilot は `rito-koshien` を対象にするのが妥当。

### 10.1 理由

- 既存 topic `rito-koshien-r8-dai4` がある
- bill 候補 `議案第42号` がある
- 一般質問 item ref が複数ある
- issue story / editorial decision も既に存在する

### 10.2 最小対象

最低限の question source:

- 後上里厚司 `item 7 離島甲子園について`
- 長浜信夫 `item 3 離島甲子園大会出場について`

必要に応じて宮良操を追加するが、pilot は 2 question source で開始可能。

### 10.3 pilot で確認すべきこと

- `Speech Canonical v1` で item 近傍の speech block が安定して取れるか
- `evidence_id` を通じて raw transcript に戻れるか
- `general_question item -> issue -> topic / bill` の根拠接続が推測なしでできるか
- `review artifact -> public source` の境界が保てるか

---

## 11. Future Connection Points

### 11.1 Topic page

- Issue / Event / Evidence から confirmed な関連のみ Topic JSON に昇格
- Topic page は DB topic relations を読む
- 将来的には Topic draft の根拠として evidence_ids を editor 用に保持できる

### 11.2 Bill page

- bill number / bill id の exact relation を Event / Evidence 側に持てる
- bill content の normal / hard は Editorial layer の published から供給

### 11.3 General Question page

- 現状は DB `general_questions` / `general_question_items`
- 将来的に speech block ベースの editor review を別導線で持てる
- public page に直接 Speech Canonical を出す必要はない

### 11.4 Committee page

- 当面は bill 経由で committee context を導出
- 将来的に committee minutes が整備されれば `committee_discussion` event を拡張できる

### 11.5 Session page

- key points は将来 Issue / Event 由来に整理可能
- `relatedBills` / `relatedTopicSlugs` / `relatedGeneralQuestionItems` は Event / Editorial の published から供給できる

### 11.6 Timeline

- Event は timeline と最も相性がよい
- `bill_introduction`, `committee_referral`, `vote`, `report`, `council_action` を並べやすい

### 11.7 Search

- Search は Evidence / Speech block を index 元にしやすい
- ただし public search と editor search の境界は分けるべき

### 11.8 AI Chat

- AI Chat は Evidence ID を引用しながら回答する構造が望ましい
- 返答本文は Editorial ではなく retrieval + citation で出す方が安全
- public answer でも、speech block / bill / topic の根拠を示せる

---

## 12. Risks and Guardrails

### 12.1 主なリスク

- `*_minutes.md` の `流れ（自動見出し）` をそのまま source にすると noisy
- speaker の完全自動判定は難しい
- Event と Editorial を混ぜると「起きたこと」と「編集結果」が分離できない
- source of truth が増えると、どこを正本とするかが曖昧になりやすい
- fuzzy matching を入れると public 情報の信頼性が落ちる

### 12.2 guardrails

- Speech Canonical は必ず `本文 / full_text` 起点にする
- `speaker_hint` と `speaker_role_hint` は hint 扱いにする
- bill_name は exact match のみ
- review artifact から直接 DB に import しない
- AI draft は `draft` 止まりとし、`published` は人間が確定する
- public 本文は常に evidence を辿れること

---

## 13. Recommended Implementation Phases

### Phase 0: 仕様固定

- 本文書で用語と責務を固定する
- review artifact と public source の境界を明文化する

### Phase 1: Speech Canonical pilot

- `rito-koshien` の 2 question source だけで Speech Canonical v1 を試作
- 発言 block segmentation と `evidence_id` を確定する

### Phase 2: canonical / issue 接続

- 既存 `canonical.json` を Speech Canonical 起点に再設計する
- issue graph / issue story が `evidence_id` を参照できるようにする

### Phase 3: Editorial layer 整理

- issue story / topic draft / session key point draft を Editorial として整理する
- `draft / reviewed / published` の運用ルールを決める

### Phase 4: public source promotion

- 人間レビュー済みのものだけを `general_questions.json` / topic JSON / `session-overviews.ts` に昇格
- その後必要なら DB import

### Phase 5: UI / Search / AI Chat

- Topic / Bill / Session / Timeline / Search / AI Chat が共通 evidence を参照する構造へ拡張
- ただし public UI に直接 Speech Canonical を出すのは最後

---

## 結論

みらい議会の中核は、Speech 単体でも Issue 単体でもなく、以下の分離にある。

- Speech = 原文
- Event = 出来事
- Evidence = 根拠参照
- Editorial = 編集結果

この4層を分けることで、全文字起こしを失わずに、市民向けのわかりやすい説明と、検証可能な根拠構造を両立できる。

まずは `rito-koshien` を使って Speech Canonical v1 を pilot し、その後 Event / Evidence / Editorial に接続していくのが最も安全で、既存実装も壊しにくい。
