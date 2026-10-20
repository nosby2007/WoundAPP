import { SchedulerWorkspacePage } from './scheduler-workspace.page';

describe('Scheduler billing selection', () => {
  let page: SchedulerWorkspacePage;
  let scheduler: any;
  beforeEach(async () => {
    scheduler = {
      upcoming: jasmine.createSpy().and.resolveTo([{ id: 'existing', patientId: 'patient-1', status: 'scheduled' }]),
      listAssignableStaff: jasmine.createSpy().and.resolveTo([{ uid: 'rn-1', displayName: 'RN', role: 'nurse' }]),
      billingOptions: jasmine.createSpy().and.resolveTo({ providers: [{ uid: 'np-1', displayName: 'NP', role: 'np', npi: '0123456789' }],
        entities: [{ id: 'org-a', name: 'Group', npi: '1234567890' }] }),
      createAppointment: jasmine.createSpy().and.resolveTo('new-visit'),
      updateScheduledAppointment: jasmine.createSpy().and.resolveTo(),
      toDate: (value: any) => value ? new Date(value) : null,
    };
    page = new SchedulerWorkspacePage(scheduler, { listPatients: async () => [{ id: 'patient-1', name: 'Synthetic patient' }] } as any, {} as any);
    await page.load();
    page.newAppointment();
    page.form.patientId = 'patient-1';
    page.form.assignedToUid = 'rn-1';
  });
  it('requires explicit entity and provider selections', async () => {
    await page.saveAppointment();
    expect(scheduler.createAppointment).not.toHaveBeenCalled();
    expect(page.error).toContain('billing entity');
  });
  it('passes identifiers separately from the assigned RN and displays success after refresh', async () => {
    page.form.billingEntityId = 'org-a'; page.form.billingProviderUid = 'np-1';
    await page.saveAppointment();
    expect(scheduler.createAppointment.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ assignedToUid: 'rn-1', billingProviderUid: 'np-1', billingEntityId: 'org-a' }));
    expect(page.editorOpen).toBeFalse();
    expect(page.message).toBe('Appointment created.');
  });
  it('rejects an entity not in this tenant configuration', async () => {
    page.form.billingEntityId = 'org-b'; page.form.billingProviderUid = 'np-1';
    await page.saveAppointment();
    expect(scheduler.createAppointment).not.toHaveBeenCalled();
  });
  it('preserves the editor and selections on failed writes', async () => {
    page.form.billingEntityId = 'org-a'; page.form.billingProviderUid = 'np-1';
    scheduler.createAppointment.and.rejectWith(new Error('Permission denied'));
    await page.saveAppointment();
    expect(page.editorOpen).toBeTrue(); expect(page.form.billingEntityId).toBe('org-a');
    expect(page.message).toBe(''); expect(page.error).toBe('Permission denied');
  });
  it('does not hide the schedule when billing configuration cannot be loaded', async () => {
    scheduler.billingOptions.and.rejectWith(new Error('Permission denied'));
    await page.load();
    expect(page.visits.length).toBe(1); expect(page.billingError).toContain('Unable to load');
    expect(page.billingEntities).toEqual([]);
  });
  it('does not silently reuse billing identities when replanning a legacy visit', () => {
    page.replanAppointment({ id: 'old', patientId: 'patient-1', assignedToUid: 'rn-1', billingProviderUid: 'old-np', billingEntityId: 'old-org' });
    expect(page.form.billingProviderUid).toBe(''); expect(page.form.billingEntityId).toBe('');
  });
  it('rescheduling leaves existing billing attribution unchanged', async () => {
    page.editAppointment({ id: 'old', status: 'scheduled', patientId: 'patient-1', assignedToUid: 'rn-1', start: new Date(), end: new Date(Date.now()+3600000), billingEntityName: 'Legacy Group' });
    await page.saveAppointment();
    expect(scheduler.updateScheduledAppointment).toHaveBeenCalled();
    expect(scheduler.updateScheduledAppointment.calls.mostRecent().args[1].billingEntityId).toBeUndefined();
    expect(scheduler.createAppointment).not.toHaveBeenCalled();
  });
});
