# 論点グラフ（Issue Graph）設計メモ — 令和8年第4回定例会 pilot

> **目的**：議員別・議案別・topic別ではなく、「今会期で何が話し合われたか」を**論点（Issue）単位**でつなぐ中心構造を設計する。一般質問・議案・委員会・既存 topic・会期レポートを横断できるようにする。
> **この段階では実装しない**（DB/migration/import/revalidate/deploy・public JSON 変更・public UI 反映なし）。確定/候補/未確認を分け、anchor を残し、本文外の補完・fuzzy matching はしない。
> 関連ドラフト：`docs/general_questions_minutes/r8-dai4-teireikai.session-editorial-map.{md,json}`（会期編集台本）、`…issue-graph-pilot.json`（本メモの pilot 実体）。

---

## 1. 現行構造の限界（topic / bill / general_question / session-overview の分断）

| エンティティ | 何を持つか | 何にリンクするか | 限界 |
|---|---|---|---|
| **topic**（`docs/ishigaki_gikai_topics_dev_set/*.topic.json` / 本番は DB topics） | topic_slug・title・status・category・**content / content_hard**・current_status・**topic_bill_candidates[]**（bill_number・related_level・adoption_status・**matching_confidence**・is_primary）・topic_updates[] | bill（候補・confidence付き）。**general_question_item へのリンクは無い** | 1 topic＝1つの物語の縦の追跡。会期横断の「論点の地図」にはならない。一般質問との接続が構造化されていない。dev は docs JSON・本番は DB と二重 |
| **bill**（DB `bills` / `bill_contents` normal/hard） | publish_status・diet_session・normal/hard 本文 | diet_session。委員会は **`session-overviews.ts` の committees[]（別の場所）** | topic・general_question への構造的リンクが無い。編集 keyPoint 経由でしか論点に繋がらない |
| **general_question**（`…general-questions.json`） | 質問単位＋**items[]/sub_items[]**（item_number・title）・question単位 `topic_slugs` | question単位 topic_slugs のみ | **item 単位の topic/bill リンクが無い**。21問がバラバラで、会期の論点像にならない |
| **session-overview / keyPoint**（`session-overviews.ts`） | citizen-question 風 title・oneLine・easy/detailed・status・committee・**relatedBills[]（表示用文字列）**・**relatedTopicSlugs[]**・**relatedGeneralQuestionItems[]（item ref）** | bill（表示文字列）・topic_slug・**general_question_item（`{questionSlug,itemNumber,subItemIndex?}`）** | **最も Issue に近い** が、(a) TS コード内データで量産しづらい (b) 7件のみ (c) relatedBills が構造化リンクでなく表示文字列 (d) 会期再利用・横断検索に不向き (e) 「論点」という第一級概念が無い |

**分断の核心**：
- **横断ハブ（論点ノード）が不在**。keyPoint が代用しているが、**手動・少数・コード埋め込み・片方向**で、`GeneralQuestionItem ↔ Bill ↔ Topic ↔ Committee` を結ぶ中心が無い。
- リンクが**場所ごとにバラバラ**（bill↔committee は session-overviews、question↔topic は general-questions、topic↔bill は topic JSON、keyPoint↔全部は TS）。「この論点に関わる質問・議案・委員会・topic」を1か所で引けない。
- **既存 keyPoint は会期 overview の一部**であり、論点を独立に持ち回す（topic 化・記事化・横断）導線がない。

---

## 2. Issue エンティティ案

