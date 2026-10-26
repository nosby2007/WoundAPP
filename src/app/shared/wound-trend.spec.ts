import { percentChange, trendPolyline, woundTrend } from './wound-trend';

describe('wound trends', () => {
  const assessment = (date: string, area: number | null) => ({
    id: date,
    assessedAt: new Date(date),
    measurements: { length: null, width: null, depth: null, area, volume: null },
  });

  it('sorts numeric observations and preserves a documented zero', () => {
    const points = woundTrend([
      assessment('2026-01-03', 0),
      assessment('2026-01-01', 10),
      assessment('2026-01-02', null),
    ], 'area');
    expect(points.map(point => point.value)).toEqual([10, 0]);
    expect(percentChange(points)).toBe(-100);
  });

  it('creates bounded chart coordinates without inventing missing values', () => {
    const points = woundTrend([assessment('2026-01-01', 8), assessment('2026-01-02', 4)], 'area');
    expect(trendPolyline(points)).toBe('5.00,5.00 95.00,41.00');
    expect(trendPolyline([])).toBe('');
  });
});
