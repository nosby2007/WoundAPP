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

describe('field telehealth camera controls', () => {
  let page: any;
  let track: any;
  beforeEach(() => {
    page = Object.create(TelehealthSessionPage.prototype);
    track = {restart: jasmine.createSpy().and.resolveTo(), disable: jasmine.createSpy(), stop: jasmine.createSpy(), attach: () => document.createElement('video')};
    Object.assign(page, {video: track, room: {}, connected: true, cameraFacing: 'user', switchingCamera: false, videoEnabled: true,
      local: {nativeElement: document.createElement('div')}});
  });
  it('switches capture on the published track, not the room or microphone', async () => {
    await page.switchCamera();
    expect(track.restart).toHaveBeenCalledWith({facingMode: {exact: 'environment'}, width: {ideal: 1280}});
    expect(page.cameraFacing).toBe('environment');
    await page.switchCamera();
    expect(page.cameraFacing).toBe('user');
    expect(page.connected).toBeTrue();
  });
  it('preserves camera-off state after switching', async () => {
    page.videoEnabled = false;
    await page.switchCamera();
    expect(track.disable).toHaveBeenCalled();
  });
  it('restores previous capture on unsupported rear camera without closing call', async () => {
    track.restart.and.returnValues(Promise.reject(new Error('unsupported')), Promise.resolve());
    await page.switchCamera();
    expect(page.cameraFacing).toBe('user');
    expect(page.error).toContain('Unable to switch');
    expect(page.connected).toBeTrue();
    expect(page.switchingCamera).toBeFalse();
  });
  it('ignores duplicate switching requests and does not reattach after leaving', async () => {
    let finish!: () => void;
    track.restart.and.returnValue(new Promise<void>(resolve => finish = resolve));
    const switching = page.switchCamera();
    await page.switchCamera();
    expect(track.restart).toHaveBeenCalledTimes(1);
    page.video = null; page.connected = false;
    finish(); await switching;
    expect(track.stop).toHaveBeenCalled();
    expect(page.local.nativeElement.children.length).toBe(0);
  });
});
