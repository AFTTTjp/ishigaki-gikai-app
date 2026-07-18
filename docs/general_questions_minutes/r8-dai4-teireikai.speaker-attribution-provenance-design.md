# Speaker Attribution Provenance Design

## Purpose

This document designs a reviewer-first speaker attribution provenance layer for
general question minutes. The goal is to reduce unsafe `hold_attribution`
outcomes by preserving how a speaker was attributed, what evidence was used, and
how confident the pipeline is.

This is a design artifact only. It does not change attribution logic, regenerate
artifacts, approve existing holds, update public General Questions JSON, or write
to production.

## Current State

For R8 Dai4 Teireikai, the published General Questions data currently contains:

- questions: 21
- items: 108
- confirmed_facts: 21
- city_answer_summaries: 9
- summary-bearing items: 8

The remaining answer summary attribution holds are:

- total holds: 7
- resolved_explicit from existing source review: 1
- resolved_contextual_high_confidence from existing source review: 1
- unresolved_ambiguous: 4
- unresolved_source_missing: 1

The current holds should not be promoted directly. Attribution resolution and
summary publication must remain separate review gates.

## Current Pipeline Findings

### Source Minutes

General question minutes are read from local transcriber output markdown files.
The useful source evidence includes:

- raw full-text lines
- line numbers within the extracted `本文 / full_text` section
- speaker cue lines ending in `君`
- chair/procedural lines such as `当局の答弁を求めます`
- item cues such as `1項目目`

The current source can contain ASR/OCR variants such as:

- `総務省田原治君`
- `総務省田原総務君`
- `会計監査吉村吉君`
- `会計管理者 石村石君`

These should be treated as raw evidence, not overwritten.

### Utterance Index

File: `scripts/issue-publisher/build-utterance-index.mjs`

Current behavior:

- `detectSpeakerCue` treats a normalized line ending in `君` as a speaker cue.
- `detectSpeakerContext` classifies the cue as `questioner`, `chair`,
  `executive`, or `unknown`.
- Executive role detection uses substring patterns such as `市長`, `部長`, `課長`.
- Speaker context is held as `currentSpeakerContext`.
- New blocks inherit the current speaker context unless a new cue is detected.
- Procedural lines can become `chair` or inherit fallback context.

Current output fields:

- `speaker_hint`
- `speaker_role_hint`
- `speech_kind`
- `confidence`
- `review_flags`

Failure points:

- A corrupted cue that does not contain a known role pattern becomes `unknown`.
- A cue can be appended to the previous block when it appears after answer text
  and before the next item answer.
- `当局の答弁を求めます` establishes that an answer follows, but it does not
  identify the speaker.
- If an answer cue is missing, the previous questioner context can be inherited
  into an answer-like block.
- No structured provenance records how speaker attribution was obtained.

### Candidate Inventory

File: `scripts/issue-publisher/build-candidate-inventory.mjs`

Current behavior:

- Direct executive/city item answers become `direct_item_match`.
- Answer-like blocks with unresolved role can become `unknown_answer_like`.
- Unknown answer-like sources receive risk flags such as `answer_role_unknown`.
- Confidence is derived from anchor source, not from a structured speaker
  attribution confidence model.

Downstream impact:

- `unknown_answer_like` can preserve useful answer text, but cannot safely be
  used for public summaries without reviewer attribution work.

### Answer Summary Candidates

File: `scripts/issue-publisher/build-answer-summary-candidates.mjs`

Current behavior:

- Candidate sources are collected from `unknown_answer_like` and recoverable
  answer candidates.
- If `source_speaker_role === "unknown"`, the candidate is marked
  `hold_attribution`.
- Existing reviewer fields are preserved on regeneration.

Current limitation:

- The candidate artifact shows that attribution is unresolved, but it does not
  automatically include a complete evidence chain such as previous/next
  utterance, raw speaker cue, normalized candidate, and contradiction notes.

## Failure Patterns From Current Holds

### Pattern A: Explicit Cue Swallowed By Previous Block

Example: 仲嶺忠師 item 2, `企画部長 菅沼博彦`

Observed behavior:

- Raw full text contains `企画部長 菅沼博彦` immediately before the item 2
  answer.
- In the current utterance index, that cue remains at the end of the previous
  utterance text.
