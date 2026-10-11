/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Unit tests for uniqueRecordName.ts.
 */

import { describe, expect, it } from 'vitest';
import { uniqueRecordName } from './uniqueRecordName';

describe('CSV record names', () => {
  it('numbers repeats within a graveyard', () => {
    const used = new Set(['skeleton a', 'skeleton a (1)']);
    expect(uniqueRecordName('Skeleton A', used)).toBe('Skeleton A (2)');
    expect(uniqueRecordName('Skeleton A', used)).toBe('Skeleton A (3)');
  });
});
