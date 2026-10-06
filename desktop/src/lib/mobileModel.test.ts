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
