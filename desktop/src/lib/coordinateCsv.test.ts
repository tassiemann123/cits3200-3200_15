import { describe, expect, it } from 'vitest';
import { parseCoordinateCsv } from './coordinateCsv';

describe('desktop CSV import warnings', () => {
  it('names missing required columns', () => {
    const result = parseCoordinateCsv('skeleton_id,joint_name,x,y\nIND-1,chin,1,2\n');
    expect(result.records).toEqual([]);
    expect(result.warnings).toEqual(['Missing required CSV column: z.']);
  });

  it('reports the row and bad coordinate instead of importing incomplete data', () => {
    const result = parseCoordinateCsv('skeleton_id,joint_name,x,y,z,present\nIND-1,chin,1,2,3,yes\nIND-1,left_knee,4,oops,6,yes\nIND-1,right_knee,,,,no\n');
    expect(result.records[0].rows).toHaveLength(2);
    expect(result.warnings).toEqual([
      'Row 3 (IND-1, left_knee) has missing or invalid y coordinate and was skipped.',
    ]);
  });

  it('uses physical file lines after metadata and blank lines', () => {
    const result = parseCoordinateCsv('Graveyard Name,Demo\n\nskeleton_id,joint_name,x,y,z\nIND-1,chin,1,2,3\n\nIND-1,left_knee,4,broken,6\n');
    expect(result.records[0].rows[0].lineNumber).toBe(4);
    expect(result.warnings).toEqual([
      'Row 6 (IND-1, left_knee) has missing or invalid y coordinate and was skipped.',
    ]);
  });
});
