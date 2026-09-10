# Shared Wound Order Engine v2

## Goal
Use WoundAPP and JADE-SHOP as two clients of the same clinical-order platform in Firebase project `woundapp-261e6`, instead of maintaining separate order logic.

JADE-SHOP is the authoritative provider/admin authoring experience. WoundAPP becomes the mobile execution/review experience. Both read the same patient-scoped order documents and organization-scoped care algorithms.

## Current state
- WoundAPP's `src/app/CLINICAL/orders/OrdersComponent` is still a placeholder and its HTML is only `orders works!`.
- JADE-SHOP already persists orders under `patients/{patientId}/orders/{orderId}` and supports wound order sets, care algorithms, workflow, receipt method and co-signature.
- Both repositories point to Firebase project `woundapp-261e6`.

## Target WoundAPP experience
Replace the placeholder prescription page with a mobile order workspace:

1. Patient/wound context at the top.
2. Segments: `Due`, `Active`, `PRN`, `Completed`.
3. Each active wound order shows the ordered sequence: cleanse -> prep -> fill/apply -> cover -> secure -> compression/offloading -> PRN instructions.
4. A clinician can open an order and document execution without changing the signed order itself.
5. Authorized provider roles can open the same structured composer used in JADE-SHOP.
6. Offline-friendly draft execution can be added later, but signed order intent remains server-authoritative.

## Shared Firestore contract
Use the existing collection:
`patients/{patientId}/orders/{orderId}`

New orders should keep the existing human-readable `description` and add structured v2 data:

```ts
schemaVersion: 2
orderType: 'wound_care_order_set' | 'wound_care_algorithm' | 'preventive_measures_order_set'
patientId: string
woundId?: string | null
orgId: string
facilityId?: string | null
clinical?: {
  woundType?: string | null
  woundLocation?: string | null
  priority?: string | null
  schedule?: {
    frequency?: string | null
    startAt?: Timestamp | null
    duration?: string | null
    occurrences?: number | null
  }
  cleanse?: string[]
  prep?: string[]
  apply?: string[]
  cover?: string[]
  secure?: string[]
  compression?: string[]
  offloading?: string[]
  contingencies?: Array<{ trigger: string; action: string }>
  comments?: string | null
}
source?: {
  mode: 'manual' | 'algorithm' | 'template' | 'imported'
  algorithmId?: string | null
  algorithmName?: string | null
  algorithmVersion?: number | null
}
```

## Execution records
Do not modify a placed order when the nurse carries it out. Record execution separately:

`patients/{patientId}/orders/{orderId}/executions/{executionId}`

Suggested execution fields:
- orgId/facilityId/patientId/woundId/orderId
- dueAt, startedAt, completedAt
- performedBy
- steps completed/skipped + reason
- supplies/products actually used
- linked wound assessment
- PRN/exception reason
- notes

This gives a clean audit trail and allows JADE-SHOP to display what happened in the field.

## Wound type navigation
The shared composer should support the categories visible in the reference order-set workflow:
- Wet
- Dry
- Wet, necrotic
- Dry, necrotic
- LE ulcer: arterial/neuropathic
- LE ulcer: venous
- Skin tear
- Compression & wraps
- NPWT
- Surgical
- Prevention / moisture-associated skin damage

Treatment selections must come from the organization's published algorithms. WoundAPP should not infer clinical treatment just from a wound category.

## Immediate implementation sequence in WoundAPP
1. Replace placeholder `OrdersComponent` with a patient-scoped order list.
2. Read legacy and schemaVersion 2 orders from the shared Firestore collection.
3. Add a mobile order detail/stepper.
4. Add order execution documents under the selected order.
5. Add `Due / Active / PRN / Completed` filtering.
6. Add provider-only launch into the structured order composer.
7. Add rules tests against the same Firebase security model used by JADE-SHOP.

## Compatibility rule
JADE-SHOP owns clinical authoring/versioning. WoundAPP consumes the same catalog and records execution. No duplicated hard-coded treatment catalog should be introduced in WoundAPP.
