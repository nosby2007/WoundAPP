import { positionForZone } from './wound-anatomy';
import { WoundBodyMapComponent } from './wound-body-map.component';

describe('WoundBodyMapComponent', () => {
  it('uses the patient chart profile ahead of an older saved avatar preference', () => {
    const component = new WoundBodyMapComponent();
    component.position = positionForZone('front-head', 'female');
    component.patientProfile = 'male';
    component.ngOnChanges();

    expect(component.profile).toBe('male');
    expect(component.avatarSrc).toBe('assets/body-map/male-front.png');
  });

  it('rotates front to back and constrains zoom', () => {
    const component = new WoundBodyMapComponent();
    component.rotateView();
    expect(component.view).toBe('back');

    for (let index = 0; index < 10; index++) component.zoomIn();
    expect(component.zoom).toBe(2);
    for (let index = 0; index < 10; index++) component.zoomOut();
    expect(component.zoom).toBe(1);
  });
});
