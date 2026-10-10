import {TelehealthConsultListComponent, canResumeFieldConsult} from './telehealth-consult-list.component';

describe('field consultation resumption', () => {
  const appointment: any = {id: 'existing', patientName: 'Synthetic', startIso: '2020-01-01', status: 'scheduled', sessionState: 'waiting'};
  let page: TelehealthConsultListComponent;
  let service: any;
  let router: any;
  beforeEach(() => {
    service = {listFacilitatorAppointments: jasmine.createSpy().and.resolveTo({appointments: [appointment], nextCursor: null})};
    router = {navigate: jasmine.createSpy().and.resolveTo(true)};
    page = new TelehealthConsultListComponent(service, router);
  });
  it('reloads persisted requests and opens the existing appointment without creation', async () => {
    await page.refresh(); await page.resume(page.appointments[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/tabs/telehealth/session', 'existing']);
  });
  it('Today includes pending requests from earlier days, but not terminal visits', async () => {
    page.openOnly = true; await page.refresh();
    expect(page.visibleAppointments.length).toBe(1);
    for (const sessionState of ['ended', 'cancelled', 'failed']) expect(canResumeFieldConsult({...appointment, sessionState})).toBeFalse();
    expect(canResumeFieldConsult({...appointment, status: 'cancelled'})).toBeFalse();
  });
  it('loads the next page and clears stale data on a failed refresh', async () => {
    await page.refresh(); page.nextCursor = 'cursor';
    service.listFacilitatorAppointments.and.resolveTo({appointments: [], nextCursor: null});
    await page.refresh(true);
    expect(service.listFacilitatorAppointments).toHaveBeenCalledWith('cursor');
    service.listFacilitatorAppointments.and.rejectWith(new Error('Offline'));
    await page.refresh(); expect(page.appointments).toEqual([]); expect(page.error).toContain('Offline');
  });
});
