import { describe, expect, it } from 'vitest';
import { DEFAULT_SPOT_ID, SPOTS, getSpot } from './spots.ts';

describe('spots', () => {
  it('has unique ids and valid parameters', () => {
    expect(new Set(SPOTS.map((s) => s.id)).size).toBe(SPOTS.length);
    for (const s of SPOTS) {
      expect(s.facingDeg).toBeGreaterThanOrEqual(0);
      expect(s.facingDeg).toBeLessThan(360);
      expect(s.tideWeight).toBeGreaterThanOrEqual(0);
      expect(s.tideWeight).toBeLessThanOrEqual(1);
      expect(s.note.length).toBeGreaterThan(0);
    }
  });

  it('default spot is the first one and exists', () => {
    expect(getSpot(DEFAULT_SPOT_ID)).toBe(SPOTS[0]);
    expect(getSpot('nope')).toBeUndefined();
  });
});
