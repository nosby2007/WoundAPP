# Structured field-assessment debridement

This focused change restores the debridement work from WoundAPP commit
`276fcf6b41132df2d20013fe4c132aba0570f63a` on
`feature/patient-clinical-context-orders` onto the current mobile `master`.
It does not merge that branch's unrelated clinical-context or telehealth work.

- Checking **Debridement performed during this visit** reveals the detailed procedure inputs.
- The form saves `debridementProcedure` using the existing JADE field names: type, indication, consent, instrument, tissue level, area actually debrided, pain management, hemostasis, tolerance, complications, post-procedure measurements and procedure note.
- Editing reloads the recorded procedure. A new re-evaluation does not copy the prior visit's procedure.
- Unrecorded remains absent; explicitly unchecked saves only `performed: false`. Hidden fields cannot block saving or leak stale procedure details.
- Negative procedure measurements are invalid. Zero is retained. Tissue level, area, depth, consent and clinical outcomes are never inferred.
- The progress-note mapper and renderer include the recorded procedure under its own wound, separately from wound measurements and orders. Legacy treatment selections remain readable and do not imply a performed procedure.

## Validation

Targeted tests cover the form's conditional inputs, same-assessment edit, re-evaluation, canonical payload, negative/zero values, note mapping, multiple wounds and legacy records:

```sh
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include=src/app/shared/assessment-debridement.spec.ts --include=src/app/shared/wound-progress-note.spec.ts --include=src/app/services/wound-progress-note.service.spec.ts --include=src/app/pages/assessment-form/assessment-form.page.spec.ts
npm run build -- --configuration production
node scripts/verify-shared-provider-review.cjs
node scripts/verify-field-role-boundary.js
node scripts/verify-visit-chain-contract.js
```

No Firestore/Storage rule, function, scheduler, billing-entity, clinical-signature or print-photo-size change is included. Tests use synthetic data; authenticated production writes are not part of this validation. Creating the PR does not merge or deploy production; existing repository CI may create a DEV preview.
