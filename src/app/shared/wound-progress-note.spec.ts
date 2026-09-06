import {
  ageInYears,
  buildWoundProgressNote,
  defaultReasonForConsult,
  defaultRecommendation,
  noteDateTime,
  WoundNoteInput,
  WoundNoteWound,
} from './wound-progress-note';

/**
 * The note is built from the chart rather than retyped beside it, so what
 * these pin is that it says what the chart says -- and, just as importantly,
 * that it does not say anything the chart does not.
 *
 * All data below is invented for the test. No patient record, real or
 * supplied, appears in this file.
 */
const wound = (over: Partial<WoundNoteWound> = {}): WoundNoteWound => ({
  woundId: 'w1',
  type: 'Pressure',
  location: 'Right heel',
  acquired: 'Present on Admission',
  stage: 'Stage 2',
  firstAssessedAt: new Date(2026, 8, 1, 9, 5),
  assessedAt: new Date(2026, 8, 6, 14, 30),
  measurements: { length: 3, width: 2, depth: 0.1, area: 6, volume: 0.6 },
  woundBed: null,
  exudate: null,
  periwound: null,
  pain: null,
  progress: null,
  treatment: null,
  goalOfCare: null,
  orders: [],
  ...over,
});

const input = (over: Partial<WoundNoteInput> = {}): WoundNoteInput => ({
  visitKind: 'admission',
  reasonForConsult: defaultReasonForConsult('admission'),
  recommendation: defaultRecommendation('admission'),
  patient: { name: 'Test Patient', dob: '1972-04-18', gender: 'female' },
  bradenTotal: 15,
  bradenRiskText: 'At risk',
  wounds: [wound()],
  education: [],
  recordedByName: 'A. Nurse',
  recordedAt: new Date(2026, 8, 6, 18, 16),
  ...over,
});

