# Site-wide difficulty content decisions

Reviewer-only artifacts for completing normal / hard coverage across Topics, General Questions, and Bills.

This directory does not update public JSON, DB rows, importer behavior, UI, migrations, generated types, production data, or revalidation state.

## Current artifact

- `r8-dai4-site-wide-difficulty-content-decisions.json`
- Source commit: `24bcb8c3854ec7e405499e8ae84399025990e193`
- Scope: Topics hard candidates, General Questions item description candidates, Bills missing content review, Bills identical summary/content quality review.

## Decision policy

- Approve only when source support is explicit enough for public wording.
- Hold low-confidence or ambiguous items rather than filling coverage by inference.
- Bills with missing source text or generic duplicated normal/hard content are held until official source flow is confirmed.
- These records are reviewer-only and must not be imported directly into public JSON or DB tables.

## Validation

Run:

```bash
pnpm validate:difficulty-content-decisions
```

The validator checks target counts, duplicate decision IDs, public-content leakage, source IDs in proposed content, unsupported inference flags, and decision-count consistency.