```jsonc
{
  "issue_id": "issue-r8d4-keelung-route",     // 安定ID。会期接尾辞 or 永続ID は §5 で議論
  "diet_session_slug": "ishigaki-r8-dai4-teireikai",
  "title": "台湾・基隆定期航路と八重山丸（やいま丸）",
  "citizen_question": "台湾・基隆を結ぶ定期航路は、採算や運賃も含めて続けられるの？",  // 市民目線の問い（keyPoint title 相当）
  "summary": "…",        // 見出し範囲の保守記述（答弁内容・数値は書かない）
  "summary_hard": null,  // 将来。確定後に生成（本文外補完しない）
  "category": "交通・産業・国際交流",
  "status": "審査・一般質問あり（会期中）",      // 会期スナップショット
  "evidence_anchors": [                          // anchor は必ず残す
    {"questionSlug":"…","member":"…","raw_anchor_texts":["…"],"note":"question-level・ASR由来・要校正"}
  ],
  "related_general_question_items": [            // KeyPointQuestionItemRef 互換
    {"questionSlug":"…","itemNumber":1,"member":"…","item_title":"…","resolved":true,"question_topic_slugs_source":[]}
  ],
  "related_bills":   [{"bill_number":"議案第45号","status":"candidate","note":"…"}],   // candidate / confirmed
  "related_topics":  [{"topic_slug":"…","status":"confirmed_at_source|candidate|new","note":"…"}],
  "related_committees": [{"name":"経済民生委員会","via_bill":"議案第45号","status":"candidate"}],
  "related_session_overview": {"keyPoint_candidate": true, "note":"keyPoint へ昇格候補。本Issueが relatedBills/relatedTopicSlugs/relatedGeneralQuestionItems を供給"},
  "review_required": ["related_bills は candidate","related_topics の candidate は未確定","anchor は要校正"]
}
```

- **status 値の取り決め**：`bill.status` = `candidate`（候補・未確定）/`confirmed`（編集者確定）。`topic.status` = `confirmed_at_source`（source の `topic_slugs` に既設定）/`candidate`（候補）/`new`（新規 topic 化・未確定）。**自動確定はしない**。
- **gq_ref** は既存の `KeyPointQuestionItemRef`（`{questionSlug,itemNumber,subItemIndex?}`）をそのまま再利用 → 既存 loader（`select-related-general-questions.ts`）でそのまま解決可能。`resolved=false`（slug/itemNumber不一致）は要修正。

---

## 3. Issue Graph 設計

**Issue を唯一の編集ハブ**にし、既存エンティティは primary のまま「束ねるビュー」として参照する（逆リンクは Issue 側の関係から導出）。

```
            ┌───────────────────────────── Issue ─────────────────────────────┐
            │ issue_id / title / citizen_question / status / evidence_anchors  │
            └───┬──────────┬───────────┬───────────────┬───────────────┬───────┘
   related_general_     related_     related_         related_         related_
   question_items        bills       topics          committees       session_overview
        │                 │            │                 │                 │
   {questionSlug,    {bill_number, {topic_slug,     {name, via_bill}   keyPoint 昇格
    itemNumber}       status}       status}          ※議案経由         （Issueが ref 供給）
        │                 │            │                 │
  GeneralQuestion     bills /      topic JSON /     session-overviews
  (item単位・確定)    bill_contents  DB topics        .committees
```

- **Issue → GeneralQuestionItem**：item 単位・**確定**（KeyPointQuestionItemRef 互換）。会期の論点と質問を item 精度で結ぶ唯一の確定リンク。
- **Issue → Bill**：会期内 `bills.name`（`議案第NN号 …`）で解決。**status=candidate が既定**、編集者が `confirmed` 化。fuzzy はせず議案番号で厳密一致。
- **Issue → Topic**：source の `topic_slugs` に既設定なら `confirmed_at_source`、それ以外は `candidate`/`new`。
- **Issue → Committee**：直接ではなく**議案経由**（via_bill）。`session-overviews.committees[]` の議案↔委員会から導出。
- **Issue → SessionOverview**：Issue を **keyPoint へ昇格**する供給源。keyPoint の `relatedBills/relatedTopicSlugs/relatedGeneralQuestionItems` を Issue の確定関係から生成。

**逆引き**（Bill→関連Issue、Topic→関連Issue、Question→関連Issue）は、Issue 集合を走査して導出（別テーブル不要・単一の真実源）。

---

## 4. pilot issue 一覧（7件・`…issue-graph-pilot.json` に実体）

