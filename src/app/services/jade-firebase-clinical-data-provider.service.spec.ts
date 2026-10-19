import { JadeFirebaseClinicalDataProvider } from './jade-firebase-clinical-data-provider.service';

describe('JadeFirebaseClinicalDataProvider', () => {
  it('delegates to the existing PatientService unchanged', async () => {
    const patients = {
      getPatient: jasmine.createSpy().and.resolveTo({ id: 'p1', name: 'Patient One' }),
    } as any;

    const provider = new JadeFirebaseClinicalDataProvider(patients);
    expect((await provider.getPatient('p1')).id).toBe('p1');
    expect(patients.getPatient).toHaveBeenCalledWith('p1');
  });
});
