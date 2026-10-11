/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Unit tests for graveyardName.ts.
 */

import { describe, expect, it } from 'vitest';
import { graveyardNameExists } from './graveyardName';

describe('graveyard names', () => {
  const graveyards = [{ id: 'a', name: 'North' }];

  it('finds duplicates regardless of case or surrounding spaces', () => {
    expect(graveyardNameExists(' north ', graveyards)).toBe(true);
  });

  it('allows a graveyard to keep its own name', () => {
    expect(graveyardNameExists('North', graveyards, 'a')).toBe(false);
  });
});
