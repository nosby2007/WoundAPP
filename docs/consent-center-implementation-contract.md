# WoundAPP Consent Center — implementation contract

Status: design and security gate only. No clinical consent signing, PDF generation, or identifier allocation is deployed by this document.

## Canonical workflow
1. From an authenticated patient chart, choose a versioned tenant-approved template: consent to treat, debridement, biopsy, or pressure-injury-prevention education acknowledgement.
2. Display patient/representative identity, procedure-specific explanation, risks, benefits, alternatives, opportunity for questions, clinician/witness fields as applicable, and language/interpreter details. Education acknowledgement is **not** procedural consent.
3. Allow typed-name electronic signature with explicit intent-to-sign checkbox, or pointer/touch-drawn signature. Capture signing method, signer role, signed-at **server timestamp**, authenticated operator, template version, patient ID, tenant ID and visit/episode ID.
4. Send signing payload to a privileged server endpoint. Recheck authenticated user, tenant membership, patient access, template version and role; never trust browser-supplied org, timestamp, or document path.
5. Server renders PDF from an allowlisted template, embeds signature and audit metadata, calculates SHA-256, stores immutable object in tenant/patient-scoped Firebase Storage, and atomically creates a chart Documents record referencing the storage object, checksum, signer, visit, and version.
6. Documents screen lists the signed PDF and offers an authorization-checked download. Corrections create a superseding version; never overwrite or delete the signed original through routine UI. Log view/download/sign/supersede actions. Do not expose permanent public download URLs.

## Clinical and legal release gates
- Confirm organizational policies and applicable state/federal electronic-signature, informed-consent, record-retention and patient-access requirements before activation.
- Require clinician verification of capacity, representative authority, appropriate witness/interpreter where needed. A typed name alone without explicit intent and audit is insufficient.
- Include refusal/withdrawal pathways; never imply signature guarantees procedure consent validity.
- Separate unsigned drafts from finalized records; do not render a draft as a signed consent.
- Verify mobile touch accessibility, offline failure/retry without duplicate signatures, PDF accuracy and screen-reader labels.
- Run Firestore/Storage emulator deny/allow matrix for RN, NP, patient org, cross-tenant, billing partner, anonymous user, signed immutability and download; then Firebase DEV authenticated E2E. No production deployment before evidence.

## Numeric identifiers
- MRN: 10 decimal digits, tenant-unique, allocated once per patient; immutable after issuance. No names/DOB-derived digits.
- Account number: 12 decimal digits, tenant-unique, allocated once per episode/admission; multiple episodes of the same patient receive distinct numbers.
- Allocate both on the server in a Firestore transaction using a per-tenant counter and uniqueness registry. Never use Date.now(), Math.random(), browser-only counters or Firestore auto-IDs as the visible identifier.
- On migration, retain existing MRNs/account numbers and detect collisions before allocating; never silently overwrite. Keep leading zeros as strings.
- Client reads identifiers only after the server transaction commits. Check authorization before creating an episode or allocating identifiers.

## Integration touchpoints
- WoundAPP: `src/app/pages/patient-documents/patient-documents.page.ts` currently lists/uploads documents; add a dedicated Consent Center entry after secure backend is ready.
- WoundAPP: `src/app/services/mobile-patient-document.service.ts` is the current document integration boundary.
- WoundAPP: `src/app/services/patient.service.ts` exposes `mrn`; do not synthesize one on the client.
- JADE-SHOP: canonical patient/episode creation must allocate identifiers and expose them to both applications, and canonical Documents must index signed consent records.
- Never store raw signature image in ordinary client logs, analytics or unprotected collections.
