import { matchesClinicalVisitLink } from './clinical-visit-link';
describe('shared clinical encounter linkage', () => {
  it('uses the same visit regardless of RN/NP author', () => {
    for (const uid of ['rn','np']) expect(matchesClinicalVisitLink({id:'assessment',visitId:'visit',createdByUid:uid},{visitId:'visit'})).toBeTrue();
  });
  it('does not reuse an assessment from a conflicting visit with the same appointment', () => {
    expect(matchesClinicalVisitLink({id:'a',visitId:'other',appointmentId:'appt'},{visitId:'visit',appointmentId:'appt'})).toBeFalse();
  });
  it('supports explicit encounter aliases and legacy appointment-only records', () => {
    expect(matchesClinicalVisitLink({fieldEncounterVisitId:'v'},{visitId:'v'})).toBeTrue();
    expect(matchesClinicalVisitLink({id:'a',appointmentId:'appt'},{visitId:'v',appointmentId:'appt'})).toBeTrue();
    expect(matchesClinicalVisitLink({id:'a'},{})).toBeFalse();
  });
});
