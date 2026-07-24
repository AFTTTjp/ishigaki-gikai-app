# Item Description Final Decisions

This directory stores reviewer-only final decisions for item-level
`normal_description` and `detailed_description` candidates.

## Boundary

- These artifacts are reviewer-only records.
- They do not update public General Questions JSON automatically.
- They do not connect to DB import, revalidation, UI, Topic JSON, or migrations.
- Approved descriptions still require a separate public JSON reflection gate.
- Hold records must not be copied into public JSON.

## Public Candidate Fields

Approved records use:

- `approved_normal_description`
- `approved_detailed_description`

These fields must contain only citizen-facing text. Reviewer notes, OCR caveats,
source-support comments, and implementation instructions belong in reviewer-only
fields.

## Reviewer-Only Fields

Each record keeps:

- `decision`
- `source_support`
- `revision_notes`
- `official_wording_check`
- `ocr_risk`
- `answer_content_check`
- `unsupported_inference_check`
- `recovery_requirements`

## Decision Values

- `approve_with_revision`: reviewer-approved wording differs from the generated
  candidate and is ready for a later public JSON reflection gate.
- `approve_as_written`: generated candidate is approved without wording change.
- `hold_item_match_ambiguous`: source-item correspondence must be recovered
  before approval.
- `hold_source_support`: source support is insufficient for the proposed text.
- `hold_official_wording_unconfirmed`: a proper noun or official wording remains
  unconfirmed.

## Validation Expectations

- Batch target records total 22.
- Approved records have both approved description fields.
- Hold records have no approved description fields.
- Public candidate fields do not contain reviewer-only meta text.
- Source support and official wording checks are present for every record.
- Public General Questions JSON remains unchanged.