- The item 2 utterance inherits the previous unresolved speaker
  `会計監査吉村吉`.

Design implication:

- Speaker cue detection must happen before appending a line to the current block.
- A speaker cue found mid-flow should flush the current block and update speaker
  context for the next block.

### Pattern B: Corrupted Role / Name Cue

Examples:

- `総務省田原治`
- `総務省田原総務`
- `会計監査吉村吉`

Observed behavior:

- The cue line exists in source.
- Role detection fails because the cue does not contain a known role pattern.
- The block becomes `speaker_role_hint: "unknown"`.

Design implication:

- A session dictionary can map known raw variants to canonical speaker records.
- Raw variants should be explicitly registered, not generated with fuzzy name
  matching.
- Automatic human-name fuzzy correction should be avoided.

### Pattern C: Missing Cue / Wrong Inheritance

Example: 花谷史郎 item 1

Observed behavior:

- The source has `当局の答弁を求めます` followed by `おはようございます`.
- No administrative speaker cue is present before the item 1 answer.
- The utterance inherits or preserves the questioner-like speaker context.

Design implication:

- After a chair answer-request cue, speaker context should be reset to an
  unresolved answer-awaiting state if no explicit speaker cue follows.
- Chair cue alone may classify the following block as answer-like, but must not
  identify a person.

## Proposed Data Model

Add non-breaking nested metadata to each utterance while preserving existing
fields:

```json
{
  "speaker_hint": "existing compatibility field",
  "speaker_role_hint": "existing compatibility field",
  "speaker_attribution": {
    "raw_cue": "総務省田原治君",
    "normalized_name": null,
    "normalized_role": null,
    "methods": ["explicit"],
    "primary_method": "unknown",
    "source": {
      "type": "speaker_cue_line",
      "line_start": 222,
      "line_end": 222
    },
    "confidence": "unknown",
    "evidence": [
      {
        "kind": "raw_speaker_cue",
        "text": "総務省田原治君",
        "line": 222
      }
    ],
    "contradictory_evidence": [],
    "unresolved_reason": "raw cue does not match a known role or session dictionary entry"
  }
}
```

Recommended fields:

- `raw_cue`: source text used as speaker cue, without correction.
- `normalized_name`: canonical name when safely known.
- `normalized_role`: canonical role when safely known.
- `primary_method`: the strongest attribution method.
- `methods`: all contributing attribution methods.
- `source`: machine-readable source location.
- `confidence`: one of `explicit`, `contextual_high`, `contextual_low`,
  `unknown`.
- `evidence`: compact evidence list for reviewer audit.
- `contradictory_evidence`: evidence that prevents automatic promotion.
- `unresolved_reason`: required when confidence is `unknown` or
  `contextual_low`.

Compatibility:

- Keep `speaker_hint` and `speaker_role_hint` for existing consumers.
- Derive compatibility fields from `speaker_attribution` only after migration.
- Do not require existing artifacts to be regenerated in the design PR.

## Attribution Methods

Supported methods:

- `explicit`: a parseable speaker cue is present in source.
- `role_name_dictionary`: raw cue or alias matches a session dictionary entry.
- `contextual_inheritance`: speaker inherited within a safe answer block.
- `chair_nomination`: chair/procedural cue provides answer-flow context.
- `manual_review`: reviewer explicitly resolved attribution.
- `unknown`: insufficient or contradictory evidence.

When multiple methods apply:

- Store all methods in `methods`.
- Store the strongest safe method in `primary_method`.
- Keep evidence for each method.
- Confidence is the minimum safe confidence across the chain, not simply the
  strongest signal.

## Confidence Model

Recommended confidence values:

- `explicit`: source cue is parseable and role/name are directly available.
- `contextual_high`: at least two independent contextual signals agree, with no
  contradiction.
- `contextual_low`: answer-likeness or sequence suggests a speaker/role, but one
  or more signals are missing.
- `unknown`: no safe attribution or conflicting evidence.

Future candidate gate:

- `explicit`: eligible for public candidate generation.
- `contextual_high`: eligible with evidence flag.
- `contextual_low`: hold attribution.
- `unknown`: hold attribution.

This design PR does not change the gate.

## Attribution Rules

### Rule 1: Explicit Cue

If a speaker cue line is present and parseable:

