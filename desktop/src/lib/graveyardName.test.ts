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
