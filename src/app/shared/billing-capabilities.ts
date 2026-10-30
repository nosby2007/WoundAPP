/**
 * Clinical-only production mode, mirrored from JADE-SHOP
 * (functions/src/billing-capabilities.ts and src/app/core/billing-capabilities.ts).
 *
 * PHWC has no AMA CPT license. WoundAPP records clinical facts and ICD-10-CM
 * diagnoses; procedure coding is done by the external billing partner from the
 * Clinical Billing Handoff report in JADE. There is no runtime toggle: enabling
 * CPT needs a verified license and a reviewed release of both apps.
 */
export const BILLING_CAPABILITIES = Object.freeze({
  clinicalBillingHandoffEnabled: true,
  amaCptLicensed: false,
  cptCodingEngineEnabled: false,
  cptClaimGenerationEnabled: false,
  externalPartnerCodingEnabled: true,
});

export const cptCodingEnabled = (): boolean =>
  BILLING_CAPABILITIES.amaCptLicensed && BILLING_CAPABILITIES.cptCodingEngineEnabled;
