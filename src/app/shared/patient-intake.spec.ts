import {
  buildPatientIntakePayload,
  intakeGaps,
  toIsoDate,
} from './patient-intake';

/**
 * These cover the two claims the intake payload makes, because both are
 * invisible if they break:
 *
 *   1. It writes the shape the WEB app reads. A field name that drifts here
 *      does not throw -- the write succeeds and the chart simply shows a
 *      blank where the address should be. So the field names are pinned.
 *   2. A blank is omitted, not stored as ''. The difference between "not
 *      collected" and "collected, empty" only shows up when someone reads
 *      the record back weeks later, which is far too late to notice.
 */
describe('buildPatientIntakePayload', () => {
  const full = {
    legalName: '  Jane Doe  ',
    preferredName: 'Janie',
    gender: 'female',
    dob: '1948-03-11',
    admissionDate: '2026-09-06',
    phone: '(478) 555-0142',
    email: 'jane@example.com',
    address1: '118 Pine Ridge Rd',
    address2: 'Apt 2',
    city: 'Warner Robins',
    state: 'GA',
    zip: '31088',
    country: 'USA',
    language: 'English',
    maritalStatus: 'Widowed',
    roomNumber: '',
    unit: '',
    ssn: '',
    idType: 'Medicare',
    idNumber: '1EG4-TE5-MK73',
    insuranceProvider: 'CareSource',
    insuranceId: 'CS9928311',
    groupNumber: '',
    payor: 'Georgia Medicaid',
    policyHolder: 'Self',
    emergencyContactName: 'Marcus Doe',
    emergencyContactPhone: '(478) 555-0199',
    emergencyRelation: 'Son',
    reasonForAdmission: 'Right heel pressure injury',
    primaryCareProvider: '',
    referringProvider: '',
    codeStatus: 'Full code',
    preferredPharmacy: '',
    heightCm: '163',
    weightKg: '71',
    allergies: ['Sulfa', ' Sulfa ', '', 'Latex'],
    diagnoses: ['Type 2 diabetes'],
    hipaaAck: true,
    privacyNoticeAck: true,
    financialAgreementAck: false,
  };

  it('writes the flat fields the web app displays from', () => {
    const p = buildPatientIntakePayload(full);

    // patient-demographic-card and the patient list read these directly.
    expect(p['name']).toBe('Jane Doe');
    expect(p['phone']).toBe('(478) 555-0142');
    expect(p['address1']).toBe('118 Pine Ridge Rd');
    expect(p['city']).toBe('Warner Robins');
    expect(p['state']).toBe('GA');
    expect(p['zip']).toBe('31088');
    expect(p['insuranceProvider']).toBe('CareSource');
    expect(p['reasonForAdmission']).toBe('Right heel pressure injury');
  });

  it('mirrors address1 into address, the way the web form does', () => {
    const p = buildPatientIntakePayload(full);
    expect(p['address']).toBe('118 Pine Ridge Rd');
  });

  it('writes the nested groups the web edit form reads back', () => {
    const p = buildPatientIntakePayload(full, {orgId: 'PHWC', facilityId: 'fac-1'});

    const demographics = p['demographics'] as Record<string, unknown>;
    expect(demographics['legalName']).toBe('Jane Doe');
    expect(demographics['zip']).toBe('31088');
    expect(demographics['facilityId']).toBe('fac-1');

    const identity = p['identity'] as Record<string, unknown>;
    expect(identity['insuranceId']).toBe('CS9928311');
    expect(identity['emergencyContactPhone']).toBe('(478) 555-0199');

    const clinical = p['clinical'] as Record<string, unknown>;
    expect(clinical['codeStatus']).toBe('Full code');
    expect(clinical['diagnoses']).toEqual(['Type 2 diabetes']);
  });

  it('omits what was not filled in rather than storing an empty string', () => {
    const p = buildPatientIntakePayload({legalName: 'John Roe'});

    expect(p['name']).toBe('John Roe');
    // Not '' -- nobody asked, so the chart says nothing.
    expect('address1' in p).toBe(false);
    expect('phone' in p).toBe(false);
    expect('ssn' in p).toBe(false);
    expect('demographics' in p).toBe(true); // legalName alone still populates it
    expect('identity' in p).toBe(false);
    expect('clinical' in p).toBe(false);
  });

  it('trims and de-duplicates list fields, and drops them when empty', () => {
    const p = buildPatientIntakePayload(full);
    expect(p['allergies']).toEqual(['Sulfa', 'Latex']);

    const none = buildPatientIntakePayload({legalName: 'A', allergies: ['', '  ']});
    expect('allergies' in none).toBe(false);
  });

  it('always writes all three consent booleans, including the unticked one', () => {
    const p = buildPatientIntakePayload(full);
    expect(p['consent']).toEqual({
      hipaaAck: true,
      privacyNoticeAck: true,
      financialAgreementAck: false,
    });
    // An unticked box is a recorded false, not a missing key.
    expect(p['financialAgreementAck']).toBe(false);

    const bare = buildPatientIntakePayload({legalName: 'A'});
    expect(bare['consent']).toEqual({
      hipaaAck: false,
      privacyNoticeAck: false,
      financialAgreementAck: false,
    });
  });

  it('never lets the payload decide the tenant', () => {
    // orgId is sent for parity with the existing form, but the API strips it
    // and stamps its own from the caller's token. This pins that we are not
    // relying on it being honoured.
    const p = buildPatientIntakePayload({legalName: 'A'}, {orgId: 'PHWC'});
    expect(p['orgId']).toBe('PHWC');
  });
});

describe('toIsoDate', () => {
  it('converts a date input value to ISO', () => {
    expect(toIsoDate('1948-03-11')).toBe('1948-03-11T00:00:00.000Z');
  });

  it('returns null for blank and for unparseable input', () => {
    expect(toIsoDate('')).toBeNull();
    expect(toIsoDate('   ')).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    // Not 'Invalid Date' in the chart.
    expect(toIsoDate('not a date')).toBeNull();
  });
});

describe('intakeGaps', () => {
  it('names what a later step actually fails without', () => {
    expect(intakeGaps({legalName: 'A'})).toEqual([
      'Home address',
      'Date of birth',
      'Insurance / payer',
    ]);
  });

  it('treats a part-filled address as still missing', () => {
    const gaps = intakeGaps({
      legalName: 'A',
      address1: '118 Pine Ridge Rd',
      city: 'Warner Robins',
      // no state, no zip
      dob: '1948-03-11',
      payor: 'Georgia Medicaid',
    });
    expect(gaps).toEqual(['Home address']);
  });

  it('is empty once the three are present', () => {
    const gaps = intakeGaps({
      legalName: 'A',
      address1: '118 Pine Ridge Rd',
      city: 'Warner Robins',
      state: 'GA',
      zip: '31088',
      dob: '1948-03-11',
      insuranceProvider: 'CareSource',
    });
    expect(gaps).toEqual([]);
  });
});
