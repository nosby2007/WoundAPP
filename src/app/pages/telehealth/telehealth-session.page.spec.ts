import { TelehealthSessionPage } from './telehealth-session.page';

describe('mobile telehealth session safety', () => {
  let page: TelehealthSessionPage;
  let service: any;
  beforeEach(() => {
    service = {videoToken: jasmine.createSpy('token'), consent: jasmine.createSpy('consent'), session: jasmine.createSpy('session')};
    page = new TelehealthSessionPage(service, {snapshot: {paramMap: {get: () => 'appointment'}}} as any);
    page.session = {id: 'session', state: 'waiting', consentStatus: 'pending', participant: 'facilitator'} as any;
  });
  it('does not request a token without accepted consent', async () => {
    await page.join();
    expect(service.videoToken).not.toHaveBeenCalled();
  });
  it('does not record unconfirmed patient presence or consent', async () => {
    await page.recordConsent();
    expect(service.consent).not.toHaveBeenCalled();
  });
  it('stops camera and microphone when navigating away', () => {
    const audio = {stop: jasmine.createSpy('audioStop')};
    const video = {stop: jasmine.createSpy('videoStop')};
    (page as any).audio = audio; (page as any).video = video;
    page.connected = true;
    page.ionViewWillLeave();
    expect(audio.stop).toHaveBeenCalled(); expect(video.stop).toHaveBeenCalled();
    expect(page.connected).toBeFalse();
  });
  it('disconnects when session access can no longer be verified', async () => {
    service.session.and.rejectWith(new Error('Access denied'));
    page.connected = true;
    await page.refresh();
    expect(page.connected).toBeFalse(); expect(page.error).toContain('Access denied');
  });
});
