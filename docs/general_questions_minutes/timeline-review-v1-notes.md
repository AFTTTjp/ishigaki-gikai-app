# Timeline Review v1 Notes

## Purpose

- `timeline-review/v1` は、Event Graph v1 review artifact を市民向け表示に近い時系列カードへ変換するための **review-first artifact** です。
- 公開用の Topic JSON や DB レコードを直接更新する前に、`event_date` 順の並び、`candidate` / `confirmed` の扱い、`source_refs` / `evidence_ids` の保持方針を確認するために使います。
- 現時点では `rito-koshien` のみを対象にした PoC です。

## Relationship To Event Graph

- 入力は `event-graph/v1-review` です。
- Event Graph は「議会で起きた出来事」を保持し、Timeline review はその event を市民向けに読みやすい順序へ並べ替えた表示用下書きです。
- Timeline review は Event Graph の代替ではなく、UI 接続前の薄い変換レイヤーです。

## Status Handling

- `confirmed`
  - Speech evidence や stable source を伴う event です。
  - UI に接続する場合も「確認できた流れ」として扱いやすい候補です。
- `candidate`
  - source はあるが、Speech evidence や council action などの強い根拠接続が未完了の event です。
  - UI 接続時に確定事実のように見せないことが前提です。
- 現段階では `candidate` を `confirmed` に昇格させる処理は行いません。

## Why `source_refs` And `evidence_ids` Must Be Preserved

- Timeline item の本文だけでは、後から「どこを根拠に表示したか」を追えません。
- `source_refs` は speech 以外の source（topic JSON、session overview など）への参照を保つために残します。
- `evidence_ids` は Speech Canonical 由来の stable anchor を保つために残します。
- 将来的に Topic UI、Search、AI Chat へ接続する場合も、この 2 つを落とさないことで review artifact から public source へ昇格しやすくなります。

## Summary Rule

- `summary` は source にある文言だけを使います。
- Event Graph の `notes` や既存 title を利用してもよいですが、推測による要約や背景補完はしません。
- speech 根拠がない event に、答弁内容や結論を追加で書き足さないことを原則にします。

## What Timeline Review v1 Does Not Cover Yet

- `vote`
- `petition`
- `report`
- committee minutes 由来の stable speech evidence
- public Topic JSON / DB / UI への自動反映

これらは PoC の対象外であり、`review_required` に残して次段で扱います。

## How It Differs From Existing `topic_updates`

- `topic_updates` は公開用 Topic JSON / DB に入る編集済みデータです。
- `timeline-review/v1` は review artifact であり、公開 source ではありません。
- 既存 Topic ページの「これまでの流れ」は `topic_updates` の `progress` / `news` を表示しています。
- Timeline review は、その前段で「まだ public source に昇格していない event の並び」を検証するためのものです。

## UI Connection Pre-Flight Checklist

- `topic_slug` が既存公開 Topic と一致している
- `issue_id` が Issue Graph review artifact と一致している
- `timeline_items` が日付順に並んでいる
- `candidate` と `confirmed` の件数が確認できる
- `source_refs` が repo relative path のみで構成されている
- `evidence_ids` が stable id のみで構成されている
- `summary` が source にある範囲を超えていない
- `vote` など未収録 event が `review_required` に残っている
- UI で `candidate` を確定済み表示に見せない文言案がある

## Recommended First UI Integration Shape

- 初回は `rito-koshien` のみを対象にする
- 既存の Topic ページ内「これまでの流れ」とは別に、review 専用の「この話題の流れ（試作）」セクションとして差し込む
- データ源は DB ではなく review artifact 直読み PoC とし、public Topic JSON / `topic_updates` の上書きはまだ行わない
- `candidate` は例えば「確認中」「根拠確認中」など、市民に誤解を与えにくい表示へ落とす

## Next Step Recommendation

- 次の段階では Topic UI の server layer で `rito-koshien` の timeline-review artifact を読み込み、既存 `topic_updates` と並置表示できるかを検証する
- その際も DB / import / revalidation は行わず、review artifact を直接読む PoC に限定する
