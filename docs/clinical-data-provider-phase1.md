# Clinical Data Provider — Phase 1 (master)

WoundAPP production in this repository is based on `master`.

This phase introduces only a minimal application boundary around the existing
patient read used by Progress Note. It does not change Firebase configuration,
security rules, Firestore paths, Storage paths, authentication, or clinical
write behavior.

Runtime:

```
Progress Note
  -> ClinicalDataService
    -> CLINICAL_DATA_PROVIDER
      -> JadeFirebaseClinicalDataProvider
        -> existing PatientService
          -> existing Firebase backend
```

## Safety constraints

- No provider switching.
- No standalone mode.
- No FHIR/EHR integration.
- No data migration.
- No production deploy in this PR.
- Existing `PatientService` remains unchanged.
- Rollback requires only reverting the provider registration and Progress Note
  consumer change; stored data is untouched.

The contract will be expanded only after this first seam passes the existing
`master` CI/build checks.