| issue_id | title | 市民の問い | 一般質問item | 議案候補 | topic |
|---|---|---|---|---|---|
| `issue-r8d4-keelung-route` | 台湾・基隆定期航路と八重山丸 | 航路は採算含め続けられる？ | 10 | 議案45(候補) | keelung-yaimamaru(candidate) |
| `issue-r8d4-rito-koshien` | 離島甲子園への出場 | 子どもは参加できる？費用は？ | 2 | 議案42(候補) | rito-koshien(**confirmed_at_source**) |
| `issue-r8d4-former-cityhall` | 旧庁舎跡地の活用 | 跡地はどう使われる？ | 2 | なし | old-city-hall(**confirmed_at_source**) |
| `issue-r8d4-lodging-tax-finance` | 宿泊税と観光財源・基金の使い方 | 税・基金・寄付は何に使う？ | 4 | 議案36・41・42(候補) | なし |
| `issue-r8d4-municipal-housing` | 市営住宅・住まいの確保 | 住み続けられる住まいは？ | 4 | 議案40(候補) | なし |
| `issue-r8d4-school-education` | 学校統廃合・教育環境 | 統廃合・校舎・学びはどうなる？ | 8 | 議案48・49(候補) | なし |
| `issue-r8d4-disaster-fire-rescue` | 防災・消防救急・避難 | 災害・有事の体制は大丈夫？ | 4 | 議案50・51(候補) | なし |

- GQ item ref は 34 件すべて **resolved=true**（slug+itemNumber が general-questions.json と一致）。
- 議案リンクは**全て candidate**。topic は rito-koshien / old-city-hall のみ source 確定（item 対応は要確認）、keelung は候補。
- anchor は各 issue の代表質問から question-level で添付（ASR・要校正）。

---

## 5. 実装方針

### いきなり DB schema を作るべきか → **No。まず docs JSON（draft）で始める。**
理由：
1. スキーマ・関係の**確定/候補/未確認の運用がまだ手探り**。確定前に DB に入れると移行コストが高い。
2. **編集者レビューが前提**（bill/topic 確定は人手）。pilot で粒度・関係を詰めてから収束。
3. 既存の **keyPoint（TS）と topic（DB/JSON）の二重管理**を、Issue で整理する設計が固まってから DB 化したい。
4. pilot 7件 →（keyPoint 供給で会期ページ試作）→ 収束したら DB（migration）化、という段階を踏む。

### 将来 DB 化するときの単位（今はやらない）
- `issues`（issue_id, diet_session_id, title, citizen_question, summary, summary_hard, category, status, display_order）
- 関連は many-to-many＋status 列：`issue_general_question_items` / `issue_bills`（status: candidate|confirmed）/ `issue_topics`（status）。委員会は議案経由で導出。
- 既存 `bill_contents`/topic content と同じ RLS・`createAdminClient` 方針。

### 既存 topics と issue をどう分ける
- **topic = 1つの物語の縦の継続追跡**（状態更新・bill候補・**normal/hard 本文**）。長期・深掘り・会期をまたぐ。
- **Issue = 会期内の「論点の地図ノード」**。横断・編集ハブ・複数 GQ/Bill を束ねる。状態は**会期スナップショット**。
- 関係：**Issue → topic にリンク**（候補/確定）。topic へ昇格すべき Issue もあるが**自動はしない**。Issue は topic の代替ではなく**上位の索引＋補完**。

### UI にはどう出すか（将来・未実装）
- **会期ページ**：「**論点で見る（今会期の Issue）**」セクション。各 Issue＝citizen_question 見出し＋関連議案/一般質問/委員会への導線。既存 keyPoint を Issue 駆動に置換。
- **topic ページ**：Issue から関連 topic を表示（Issue→topic 候補）。
- **issue 詳細ページ**：将来（収束後）。
- いずれも**確定後のみ public 反映**（本タスクでは出さない）。

### normal / hard 生成とどう接続するか
- Issue は `citizen_question`＋`summary` を持ち、**確定後に Issue 単位の normal/hard 記事生成**へ（bill_contents・topic content と同じ作法）。
- 生成の**根拠は related_general_question_items（item確定）＋evidence_anchors＋related_bills（確定後）**。**本文外の補完はしない**（議事録/議案にない内容は書かない）。
- Issue→keyPoint 供給により、会期 overview の論点カードも Issue 由来で一貫させる。

---

## まとめ（判断）
- **論点（Issue）を中心ハブにする設計は妥当**。既存の keyPoint がほぼ proto-Issue で、`KeyPointQuestionItemRef` をそのまま流用できるため**接続コストが低い**。
- **まず docs JSON（draft）で pilot 7件**を回し、編集者が bill/topic を確定 → keyPoint 供給で会期ページ試作 → 収束後に DB schema 化、の順を推奨。
- 既存 topic は残し、Issue は**横断インデックス＋編集ハブ**として補完（自動確定・fuzzy・本文外補完はしない）。
