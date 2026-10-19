import { ClinicalDataService } from './clinical-data.service';
import { ClinicalDataProvider } from './clinical-data-provider';

describe('ClinicalDataService', () => {
  it('delegates patient reads to the configured provider', async () => {
    const provider: ClinicalDataProvider = {
      getPatient: async () => ({ id: 'p1', name: 'Patient One' }),
    };

    const service = new ClinicalDataService(provider);
    expect((await service.getPatient('p1')).name).toBe('Patient One');
  });
});
