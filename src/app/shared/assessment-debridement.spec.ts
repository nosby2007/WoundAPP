import { FormBuilder } from '@angular/forms';
import { assessmentDebridementGroup, assessmentDebridementPayload } from './assessment-debridement';
import { buildWoundProgressNote } from './wound-progress-note';

describe('field assessment debridement', () => {
  it('starts unrecorded, with no invented procedure or measurements', () => {
    const group = assessmentDebridementGroup(new FormBuilder());
    expect(assessmentDebridementPayload(group.getRawValue())).toBeNull();
    expect(group.controls.postMeasurements.controls.depth.value).toBeNull();
    expect(group.controls.areaDebridedCm2.value).toBeNull();
  });
  it('round trips canonical JADE fields and includes them in the generated note', () => {
    const group = assessmentDebridementGroup(new FormBuilder());
    group.patchValue({ performed: true, instrument: 'Curette', tissueLevel: 'Slough only',
      areaDebridedCm2: 1.56, hemostasis: 'Compression', postMeasurements: { depth: 0.4 } });
    const procedure = assessmentDebridementPayload(group.getRawValue());
    const loaded = assessmentDebridementGroup(new FormBuilder());
    loaded.patchValue(procedure);
    expect(assessmentDebridementPayload(loaded.getRawValue())).toEqual(procedure);
    const note = buildWoundProgressNote({ visitKind: 'follow_up', patient: { name: 'Test' },
      wounds: [{ woundId: 'w1', location: 'Heel', measurements: {}, orders: [], debridementProcedure: procedure }],
      education: [], recordedAt: new Date(), recordedByName: 'Test RN' } as any);
    expect(note).toContain('Curette');
    expect(note).toContain('1.56 cm²');
    expect(note).toContain('0.4 cm');
    expect(procedure.postMeasurements.area).toBeNull();
    expect(procedure.consentObtained).toBeNull();
  });
  it('does not persist hidden stale procedure details when unchecked', () => {
    expect(assessmentDebridementPayload({ performed: false, instrument: 'Scalpel',
      areaDebridedCm2: 28 })).toEqual({ performed: false });
    const group = assessmentDebridementGroup(new FormBuilder());
    group.patchValue({ performed: true, areaDebridedCm2: -1 });
    expect(group.invalid).toBeTrue();
    group.controls.performed.setValue(false);
    expect(group.valid).toBeTrue();
    expect(assessmentDebridementPayload(group.getRawValue())).toEqual({ performed: false });
  });
  it('rejects negative values and preserves documented zero', () => {
    const group = assessmentDebridementGroup(new FormBuilder());
    group.patchValue({ performed: true, areaDebridedCm2: -1 });
    expect(group.invalid).toBeTrue();
    group.patchValue({ areaDebridedCm2: 0 });
    expect(group.valid).toBeTrue();
    expect(assessmentDebridementPayload(group.getRawValue()).areaDebridedCm2).toBe(0);
  });
});
