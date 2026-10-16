import { ClinicalDataService } from './clinical-data.service';
import { ClinicalDataProvider } from './clinical-data-provider';

describe('ClinicalDataService', () => {
  it('delegates to the configured provider without changing returned data', async () => {
    const provider: ClinicalDataProvider = {
      getPatient: async () => ({ id: 'p1', name: 'Patient One' }),
      getClinicalContext: async () => ({ diagnoses: [], medicalHistory: [], allergies: [] }),
      getEncounterContext: async () => ({ medications: [], activeOrders: [], vascular: [], systemic: [] }),
      listPatientDocuments: async () => [{ id: 'd1', name: 'Referral.pdf', url: 'https://example.test/doc', path: 'patients/p1/documents/d1/Referral.pdf' }],
      uploadPatientDocuments: async () => undefined,
    };

    const service = new ClinicalDataService(provider);
    expect((await service.getPatient('p1')).name).toBe('Patient One');
    expect((await service.listPatientDocuments('p1'))[0].id).toBe('d1');
    expect((await service.getClinicalContext('p1')).diagnoses).toEqual([]);
  });
});
