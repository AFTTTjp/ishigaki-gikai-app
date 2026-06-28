# Issue Editorial Decisions

- issue_count: 7
- ready_for_keypoint_draft: 1
- needs_split: 2
- needs_topic_decision: 3
- keep_as_issue_only: 1

## 台湾・基隆定期航路と八重山丸（やいま丸）

- issue_id: issue-r8d4-keelung-route
- editorial_status: needs_topic_decision

### Confirmed Bills

- なし

### Candidate Bills

- 議案第45号: 議案第45号 中華民国基隆市との国際友好都市提携について / 経済民生委員会

### Confirmed Topics

- なし

### Candidate Topics

- ishigaki-keelung-route-yaimamaru: 石垣－基隆航路とやいま丸 / 航路系の既存topic。source topic_slugs未設定＝候補

### New Topic Candidates

- なし

### Split Notes

- なし

### Editor Notes

- 議案第45号は友好都市提携の議案であり、航路論点との接続は現時点では candidate 維持が妥当。
- 既存 topic `ishigaki-keelung-route-yaimamaru` は存在するが、source topic_slugs での裏付けはないため candidate 維持。

### Next Action

- 議案第45号を keyPoint の relatedBills に採るかを編集者が最終確認する。
- 既存 topic を keyPoint 側へ使うか、Issue 単独で扱うかを確認する。

## 離島甲子園への出場

- issue_id: issue-r8d4-rito-koshien
- editorial_status: ready_for_keypoint_draft

### Confirmed Bills

- 議案第42号: 議案第42号 令和8年度石垣市一般会計補正予算（第1号） / 総務財政委員会

### Candidate Bills

- なし

### Confirmed Topics

- rito-koshien-r8-dai4: 離島甲子園への出場はどうなる？ / 複数質問に source topic_slugs 設定済み。item対応は要確認

### Candidate Topics

- なし

### New Topic Candidates

- なし

### Split Notes

- なし

### Editor Notes

- 一般質問 item ref 2件、議案第42号、既存 topic が一直線につながっており、pilot 7件の中で最も keyPoint 化しやすい。
- topic は source topic_slugs による confirmed_at_source を維持する。

### Next Action

- keyPoint draft に進める前提で、status 文言と citizen-facing oneLine の草案を別途作る。

## 旧庁舎跡地の活用

- issue_id: issue-r8d4-former-cityhall
- editorial_status: keep_as_issue_only

### Confirmed Bills

- なし

### Candidate Bills

- なし

### Confirmed Topics

- ishigaki-old-city-hall: 石垣市庁舎跡地活用 / 友寄・後上里の質問に source topic_slugs 設定済み

### Candidate Topics

- なし

### New Topic Candidates

- なし

### Split Notes

- なし

### Editor Notes

- 既存 topic `ishigaki-old-city-hall` との接続は強い一方、今回 packet source には会期 bill 候補が置かれていない。
- 現段階では会期 keyPoint へ昇格させるより、Issue として保持しつつ既存 topic への導線として扱う方が安全。

### Next Action

- session-overview に出す場合でも relatedBills なしで扱うかを編集者が判断する。

## 宿泊税と観光財源・基金の使い方

- issue_id: issue-r8d4-lodging-tax-finance
- editorial_status: needs_topic_decision

### Confirmed Bills

- 議案第36号: 議案第36号 石垣市宿泊税基金条例 / 経済民生委員会

### Candidate Bills

- 議案第41号: 議案第41号 桃原用昇奨学基金条例及び桃原用昇高等学校奨学基金条例の特例並びに廃止に関する条例 / 総務財政委員会
- 議案第42号: 議案第42号 令和8年度石垣市一般会計補正予算（第1号） / 総務財政委員会

### Confirmed Topics

- なし

### Candidate Topics

- なし

### New Topic Candidates

- (new): 宿泊税と観光財源・基金の使い方 / 議案第36号を中心に、議案第41号・第42号を周辺論点として束ねる新規 topic 候補。

### Split Notes

- なし

### Editor Notes

- 議案第36号は論点の中心に近く、editorial 上は confirmed_bills へ寄せる案が妥当。
- 議案第41号・第42号は寄付金・一般財源の文脈で関係するが、中心 bill ではないため candidate 維持。

### Next Action

- 新規 topic 化するか、Issue のみで留めるかを編集者が決める。
- topic 化する場合の title / slug を別途確定する。

## 市営住宅・住まいの確保

- issue_id: issue-r8d4-municipal-housing
- editorial_status: needs_topic_decision

### Confirmed Bills

- 議案第40号: 議案第40号 石垣市営住宅の設置及び管理に関する条例の一部を改正する条例 / 建設土木委員会

### Candidate Bills

- なし

### Confirmed Topics

- なし

### Candidate Topics

- なし

### New Topic Candidates

- (new): 市営住宅・住まいの確保 / 議案第40号と一般質問 item ref 4件を束ねる新規 topic 候補。

### Split Notes

- なし

### Editor Notes

- 議案第40号は市営住宅 issue の中心 bill とみなしてよい。
- 既存 topic は無いため、新規 topic を作るか、Issue のみで扱うかの判断が必要。

### Next Action

- 新規 topic 候補の可否を決める。
- keyPoint に進める場合は住まい確保の市民向け問いを短く整える。

## 学校統廃合・教育環境

- issue_id: issue-r8d4-school-education
- editorial_status: needs_split

### Confirmed Bills

- なし

### Candidate Bills

- 議案第48号: 議案第48号 財産の取得について［石垣市学習者用GIGA端末］ / 総務財政委員会
- 議案第49号: 議案第49号 財産の取得について［石垣市指導者用GIGA端末］ / 総務財政委員会

### Confirmed Topics

- なし

### Candidate Topics

- なし

### New Topic Candidates

- なし

### Split Notes

- 議案第48号・第49号は GIGA 端末取得には直接つながるが、学校統廃合・給食・図書館・教育環境全体とは別軸になりやすい。
- sub_issue 例: `school-giga-devices` / `school-environment-and-reorganization`

### Editor Notes

- 現状の issue は教育全体を束ねすぎており、GIGA 端末議案を confirmed_bills に上げると論点が広すぎる。
- まず split してから keyPoint or topic 判断に進む方が安全。

### Next Action

- 教育全体 issue を 2 つ以上の sub_issue に分ける案を作る。

## 防災・消防救急・避難

- issue_id: issue-r8d4-disaster-fire-rescue
- editorial_status: needs_split

### Confirmed Bills

- なし

### Candidate Bills

- 議案第50号: 議案第50号 財産の取得について［救助工作車］ / 総務財政委員会
- 議案第51号: 議案第51号 財産の取得について［高規格救急自動車］ / 総務財政委員会

### Confirmed Topics

- なし

### Candidate Topics

- なし

### New Topic Candidates

- なし

### Split Notes

- 議案第50号・第51号は消防救急車両の取得に接続するが、津波避難・有事・平和まで同一 issue に束ねると論点が広すぎる。
- sub_issue 例: `fire-and-ambulance-assets` / `tsunami-evacuation-and-civil-protection`

### Editor Notes

- 消防救急の asset issue と、津波避難・国民保護の policy issue は分けて扱う方が編集しやすい。

### Next Action

- 消防救急車両 issue と避難・有事 issue の分割案を先に作る。

