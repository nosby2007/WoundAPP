import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { WoundCodingSectionComponent } from './wound-coding-section.component';
import { ClinicalCoding, emptyClinicalCoding } from './clinical-coding';

@Component({
  standalone: true,
  imports: [WoundCodingSectionComponent],
  template: '<app-wound-coding-section [coding]="coding" woundId="synthetic-wound" (codingChange)="coding = $event"></app-wound-coding-section>',
})
class CodingHost { coding: ClinicalCoding = emptyClinicalCoding(); }

describe('Wound coding input stability', () => {
  it('preserves Ionic controls across every parent/autosave echo', async () => {
    await TestBed.configureTestingModule({ imports: [CodingHost] }).compileComponents();
    const fixture = TestBed.createComponent(CodingHost);
    fixture.detectChanges();
    const component = fixture.debugElement.query(By.directive(WoundCodingSectionComponent)).componentInstance as WoundCodingSectionComponent;
    component.addDiagnosis();
    component.addProcedure();
    fixture.detectChanges();
    await fixture.whenStable();
    for (const [index, code] of [[0, 'L89.153'], [1, '97597']] as const) {
      const row = fixture.debugElement.queryAll(By.css('.row'))[index];
      const codeControl = row.queryAll(By.css('ion-input'))[0];
      const description = row.queryAll(By.css('ion-input'))[1];
      for (let length = 1; length <= code.length; length++) {
        codeControl.triggerEventHandler('ngModelChange', code.slice(0, length));
        fixture.detectChanges();
        await fixture.whenStable();
        expect(fixture.debugElement.queryAll(By.css('.row'))[index].nativeElement).toBe(row.nativeElement);
        expect(row.queryAll(By.css('ion-input'))[0].nativeElement).toBe(codeControl.nativeElement);
      }
      description.triggerEventHandler('ngModelChange', 'Synthetic ');
      fixture.detectChanges();
      await fixture.whenStable();
      expect((index === 0 ? fixture.componentInstance.coding.diagnoses : fixture.componentInstance.coding.procedures)[0].description).toBe('Synthetic ');
    }
    expect(fixture.componentInstance.coding.diagnoses[0].code).toBe('L89.153');
    expect(fixture.componentInstance.coding.procedures[0].code).toBe('97597');
    fixture.destroy();
  });
});
