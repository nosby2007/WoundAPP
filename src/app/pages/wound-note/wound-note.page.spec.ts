import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pageTestProviders } from '../../../testing/page-test-providers';
import { WoundNotePage } from './wound-note.page';

describe('WoundNotePage', () => {
  let component: WoundNotePage;
  let fixture: ComponentFixture<WoundNotePage>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: pageTestProviders({ patientId: 'p1' }) });
    fixture = TestBed.createComponent(WoundNotePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('stops rewriting the note once the clinician has edited it', () => {
    // Overwriting a correction because a dropdown moved would lose work
    // silently, which is the fastest way to make a generated note untrusted.
    component.snapshot = {
      visitKind: 'admission', firstVisit: true,
      reasonForConsult: 'x', recommendation: 'y',
      patient: { name: 'Test Patient' },
      bradenTotal: null, bradenRiskText: null,
      wounds: [], education: [],
      recordedByName: 'A. Nurse', recordedAt: new Date(2026, 8, 6, 12, 0),
    };

    component.visitKind = 'admission';
    component.onVisitKindChange();
    const generated = component.noteText;
    expect(generated).toContain('Admission visit wound evaluation and treat');

    component.noteText = 'my own words';
    component.onNoteEdited();
    component.visitKind = 'follow_up';
    component.onVisitKindChange();
    expect(component.noteText).toBe('my own words');

    // ...and gives it back deliberately, when asked.
    component.rebuild();
    expect(component.noteText).toContain('Weekly skin and wound evaluation');
  });
});
