import { JadeFirebaseClinicalDataProvider } from './jade-firebase-clinical-data-provider.service';

describe('JadeFirebaseClinicalDataProvider', () => {
  it('delegates to existing production services without changing persistence behavior', async () => {
    const patients = {
      getPatient: jasmine.createSpy().and.resolveTo({ id: 'p1', name: 'Patient One' }),
    } as any;
    const documents = {
      list: jasmine.createSpy().and.resolveTo([{ id: 'd1', name: 'Referral.pdf', url: 'u', path: 'p' }]),
      upload: jasmine.createSpy().and.resolveTo(undefined),
    } as any;
    const clinicalContext = {
      load: jasmine.createSpy().and.resolveTo({ diagnoses: [], medicalHistory: [], allergies: [] }),
    } as any;
    const encounterContext = {
      load: jasmine.createSpy().and.resolveTo({ medications: [], activeOrders: [], vascular: [], systemic: [] }),
    } as any;

    const provider = new JadeFirebaseClinicalDataProvider(
      patients,
      documents,
      clinicalContext,
      encounterContext,
    );

    expect((await provider.getPatient('p1')).id).toBe('p1');
    expect((await provider.listPatientDocuments('p1')).length).toBe(1);
    await provider.uploadPatientDocuments('p1', [] as File[], { type: 'referral' });
    expect(documents.upload).toHaveBeenCalledWith('p1', [], { type: 'referral' });
    expect((await provider.getClinicalContext('p1')).diagnoses).toEqual([]);
    expect(clinicalContext.load).toHaveBeenCalledWith('p1');
    expect((await provider.getEncounterContext('p1')).activeOrders).toEqual([]);
  });
});