import { TelehealthSessionPage } from './telehealth-session.page';

describe('mobile telehealth session safety', () => {
  let page: TelehealthSessionPage;
  let service: any;
  beforeEach(() => {
    service = {videoToken: jasmine.createSpy('token'), consent: jasmine.createSpy('consent'), session: jasmine.createSpy('session')};
    const drafts = {
      save: jasmine.createSpy('save').and.resolveTo(),
      load: jasmine.createSpy('load').and.resolveTo(null),
      clear: jasmine.createSpy('clear').and.resolveTo(),
    };
    const notes = {
      getDraft: jasmine.createSpy('getDraft').and.resolveTo(null),
      updateDraft: jasmine.createSpy('updateDraft').and.resolveTo(),
      create: jasmine.createSpy('create').and.resolveTo('note-1'),
    };
    page = new TelehealthSessionPage(
      service,
      drafts as any,
      notes as any,
      {snapshot: {paramMap: {get: () => 'appointment'}}} as any,
    );
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
  it('switches the published video track to the rear camera without leaving the room', async () => {
    const track = {
      restart: jasmine.createSpy('restart').and.resolveTo(),
      disable: jasmine.createSpy('disable'),
      stop: jasmine.createSpy('stop'),
      attach: jasmine.createSpy('attach').and.returnValue(document.createElement('video')),
    };
    (page as any).video = track;
    (page as any).room = {};
    page.cameraCount = 2;
    page.cameraFacing = 'user';
    await page.switchCamera();
    expect(track.restart).toHaveBeenCalledWith({ facingMode: { exact: 'environment' }, width: { ideal: 1280 } });
    expect(page.cameraFacing).toBe('environment');
    expect((page as any).room).toBeTruthy();
  });

  it('preserves camera-off state while flipping cameras', async () => {
    const track = {
      restart: jasmine.createSpy('restart').and.resolveTo(),
      disable: jasmine.createSpy('disable'),
      stop: jasmine.createSpy('stop'),
      attach: jasmine.createSpy('attach').and.returnValue(document.createElement('video')),
    };
    (page as any).video = track;
    (page as any).room = {};
    page.cameraCount = 2;
    page.videoEnabled = false;
    await page.switchCamera();
    expect(track.disable).toHaveBeenCalled();
  });

  it('keeps the consultation room open when camera switching fails', async () => {
    const track = {
      restart: jasmine.createSpy('restart').and.returnValues(Promise.reject(new Error('unsupported')), Promise.resolve()),
      disable: jasmine.createSpy('disable'),
      stop: jasmine.createSpy('stop'),
      attach: jasmine.createSpy('attach').and.returnValue(document.createElement('video')),
    };
    (page as any).video = track;
    (page as any).room = {};
    page.cameraCount = 2;
    await page.switchCamera();
    expect(page.error).toContain('Unable to switch cameras');
    expect((page as any).room).toBeTruthy();
    expect(page.switchingCamera).toBeFalse();
  });
});