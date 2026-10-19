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
# Wound photograph and longitudinal measurement extension

- Reuses canonical `patients/{patientId}/woundAssessments`: existing `photoURL`, `woundId`, `orgId`, `assessedAt`, and `measurements` only. No database writes, new collections, rules changes or clinical inference.
- Current assessment photograph prints at 100x100 CSS pixels with contain sizing, site and assessment date. HTTPS only; patient avatars are never used. The print dialog waits for images (15-second timeout), with unavailable downloads visibly indicated.
- Each assessment includes prior measurements of the same wound and organization through its assessment date. Historical assessments never include later measurements. Missing wound linkage is conservatively treated as its own first assessment, never grouped by location text.
- Area and depth have independent SVG axes and documented numeric values; missing, negative, nonnumeric and nonfinite values are not plotted. Missing values break curve segments. Zero is retained. No area calculated from length/width. Exact dated measurements accompany charts in a table; fewer than two values cannot produce a trend.
- Unit tests cover dimensions, escaping, unsafe URLs, missing/zero measurements and insufficient history. Synthetic renderer verifier checks wound/tenant/date isolation and selected-record history before visual A4 PDF review.
- Existing finalized document snapshots are not rewritten. Authenticated device printing and real Storage permissions remain an operational UAT step; synthetic QA is not evidence of those permissions.
