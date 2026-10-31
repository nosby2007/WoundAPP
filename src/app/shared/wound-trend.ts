import { MobileAssessment } from '../services/assessments.service';

export type WoundMeasurementKey = 'length' | 'width' | 'depth' | 'area' | 'volume';

export interface WoundTrendPoint {
  assessedAt: Date;
  value: number;
}
export function woundTrend(assessments: MobileAssessment[], key: WoundMeasurementKey): WoundTrendPoint[] {
  return assessments
    .filter(item => item.assessedAt instanceof Date && item.measurements?.[key] !== null && item.measurements?.[key] !== undefined)
    .map(item => ({ assessedAt: item.assessedAt as Date, value: Number(item.measurements?.[key]) }))
    .filter(item => Number.isFinite(item.value))
    .sort((left, right) => left.assessedAt.getTime() - right.assessedAt.getTime());
}

export function trendPolyline(
  points: WoundTrendPoint[],
  width = 100,
  height = 46,
  padding = 5,
  domain?: { min: number; max: number },
): string {
  if (!points.length) return '';
  const values = points.map(point => point.value);
  const min = domain?.min ?? Math.min(...values);
  const max = domain?.max ?? Math.max(...values);
  const range = max - min;
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = range === 0 ? height / 2 : height - padding - ((point.value - min) / range) * (height - padding * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

export function percentChange(points: WoundTrendPoint[]): number | null {
  if (points.length < 2 || points[0].value === 0) return null;
  return Number((((points.at(-1)!.value - points[0].value) / points[0].value) * 100).toFixed(1));
}