- record raw cue
- normalize role/name if exact parser or dictionary match is available
- set method `explicit`
- set confidence `explicit`

If the cue is present but not parseable, keep raw cue and set confidence
`unknown` unless dictionary matching resolves it.

### Rule 2: Role / Name Dictionary

Use a session-specific dictionary to normalize known variants.

Rules:

- aliases must be explicitly listed
- no automatic person-name fuzzy matching
- raw source text is never rewritten
- dictionary match evidence is added to attribution evidence

### Rule 3: Contextual Inheritance

Allow inheritance only inside the same answer block.

Stop inheritance at:

- item boundary
- council member turn
- chair/procedural cue
- explicit new speaker cue
- unknown block transition
- answer block end marker such as `当局の答弁は終わりました`

If inheritance uses only one weak signal, classify as `contextual_low`.

### Rule 4: Chair Nomination

Use chair/procedural cues to establish flow.

Examples:

- `当局の答弁を求めます`
- `○○部長`
- `市長`

Important constraints:

- `当局の答弁を求めます` alone can mark the next block as answer-like.
- It cannot identify a person by itself.
- If no explicit cue follows, confidence remains `contextual_low` or `unknown`.

### Rule 5: Unresolved

Keep attribution unresolved when:

- multiple speaker candidates remain
- source cue is missing
- raw cue conflicts with context
- dictionary has no matching alias
- item boundary makes inheritance unsafe

## Session Speaker Dictionary

Recommended location for a future implementation:

`docs/general_questions_minutes/speaker-dictionaries/<session>.speaker-dictionary.json`

Proposed shape:

```json
{
  "schema_version": "speaker-dictionary.v1",
  "diet_session_slug": "ishigaki-r8-dai4-teireikai",
  "entries": [
    {
      "canonical_name": "吉村康生",
      "canonical_role": "会計管理者",
      "aliases": ["会計管理者 吉村康生", "会計管理者 吉村康君"],
      "source": {
        "type": "minutes",
        "path": "general_question_minutes:2026-06-16/...",
        "line_hint": "initial meeting self-introduction"
      },
      "active_scope": {
        "session": "ishigaki-r8-dai4-teireikai",
        "date_from": "2026-06-08",
        "date_to": "2026-06-24"
      },
      "review_status": "reviewer_approved"
    }
  ]
}
```

Dictionary policy:

- store only observed aliases or reviewer-approved aliases
- do not synthesize aliases
- include provenance for each entry
- make dictionary use optional and session-scoped

## Reviewer Evidence Package

Future answer-summary candidates should include:

- source utterance
- previous utterance
- next utterance
- raw speaker cue
- normalized speaker
- attribution method
- attribution confidence
- evidence chain
- contradictory evidence
- reviewer recommendation

This avoids forcing reviewers to search multiple artifacts manually.

Recommended compact candidate addition:

```json
{
  "attribution_evidence_package": {
    "source_utterance_id": "...",
    "previous_utterance_id": "...",
    "next_utterance_id": "...",
    "raw_speaker_cue": "...",
    "normalized_speaker": null,
    "method": "unknown",
    "confidence": "unknown",
    "evidence": [],
    "contradictory_evidence": [],
    "reviewer_recommendation": "hold_attribution"
  }
}
```

## Backward Compatibility

### Utterance Index

Recommended schema path:

- current: `issue-publisher-utterance-index.v1`
- future: `issue-publisher-utterance-index.v2`

Compatibility strategy:

- add `speaker_attribution` as optional in v1-compatible transitional output
- continue writing `speaker_hint` and `speaker_role_hint`
- update consumers to prefer `speaker_attribution` when available
- only then consider a formal v2 schema

### Candidate Inventory

No immediate breaking change.

Future additions:

- `answer_anchor_attribution_confidence`
- `answer_anchor_attribution_method`
- `speaker_attribution_evidence`

### Answer Summary Candidates

No immediate breaking change.

Future additions:

- attribution evidence package
- eligibility derived from attribution confidence

### Public General Questions JSON

No direct change in early phases.

Published summaries should continue to be added only through reviewer-approved
JSON source updates.

### Importer / DB / UI

No impact until public JSON changes.

### Regeneration Policy

Do not regenerate all artifacts in the first design/metadata PR. Regeneration can
produce large diffs and should be a separate explicit phase with before/after
counts.

