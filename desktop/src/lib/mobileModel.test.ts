/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Unit tests for the coordinate conversion in mobileModel.ts.
 */

import { describe, expect, it } from 'vitest';
import { surveyPointToScene } from './mobileModel';

describe('desktop survey coordinates', () => {
  it('places joint markers in the rotated model frame with depth pointing down', () => {
    const point = surveyPointToScene([1, 2, 3]);
    expect(point.x).toBeCloseTo(1);
    expect(point.y).toBeCloseTo(-2);
    expect(point.z).toBeCloseTo(-3);
  });
});
