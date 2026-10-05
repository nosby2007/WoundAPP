import { TestBed } from '@angular/core/testing';
import { ClinicalDocumentExportService } from './clinical-document-export.service';
import { ClinicalAuditService } from './clinical-audit.service';
import { ClinicalDocumentSnapshotService } from './clinical-document-snapshot.service';

describe('external clinical document presentation', () => {
  let service: any;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [ClinicalDocumentExportService,
      {provide: ClinicalAuditService, useValue: {}},
      {provide: ClinicalDocumentSnapshotService, useValue: {}}]});
    service = TestBed.inject(ClinicalDocumentExportService);
  });
  it('prints clinical content without internal linkage and distinguishes author from signer', () => {
    const html = service.renderClinicalSection({kind:'woundAssessment', title:'Wound Assessment', records:[{
      id:'INTERNAL_RECORD', data:{appointmentId:'INTERNAL_APPOINTMENT', patientId:'INTERNAL_PATIENT',
        authorIdentity:{uid:'INTERNAL_AUTHOR', displayName:'Nurse Example', credentials:'RN'},
        describe:{location:'Right heel', stage:'Stage 3'}, measurements:{length:3,width:2.5,depth:0.2},
        providerReview:{providerNote:'Documented review text', reviewedByName:'NP Example'},
        esign:{signed:true, signerDisplayName:'NP Example', signerUid:'INTERNAL_SIGNER'}}}]});
    for (const id of ['INTERNAL_RECORD','INTERNAL_APPOINTMENT','INTERNAL_PATIENT','INTERNAL_AUTHOR','INTERNAL_SIGNER']) expect(html).not.toContain(id);
    expect(html).toContain('Right heel'); expect(html).toContain('Stage 3');
    expect(html).toContain('Documented review text');
    expect(html).toContain('Documented by Nurse Example'); expect(html).toContain('Electronically signed by NP Example');
    expect(html).toContain('<h2>'); expect(html).toContain('<h3>'); expect(html).toContain('<p');
  });
  it('escapes clinical narrative and does not expose nested backend identifiers', () => {
    expect(service.packetKv('Narrative','<script>test</script>')).toContain('&lt;script&gt;');
    expect(service.textValue({instructions:'Keep dressing dry',providerUid:'PRIVATE'})).not.toContain('PRIVATE');
  });
  for (const [kind, data, expected] of [
    ['assessment', {answers:{reasonForVisit:'Clinical concern', painScore:0, clinicalSummary:'GENERAL_SUMMARY'}}, 'GENERAL_SUMMARY'],
    ['systemic', {answers:{systems:{headToToe:'HEAD_TO_TOE', musculoskeletal:'MUSCULOSKELETAL', nutritionHydration:'NUTRITION'}, clinicalSummary:'SYSTEMIC_SUMMARY'}}, 'SYSTEMIC_SUMMARY'],
    ['braden', {answers:{braden:{total:16,riskText:'At risk', sensory:3, moisture:3, activity:2, mobility:3,nutrition:3,friction:2}}}, 'At risk'],
    ['carePlan', {description:'CARE_DESCRIPTION',clinicalProblems:[{category:'Nutrition', goals:['CARE_GOAL'],interventions:['CARE_INTERVENTION']}]}, 'CARE_GOAL'],
    ['order', {description:'ORDER_DESCRIPTION', frequency:'Daily', orderedBy:{displayName:'Prescriber Example',uid:'INTERNAL_UID'}}, 'ORDER_DESCRIPTION'],
    ['education', {topic:'EDUCATION_TOPIC', method:'Teach-back', readiness:'Ready', response:'Understood', notes:'EDUCATION_NOTES'}, 'EDUCATION_NOTES'],
    ['progressNote', {details:'PROGRESS_TEXT', signed:true,signatureIdentity:{displayName:'Signed Clinician'},signedAt:'2026-10-04T14:00:00Z'}, 'PROGRESS_TEXT'],
    ['visit', {visitType:'routine',performedByName:'VISIT_CLINICIAN',billingProviderName:'BILLING_CLINICIAN'}, 'VISIT_CLINICIAN'],
  ] as any[]) {
    it(`preserves the canonical ${kind} format without database identifiers`, () => {
      const html = service.renderClinicalRecord(kind,{id:'INTERNAL_RECORD',data});
      expect(html).toContain(expected); expect(html).not.toContain('INTERNAL_');
    });
  }
  it('retains false and zero clinical facts; does not promote an author into a signer', () => {
    const html = service.renderClinicalRecord('woundAssessment',{id:'secret',data:{woundBed:{slough:{present:false,percent:0}}, authorIdentity:{displayName:'Nurse Only'}}});
    expect(html).toContain('No'); expect(html).toContain('0');
    expect(html).not.toContain('Electronically signed by Nurse Only');
  });
  it('uses A4 PHWC letterhead and patient name without automatic commentary', () => {
    const html = service.documentHtml({name:'Sample Patient',dob:'1970-01-01'},[]);
    expect(html).toContain('size: A4'); expect(html).toContain('Sample Patient');
    for (const text of ['478-310-4446','478-721-9473','support@perryhomewoundcare.network']) expect(html).toContain(text);
    expect(html).not.toContain('Generated from'); expect(html).not.toContain('Verify recipient');
  });
  it('does not shift a birth date to the previous day in US time zones', () => {
    expect(service.dateOnly('1970-01-01')).toBe('01/01/1970');
  });
});
