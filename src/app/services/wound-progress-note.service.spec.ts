import { WoundProgressNoteService } from './wound-progress-note.service';

describe('WoundProgressNoteService assessment mapping', () => {
  it('passes the canonical procedure through without deriving or mutating facts', () => {
    const service = Object.create(WoundProgressNoteService.prototype) as any;
    const procedure = Object.freeze({
      performed: true, instrument: 'Curette', tissueLevel: 'Slough only',
      areaDebridedCm2: 1.56, postMeasurements: Object.freeze({ depth: 0.4 }),
    });
    const assessment = Object.freeze({
      id: 'a1', woundId: 'w1', measurements: { depth: 1.5, area: 28 },
      debridementProcedure: procedure,
    });
    const mapped = service.toNoteWound(assessment, new Map());
    expect(mapped.debridementProcedure).toBe(procedure);
    expect(mapped.debridementProcedure.areaDebridedCm2).toBe(1.56);
    expect(mapped.measurements.depth).toBe(1.5);
    expect(mapped.debridementProcedure.postMeasurements.depth).toBe(0.4);
  });

  it('keeps historical assessments without procedure data readable', () => {
    const service = Object.create(WoundProgressNoteService.prototype) as any;
    const mapped = service.toNoteWound({ id: 'a1', treatment: { debridement: 'Sharp' } }, new Map());
    expect(mapped.debridementProcedure).toBeNull();
    expect(mapped.treatment.debridement).toBe('Sharp');
  });
});
