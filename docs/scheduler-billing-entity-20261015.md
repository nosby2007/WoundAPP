# Mobile Scheduler billing attribution

## Local implementation

- New/replanned appointments require three separate selections: assigned staff, billing provider, and billing entity.
- Providers come from the existing same-tenant `staffPublic` directory, filtered to active provider roles with `billingProviderEnabled` and a ten-digit NPI. The directory/configuration is read again before saving.
- The entity is the current organization's `organizations/{orgId}.billingProfile`, using the existing JADE field names `billingProviderName` and `billingNpi`. No second entity collection, claim model or claims workflow is introduced.
- This version supports one configured entity per tenant. It does not create or register billing entities, infer a group from a clinician, or copy another tenant's configuration.
- Appointments store `billingEntityId`, `billingEntityName`, `billingEntityNpi` separately from `billingProviderUid`, `billingProviderName`, `billingProviderNpi` and the assigned clinician.
- A newly created field-visit shell copies the appointment's entity attribution only when its entity ID matches the appointment tenant. Existing clinical visits and legacy records are not backfilled or rewritten.
- Rescheduling preserves existing billing identity and displays it read-only; legacy blanks show "Not assigned". New/replanned visits require explicit billing selections.
- Replan creation and the old-appointment link use one atomic batch. A denied link cannot leave an orphan appointment.
- Billing configuration loading errors remain visible without hiding the schedule. Save errors preserve the editor; successful saves remain visibly confirmed after refresh.

## Configuration prerequisite

A read-only production check on 2026-10-15 found that `organizations/PHWC.billingProfile` does not contain the billing legal name and group NPI. JADE currently has a PHWC-only legacy profile in source. No production data was written.

Before publishing/enabling this workflow for PHWC, an authorized administrator must persist/verify the COMPLETE existing billing profile. Do not seed only its name/NPI: a stored profile takes precedence over JADE's legacy fallback, and a partial migration would drop the other billing defaults (including Tax ID, address and rendering-provider configuration). Configuration migration requires explicit approval and a backup; it is not included here.

## Security and limitations

- Existing rules remain authoritative for appointment role, tenant and billing-provider checks. No Firestore/Storage rules or Functions were changed or deployed.
- Entity selection validation is frontend validation and an operational snapshot, NOT new server-side entity attestation. Existing rules do not independently attest these new optional entity snapshot fields. They must not be treated as payer enrollment, network verification or authorization to submit a claim.
- Claims remain subject to the existing canonical billing engine and human review. No automatic claim creation/submission or clinical signature is added.
- No authenticated production save was performed. Hosting was subsequently published at the user's request (release below).

## Verification

- 13 targeted unit tests passed, covering entity configuration, provider eligibility, tenant separation, legacy handling, field-visit snapshots and editor behavior.
- Production build passed (exit 0), with existing unused-import, CSS/bundle budget and Twilio CommonJS warnings. `git diff --check` passed.
- Source is local on `fix/mobile-scheduler-billing-identity`; no commit, push or merge. Hosting publication is recorded separately below.
- Seven local emulator checks against the currently published rules snapshot passed, including employer creation with separate entity/provider/performer identities, cross-tenant denial and atomic replan failure.
- Emulator test source and logs reside in the companion JADE checkout (`scripts/test-employer-appointment-emulator.cjs`, `output/release/employer-billing-entity-emulator.log`). Only synthetic data and loopback emulator writes were used.

## Hosting release — 2026-10-15

- Explicit user request: publish directly, then continue. Scope: WoundAPP Hosting only, from this local checkout.
- Project `woundapp-261e6`, site `innovacare-mobile`, URL https://innovacare-mobile.web.app.
- Released version `7632ecd689391e01`; previous/rollback version `fa0cf4b9266d3d47`.
- Re-ran all 13 targeted tests successfully before deployment. Production build hash `73c4b6b48b3afbaf`.
- Five served assets matched local SHA-256 hashes, including Scheduler chunk `419.09390bd59a9d0d5c.js`.
- Firestore remained `fa8e84dc-274e-4706-85f2-93a1ebc040b0`; Storage remained `79df9fdf-0c8b-4524-9ef1-f001a0172cfb`. No Functions deployment or production data write.
- PHWC billing-profile prerequisite remains unresolved; publishing UI does not configure the entity. Employer production save remains unverified and the missing configuration blocks new appointments in this workflow.
- Private evidence: `output/scheduler-hosting-baseline.json`, `scheduler-hosting-verified.json`, `scheduler-hosting-deploy.log`, `scheduler-billing-release-tests.log`.