## Minimal Implementation Phases

### Phase 1: Speaker Provenance Schema / Data Model

Scope:

- add optional `speaker_attribution` fields to utterance index builder output
- add validation helpers or schema docs
- no behavior change

Likely files:

- `scripts/issue-publisher/build-utterance-index.mjs`
- utterance-index schema or README if introduced
- focused tests / fixtures

Risk: low

Generated artifact impact: optional sample/fixture only; no full regeneration

Production impact: none

### Phase 2: Explicit Cue Boundary Fix

Scope:

- ensure speaker cue lines flush the previous block even when they appear after
  answer text
- fixture Pattern A

Likely files:

- `scripts/issue-publisher/build-utterance-index.mjs`
- tests / fixtures

Risk: medium

Generated artifact impact: can alter utterance segmentation; regenerate only in a
separate reviewed PR

Production impact: none

### Phase 3: Session Speaker Dictionary

Scope:

- introduce session dictionary artifact shape
- exact alias matching only
- no fuzzy person matching

Likely files:

- dictionary schema
- optional R8 Dai4 dictionary fixture
- utterance attribution resolver tests

Risk: medium

Generated artifact impact: improves role/name normalization when dictionary is
explicitly enabled

Production impact: none

### Phase 4: Contextual Attribution + Confidence

Scope:

- implement safe inheritance rules
- implement chair nomination support as flow evidence, not person evidence
- confidence values `explicit`, `contextual_high`, `contextual_low`, `unknown`

Risk: medium-high

Generated artifact impact: can move some holds to contextual confidence

Production impact: none until public JSON update

### Phase 5: Reviewer Evidence Package

Scope:

- attach previous/next utterance and attribution evidence to answer-summary
  candidates

Risk: low-medium

Generated artifact impact: answer-summary-candidates diff only

Production impact: none

### Phase 6: Re-evaluate Existing 7 Holds

Scope:

- regenerate / review candidates after Phases 1-5
- produce reviewer-only decision artifact
- do not auto-publish

Risk: low if prior phases are verified

Production impact: none unless a later public JSON PR is approved

## Test / Fixture Plan

Minimum fixtures:

- normal explicit speaker cue
  - expected: `primary_method=explicit`, `confidence=explicit`
- cue swallowed by previous block
  - expected: cue becomes source for next block, previous block is flushed
- corrupted role cue
  - expected: raw cue retained, confidence `unknown` unless dictionary matches
- corrupted name cue
  - expected: no fuzzy person correction
- same speaker continuation
  - expected: contextual inheritance only inside answer block
- item boundary
  - expected: inheritance stops or requires explicit/contextual evidence
- chair nomination
  - expected: answer-flow evidence, not person identity
- ambiguous nomination
  - expected: unresolved
- missing cue
  - expected: no questioner inheritance into answer speaker
- council member misinheritance prevention
  - expected: answer-like block after `当局の答弁を求めます` does not keep
    questioner as speaker
- unknown maintained
  - expected: `hold_attribution`
- existing Batch 1-3 source utterance regression
  - expected: previously published source utterance IDs remain stable unless a
    regeneration PR explicitly approves changed IDs

## Existing 7 Holds Impact

Likely resolved by future pipeline:

- 仲嶺忠師 item 2: explicit cue boundary fix should recover
  `企画部長 菅沼博彦`.
- 仲嶺忠師 item 1: dictionary/provenance can likely resolve
  `会計監査吉村吉` to a reviewer-approved accounting official if the dictionary
  records the observed alias.

Still manual / ambiguous:

- 友寄永三 item 7
- 後上里厚司 item 1
- 井上美智子 item 2
- 井上美智子 item 3

Not safely resolvable from current source alone:

- 花谷史郎 item 1, because the administrative speaker cue is missing.

## Non-goals

- No speaker attribution logic implementation in this PR.
- No existing hold modification.
- No candidate regeneration.
- No utterance index regeneration.
- No public General Questions JSON edit.
- No summary addition.
- No production import.
- No DB write.
- No migration.
- No revalidation.
- No UI change.

## Recommended First Implementation Phase

Start with Phase 1: add speaker attribution provenance metadata without changing
selection behavior. This creates the audit surface needed for safer future
changes while keeping public data and existing reviewer artifacts stable.