describe('wound progress note', () => {
  describe('the two clinician choices', () => {
    it('says start on an admission and continue on a review', () => {
      // "Continue" on a first visit claims a plan of care that did not exist
      // yet, which is why this is a choice and not a constant.
      expect(defaultRecommendation('admission')).toBe('Start treatment and prevention plan of care');
      expect(defaultRecommendation('follow_up')).toBe('Continue treatment and prevention plan of care');
    });

    it('names the visit the way it will be billed', () => {
      expect(defaultReasonForConsult('admission')).toBe('Admission visit wound evaluation and treat');
      expect(defaultReasonForConsult('follow_up')).toBe('Weekly skin and wound evaluation');
    });
  });

  describe('ageInYears', () => {
    it('does not count a birthday that has not happened yet', () => {
      expect(ageInYears('1972-04-18', new Date(2026, 3, 17))).toBe(53);
      expect(ageInYears('1972-04-18', new Date(2026, 3, 18))).toBe(54);
    });

    it('returns null rather than a number it cannot support', () => {
      expect(ageInYears(null, new Date())).toBeNull();
      expect(ageInYears('not a date', new Date())).toBeNull();
    });
  });

  describe('noteDateTime', () => {
    it('uses the template format', () => {
      expect(noteDateTime(new Date(2026, 8, 4, 16, 44))).toBe('09/04/26 1644');
    });

    it('is empty rather than "Invalid Date"', () => {
      expect(noteDateTime(null)).toBe('');
      expect(noteDateTime(new Date('nope'))).toBe('');
    });
  });

  describe('what the note says', () => {
    it('carries the measurements straight from the assessment', () => {
      const note = buildWoundProgressNote(input());
      expect(note).toContain('Wound Length (cm)\t3 cm');
      expect(note).toContain('Wound Surface Area (cm^2)\t6 cm^2');
      expect(note).toContain('Wound Pressure Right heel');
    });

    it('states the patient in the template\'s words', () => {
      const note = buildWoundProgressNote(input());
      expect(note).toContain('Test Patient is a 54 y.o. female');
      expect(note).toContain('Braden Scale Score: 15 — At risk');
    });

    it('says "on file" for the sections a reader checks for absence', () => {
      // A missing allergy section reads as "not asked". "No known allergies
      // on file" reads as asked and empty, and only one of those is true.
      const note = buildWoundProgressNote(input({
        patient: { name: 'Test Patient', dob: '1972-04-18', gender: 'female' },
      }));
      expect(note).toContain('No known allergies on file.');
      expect(note).toContain('No past medical history on file.');
      expect(note).toContain('No past surgical history on file.');
      expect(note).toContain('No active problems on file.');
    });

    it('omits a wound finding nobody recorded, rather than printing a dash', () => {
      // A row of em dashes reads as a list of negative findings. Nobody made
      // them.
      const note = buildWoundProgressNote(input());
      expect(note).not.toContain('Exudate Type');
      expect(note).not.toContain('Periwound Skin Edema');
      expect(note).not.toContain('Primary Dressing');
    });

    it('prints the findings that were recorded', () => {
      const note = buildWoundProgressNote(input({
        wounds: [wound({
          exudate: { amount: 'Moderate', type: 'Serous', odor: 'None' },
          treatment: { primary: 'Foam', cleansing: 'Normal Saline', additionalCare: ['Float heels'] },
          progress: { status: 'Improving', infection: 'None' },
        })],
      }));
      expect(note).toContain('Exudate Type\tSerous');
      expect(note).toContain('Exudate Amount\tModerate');
      expect(note).toContain('Primary Dressing\tFoam');
      expect(note).toContain('Additional Care\tFloat heels');
      expect(note).toContain('Status\tImproving');
    });

    it('says so when a wound has no orders', () => {
      expect(buildWoundProgressNote(input())).toContain('No associated orders.');
    });

    it('reproduces an order as written, with who ordered it', () => {
      // The description is stored multi-line by the order set dialog and each
      // line is a separate instruction somebody has to carry out, so it is
      // not flattened.
      const note = buildWoundProgressNote(input({
        wounds: [wound({
          orders: [{
            orderedAt: new Date(2026, 8, 4, 18, 16),
            orderType: 'wound_care_order_set',
            description: 'Wound cleanser: Normal Saline\nApply to wound: Foam',
            orderedByName: 'R. Provider, NP',
          }],
        })],
      }));
      expect(note).toContain('Active Orders');
      expect(note).toContain('09/04/26 1816 — R. Provider, NP');
      expect(note).toContain('Wound cleanser: Normal Saline\nApply to wound: Foam');
    });

    it('covers every wound of the visit, not just the first', () => {
      const note = buildWoundProgressNote(input({
        wounds: [
          wound({ woundId: 'w1', type: 'Pressure', location: 'Right heel' }),
          wound({ woundId: 'w2', type: 'Skin Tear', location: 'Left forearm' }),
        ],
      }));
      expect(note).toContain('Wound Pressure Right heel');
      expect(note).toContain('Wound Skin Tear Left forearm');
    });

    it('says when nothing was assessed rather than printing an empty section', () => {
      expect(buildWoundProgressNote(input({ wounds: [] })))
        .toContain('No wounds assessed on this visit.');
    });

    it('says when no Braden was taken', () => {
      const note = buildWoundProgressNote(input({ bradenTotal: null, bradenRiskText: null }));
      expect(note).toContain('No Braden score recorded.');
      expect(note).not.toContain('Braden Scale Score: 0');
    });

    it('includes the education given on this visit, and nothing when there was none', () => {
      const withEducation = buildWoundProgressNote(input({
        education: [{ topic: 'Pressure relief', learners: ['Patient'], response: ['Verbalizes Understanding'] }],
      }));
      expect(withEducation).toContain('Education provided this visit:');
      expect(withEducation).toContain('Pressure relief');
      expect(withEducation).toContain('Taught to: Patient');

      expect(buildWoundProgressNote(input())).not.toContain('Education provided this visit:');
    });

    it('names who recorded it and when', () => {
      const note = buildWoundProgressNote(input());
      expect(note).toContain('Recorded by: A. Nurse');
      expect(note).toContain('Date: 09/06/26 1816');
    });
  });
});
