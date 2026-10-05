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
});
