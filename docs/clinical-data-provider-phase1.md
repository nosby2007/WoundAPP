# Clinical Data Provider — Phase 1

## Purpose

WoundAPP currently uses the same Firebase-backed clinical data that JADE uses. This phase introduces an application boundary so WoundAPP pages no longer need to know which backend supplies patient context.

This is an **architectural seam only**. It does not change the production backend, Firestore paths, Firebase project, Storage metadata, authentication, security rules, or clinical persistence behavior.

## Runtime wiring

```
WoundAPP page
  -> ClinicalDataService
    -> CLINICAL_DATA_PROVIDER
      -> JadeFirebaseClinicalDataProvider
        -> existing PatientService / document / context services
          -> existing Firebase backend
```

The provider token is explicitly wired to `JadeFirebaseClinicalDataProvider` in `AppModule`.

There is no automatic provider switching and no external EHR connection in Phase 1.

## First migrated workflows

Only two low-risk consumers are migrated:

- Progress Note patient header and read-only clinical/encounter context.
- Clinical Patient Documents read/upload workflow.

The underlying existing services remain intact and continue to own the current Firebase behavior.

## Guardrails

1. No production deploy is part of this branch.
2. No Firestore or Storage paths are renamed.
3. No security rules are changed.
4. No data is copied between systems.
5. No tenant can select another backend yet.
6. No FHIR/EHR write support exists yet.
7. Clinical facts remain read-only context unless the existing workflow already supported a write.

## Planned sequence

### Phase 2 — standalone provider

Implement a second provider behind the same interface and validate it in a non-production tenant. Do not switch existing tenants.

### Phase 3 — provider selection

Add explicit organization-level configuration with a safe default of `jade_firebase`. Unknown or missing configuration must fail closed to the current provider rather than silently switching data sources.

### Phase 4 — external EHR/FHIR adapters

Add adapters one at a time, beginning read-only. Mapping, provenance, consent, minimum-necessary access, audit logging, and retry/idempotency must be validated before enabling writes.

## Rollback

Because current Firebase services remain unchanged, rollback is simply reverting the page-level gateway usage and provider registration. No stored data migration is required by Phase 1.
