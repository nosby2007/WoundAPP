import { TestBed } from '@angular/core/testing';
import { ClinicalDocumentExportService } from './clinical-document-export.service';
import { ClinicalAuditService } from './clinical-audit.service';
import { ClinicalDocumentSnapshotService } from './clinical-document-snapshot.service';

describe('external clinical document presentation', () => {
  let service: any;
  it('only prints reviewed diagnoses, excludes erroneous facts and never prints linkage IDs', () => {
    const html = service.renderClinicalBackground({diagnostic:[
      {code:'E11.9',description:'Reviewed diagnosis',reviewStatus:'approved',patientId:'PRIVATE_PATIENT'},
      {description:'Unreviewed diagnosis',reviewStatus:'needs_review'},
      {description:'Erroneous diagnosis',reviewStatus:'approved',status:'entered_in_error'}
    ],allergy:[{description:'<latex>',reaction:'Rash'}]});
    expect(html).toContain('Reviewed diagnosis');
    expect(html).not.toContain('Unreviewed diagnosis');
    expect(html).not.toContain('Erroneous diagnosis');
    expect(html).not.toContain('PRIVATE_PATIENT');
    expect(html).toContain('&lt;latex&gt;');
    expect(html).toContain('Current clinical background');
  });
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
  it('prints only HTTPS wound photos at 300x300, escapes captions and preserves proportions', () => {
    const html = service.woundMedia({photoURL:'https://firebasestorage.googleapis.com/photo?token=example&x=1',describe:{location:'Heel <right>'}});
    expect(html).toContain('width="300" height="300"');
    expect(html).toContain('width:300px;height:300px');
    expect(html).toContain('object-fit:contain'); expect(html).toContain('Heel &lt;right&gt;');
    expect(service.woundMedia({photoURL:'javascript:alert(1)'})).not.toContain('<img');
    expect(service.woundMedia({photoURL:'http://unsafe.example/photo'})).not.toContain('<img');
  });
  it('plots documented area/depth separately, keeps zero and breaks missing-value gaps', () => {
    const html = service.woundMedia({printMeasurementHistory:[
      {assessedAt:'2026-10-01T12:00:00Z',measurements:{area:7.5,depth:0.2}},
      {assessedAt:'2026-10-02T12:00:00Z',measurements:{}},
      {assessedAt:'2026-10-03T12:00:00Z',measurements:{area:0,depth:0}}
    ]});
    expect(html).toContain('Area (cm²)'); expect(html).toContain('Depth (cm)');
    expect((html.match(/<circle /g) || []).length).toBe(4);
    expect((html.match(/<line /g) || []).length).toBe(2); // axes only, not across missing evidence
    expect(html).toContain('Not documented'); expect(html).not.toContain('NaN');
  });
  it('does not derive area from length/width or a single observation into a trend', () => {
    const html = service.woundMedia({printMeasurementHistory:[{assessedAt:'2026-10-01',measurements:{length:3,width:2,depth:0.2}}]});
    expect(html).not.toContain('<svg'); expect(html).toContain('Insufficient dated measurements');
    expect(html).toContain('Not documented');
  });
});
