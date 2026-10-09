import { describe, expect, it } from 'vitest';
import { availableGraveyardName } from './graveyardName';

describe('graveyard names', () => {
  const graveyards = [
    { id: 'a', name: 'North' },
    { id: 'b', name: 'North (1)' },
  ];

  it('adds the next free number to a duplicate name', () => {
    expect(availableGraveyardName(' north ', graveyards)).toBe('north (2)');
  });

  it('does not treat the graveyard being renamed as a duplicate', () => {
    expect(availableGraveyardName('North', graveyards, 'a')).toBe('North');
  });
});
