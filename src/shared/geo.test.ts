import { describe, expect, it } from 'vitest';
import { angleDiff, compass, normalizeDeg, travelDeg } from './geo.ts';

describe('geo', () => {
  it('maps bearings to Czech 16-point compass', () => {
    expect(compass(0)).toBe('S');
    expect(compass(22.5)).toBe('SSV');
    expect(compass(90)).toBe('V');
    expect(compass(180)).toBe('J');
    expect(compass(270)).toBe('Z');
    expect(compass(315)).toBe('SZ');
    expect(compass(348.75)).toBe('S');
    expect(compass(348.7)).toBe('SSZ');
    expect(compass(-90)).toBe('Z');
    expect(compass(360)).toBe('S');
    expect(compass(NaN)).toBe('–');
  });

  it('lists all 16 points in clockwise order', () => {
    expect(Array.from({ length: 16 }, (_, i) => compass(i * 22.5))).toEqual(
      ['S', 'SSV', 'SV', 'VSV', 'V', 'VJV', 'JV', 'JJV', 'J', 'JJZ', 'JZ', 'ZJZ', 'Z', 'ZSZ', 'SZ', 'SSZ'],
    );
  });

  it('normalises angles', () => {
    expect(normalizeDeg(-10)).toBe(350);
    expect(normalizeDeg(370)).toBe(10);
  });

  it('computes the smallest angle difference', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(0, 180)).toBe(180);
    expect(angleDiff(90, 90)).toBe(0);
    expect(angleDiff(-10, 370)).toBe(20);
  });

  it('turns a from-bearing into a travel bearing', () => {
    expect(travelDeg(315)).toBe(135);
    expect(travelDeg(90)).toBe(270);
  });
});
