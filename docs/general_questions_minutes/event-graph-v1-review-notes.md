# Event Graph v1 Review Notes

## Purpose

Event Graph v1 review artifact は、Issue / Topic / General Question / Bill の間にある
「議会で起きた出来事」を review-first で整理するための中間成果物です。

目的は次の3点です。

- Speech Canonical や Issue Graph v2 で得られた根拠を、Event 単位で再利用できるようにする
- public JSON や DB に昇格する前に、event の妥当性を review できるようにする
- Speech / Evidence / Editorial を混ぜずに、Event を独立した層として扱う

この artifact は public source ではありません。review 用であり、推測で埋めないことを前提にします。

## Current Scope

現時点の builder は `scripts/build-event-graph-v1-review.mjs` です。

現行 target:

- `rito-koshien`
- `former-cityhall`

現行 review artifact:

- `docs/general_questions_minutes/r8-dai4-teireikai.event-graph-v1-rito-koshien.review.json`
- `docs/general_questions_minutes/r8-dai4-teireikai.event-graph-v1-former-cityhall.review.json`

## Status Meaning

### `confirmed`

次を満たす event に使います。

- event の存在が source 上で明示されている
- related question ref や date が stable に特定できる
- evidence_id を exact に引ける、または source ref の根拠が十分に強い

現時点では、`rito-koshien` の `general_question` event がこれに当たります。

### `candidate`

次のような event に使います。

- event 自体は source から読めるが、stable speech evidence がまだ無い
- bill / committee / session source はあるが、議事録側との exact bridge が未整備
- source はあるが、Event として本採用するには review が必要

現時点では、次がこれに当たります。

- `rito-koshien` の `bill_introduction`
- `rito-koshien` の `committee_referral`
- `rito-koshien` の `committee_discussion`
- `former-cityhall` の `general_question` 2件

## `source_refs` and `evidence_ids`

### `evidence_ids`

`evidence_ids` は Speech Canonical 由来の stable id だけを入れます。

- 例: `ishigaki-r8-dai4-ippan-nagahama-nobuo#L57-L67`

使ってよいのは、Speech Canonical JSON に実在し、exact 一致で確認できる id のみです。

### `source_refs`

`source_refs` は event の existence や relation を確認するための参照です。

主な source kind:

- `speech_canonical`
- `issue_graph_v2_review`
- `issue_review_packet`
- `topic_json`
- `general_questions_json`
- `session_overview`

`source_refs` は repo relative path のみを使います。ローカル絶対パスは入れません。

### 使い分け

- stable な speech block がある event は `evidence_ids` を持つ
- stable speech が無い event は `source_refs` のみで保持する
- `source_refs` があるだけで `confirmed` にしない

## Target Config Requirements

新しい target を `TARGETS` に追加する時は、少なくとも次を明示します。

- `key`
- `issueId`
- `sessionSlug`
- `topicSlug`
- `billNumber` または `null`
- `committeeName` または `null`
- `outputPath`
- `questionRefs[]`
- `aliases[]`

`questionRefs[]` に必要な情報:

- `questionSlug`
- `itemNumber`
- `memberLabel`
- 必要なら `eventDate`
- 必要なら固定 title

## Events Allowed in v1

現時点で作ってよい event は次です。

- `bill_introduction`
- `committee_referral`
- `committee_discussion`
- `general_question`

これらも、source が弱い場合は `candidate` のまま保持します。

## Events Not Yet Allowed

現時点では、次は原則作りません。

- `vote`
- `report`
- `petition`
- `procedural_announcement`

理由:

- per-bill の stable source が未接続
- speech evidence と council action の bridge が未整備
- review artifact の段階で推測補完に寄りやすい

## Why `vote` Is Not Included Yet

`vote` event は、会期全体の閉会情報だけでは不十分です。

少なくとも次が必要です。

- bill ごとの採決結果を stable に取れる source
- issue / bill / event の exact な接続
- source_refs だけでなく、必要に応じて議事進行や委員長報告との橋渡し

現段階ではその bridge が未整備なので、`review_required` に残して event 自体は作らない方針です。

## Expansion Checklist

新しい issue に横展開する前に、次を確認します。

1. issue ref が review artifact 上で resolved している
2. related topic があるか、無ければ topic 未接続のまま扱えるか
3. related bill / committee を推測なしで置けるか
4. stable speech evidence_id があるか
5. stable speech が無ければ `candidate` に留める設計で足りるか
6. `source_refs` を repo relative path で表現できるか
7. event を増やしすぎず、review 可能な最小数に絞れているか
8. `vote` を無理に入れていないか

## Guardrails

- Event は「議会で起きた出来事」に限定する
- Speech / Evidence / Editorial を混ぜない
- JSON source of truth を崩さない
- fuzzy bill_name matching は使わない
- public JSON / DB / UI はこの段階では変更しない
- source に無い事実は event にしない
- 不確実なものは `candidate` または `review_required` に残す
