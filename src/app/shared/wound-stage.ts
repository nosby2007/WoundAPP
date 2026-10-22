/** Pressure-stage values must not carry into another wound type. */
export function stageForWoundType(type: unknown, stage: unknown): string {
  return type === 'Pressure' && typeof stage === 'string' ? stage : '';
}

/** An explicitly cleared nested value wins over a stale legacy top-level value. */
export function assessmentStageFromRecord(data: any): string {
  const stage = Object.prototype.hasOwnProperty.call(data.describe ?? {}, 'stage')
    ? data.describe.stage
    : data.stage;
  return stageForWoundType(data.describe?.type || data.type || '', stage);
}
