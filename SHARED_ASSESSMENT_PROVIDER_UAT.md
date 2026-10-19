# Shared assessment and explicit provider attribution

Canonical patient, woundAssessments, woundEpisodes, woundVisits, users and providerReview are reused. No new collections, patient copies, rule changes, or historical migration.

## Clinical workflow

1. RN captures an evaluation on a scheduled encounter.
2. NP opens the same patient's encounter in WoundAPP. The clinical command page surfaces evaluations captured for that visit with author/review status. Existing same-wound/visit findings are offered before creating another evaluation.
3. Open evaluation -> Provider review. Enter clinical decision and narrative, accept personal attestation, save. Original measurements, RN identity, signature and lock are unchanged. First review only; further decisions use an additional clinical note, not overwrite.
4. NP may explicitly accept linked episode responsibility, using the NP's current profile UID, display name and NPI. Another assigned provider, closed episode, wrong wound or tenant blocks this action. This does not establish who performed the RN encounter or alter billing attribution.
5. JADE episode editor supports explicit assignment/reassignment or repair, with the existing providerAssignmentHistory. Independently assign billing identity through its existing editor if required.

## Identity and encounter safeguards

- Explicit encounter ID takes precedence over appointment compatibility alias. A conflicting linked visit cannot satisfy completeness by appointment alone.
- RN-created episodes carry a complete billing UID/NPI pair from their canonical same-tenant encounter, but clinical responsibility stays unresolved until accepted. Existing episodes/visits are not bulk-rewritten.
- Same patient/date alone is not proof of the same encounter. Different NP appointments are not silently merged with RN visits. Open the actual RN encounter/evaluation for review, keep a separate NP clinical encounter when appropriate.
- Episode self-acceptance is NP-only under current rules. Other provider roles may review; administrator/NP reassignment is provided in JADE. Billing participation is not inferred by clinical assignment.
- Missing source identifiers, NPI, clinical name or tenant linkage remain visible blockers, not guessed values. Existing tenant/facility Firestore rules remain authoritative.

## Validation / remaining UAT

Run full unit suite, shared provider transaction verifier, existing visit-chain verifiers and Angular builds in both apps. Verify transaction denial for RN actor, foreign tenant, already-reviewed assessment, closed episode and existing different provider.

Authenticated DEV UAT still required: two authorized RN/NP accounts -> scheduled RN visit -> capture/sign -> NP sees same assessment -> review without retyping -> explicit episode acceptance -> JADE displays separate episode and billing identities. Verify facility-restricted access and read-only surveyor rejection. No production deployment or automatic merge.
