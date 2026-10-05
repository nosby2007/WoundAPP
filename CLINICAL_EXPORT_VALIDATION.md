# Clinical export validation

The renderer reads canonical clinical records; it never edits source facts,
signatures, locks, patient data or audit events. Print/share uses the same
structured renderer. Internal IDs remain available to internal audit and
snapshot references but never appear as external clinical-document fields.

## Covered schemas

Wound assessment, general assessment (`answers`), systemic assessment
(`answers.systems`), Braden (`answers.braden`), care plans and their existing
problem subcollections/catalog references, clinical orders, education,
provider progress notes and visits. Zero and negative/absent findings are
preserved. Document author is never silently promoted to an electronic signer.
Missing names are resolved only from same-organization users; inaccessible
names remain missing rather than printing UIDs. Calendar DOBs do not undergo
UTC conversion. Explicitly requested missing encounters fail safely.

## Actual validation

- 127 local WoundAPP unit tests passed, including 13 export cases.
- Production Angular build passed with pre-existing budget/CommonJS warnings.
- Professional packet and full clinical visit-chain static verifiers passed.
- `scripts/verify-clinical-print-layout.cjs` exercises the actual renderer with
  synthetic records, checks technical-field exclusion and explicit-visit
  selection, generates A4 output and screenshots. Both rendered PDF pages
  were inspected: repeated PHWC/patient header, correct DOB, no overlap,
  clipping or orphaned signature block.

Generated fixtures under `output/pdf` contain synthetic names only and are
not source clinical records. Native/mobile print UI and authorized recipient
transmission still require authenticated device UAT. No production deployment
or automatic merge was performed.

Catalog reference wording is read from the existing organization catalog,
not fabricated. Legacy records without an author-time catalog snapshot cannot
prove historical wording; missing references are visibly unavailable. Already
finalized HTML snapshots are not rewritten by this change.
