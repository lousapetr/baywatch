import { describe, expect, it } from 'vitest';
import {
  STAR_THRESHOLDS,
  combinedPower,
  dirFactor,
  scoreHour,
  starLabel,
  starsFromPower,
  tideFactor,
  wavePower,
} from './score.ts';

const stars = (h: number, t: number) => starsFromPower(wavePower(h, t));

describe('wave power', () => {
  it('computes 0.5·H²·T', () => {
    expect(wavePower(2, 10)).toBe(20);
    expect(wavePower(0, 10)).toBe(0);
  });

  it('takes the larger of swell and total sea', () => {
    expect(combinedPower(2, 10, 1, 5)).toBe(20);
    expect(combinedPower(1, 5, 3, 6)).toBe(27);
  });
});

describe('star reference points', () => {
  it('1 m / 8 s is calm', () => {
    expect(wavePower(1, 8)).toBe(4);
    expect(stars(1, 8)).toBe(0);
  });
  it('matches the reference powers', () => {
    expect(wavePower(2, 10)).toBe(20);
    expect(wavePower(3, 12)).toBe(54);
    expect(wavePower(4, 14)).toBe(112);
    expect(wavePower(5, 15)).toBe(187.5);
  });
  it('2 m / 10 s', () => expect(stars(2, 10)).toBe(1.3));
  it('3 m / 12 s', () => expect(stars(3, 12)).toBe(2.8));
  it('4 m / 14 s', () => expect(stars(4, 14)).toBe(3.9));
  it('5 m / 15 s', () => expect(stars(5, 15)).toBe(4.8));
});

describe('starsFromPower', () => {
  it('hits the knots exactly', () => {
    for (const [kw, s] of STAR_THRESHOLDS) expect(starsFromPower(kw)).toBe(s);
  });
  it('clamps to 0–5', () => {
    expect(starsFromPower(-3)).toBe(0);
    expect(starsFromPower(1000)).toBe(5);
  });
  it('gives 0 for non-finite input', () => {
    expect(starsFromPower(NaN)).toBe(0);
    expect(scoreHour({ powerKwM: 100, swellDir: NaN, facingDeg: 0, tideWeight: 0.3, tideNorm: 1 })).toBe(0);
  });
  it('rounds to one decimal', () => {
    expect(starsFromPower(17)).toBe(1.1);
  });
  it('is monotonic', () => {
    let prev = 0;
    for (let p = 0; p <= 250; p += 1) {
      const s = starsFromPower(p);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe('dirFactor', () => {
  it('is 1 head-on and cos Δ in between', () => {
    expect(dirFactor(0, 0)).toBe(1);
    expect(dirFactor(60, 0)).toBeCloseTo(0.5, 5);
    expect(dirFactor(350, 10)).toBeCloseTo(Math.cos((20 * Math.PI) / 180), 5);
  });
  it('has a floor of 0.15 up to 90°', () => {
    expect(dirFactor(85, 0)).toBe(0.15);
    expect(dirFactor(90, 0)).toBe(0.15);
  });
  it('fades to 0 between 90° and 120°', () => {
    expect(dirFactor(105, 0)).toBeCloseTo(0.075, 5);
    expect(dirFactor(120, 0)).toBe(0);
    expect(dirFactor(180, 0)).toBe(0);
  });
});

describe('tideFactor', () => {
  it('scales between 1 - weight and 1', () => {
    expect(tideFactor(0.4, 1)).toBe(1);
    expect(tideFactor(0.4, 0)).toBeCloseTo(0.6, 10);
    expect(tideFactor(0, 0)).toBe(1);
  });
});

describe('scoreHour', () => {
  const base = { swellDir: 0, facingDeg: 0, tideWeight: 0.4, tideNorm: 1 };
  it('equals the plain stars at full factors', () => {
    expect(scoreHour({ ...base, powerKwM: wavePower(3, 12) })).toBe(2.8);
  });
  it('is lower at low tide and off-axis', () => {
    const high = scoreHour({ ...base, powerKwM: 100 });
    expect(scoreHour({ ...base, powerKwM: 100, tideNorm: 0 })).toBeLessThan(high);
    expect(scoreHour({ ...base, powerKwM: 100, swellDir: 60 })).toBeLessThan(high);
    expect(scoreHour({ ...base, powerKwM: 100, swellDir: 180 })).toBe(0);
  });
});

describe('starLabel', () => {
  it('maps rounded stars to Czech labels', () => {
    expect(starLabel(0)).toBe('klid');
    expect(starLabel(1.2)).toBe('slabé');
    expect(starLabel(2)).toBe('ujde');
    expect(starLabel(2.6)).toBe('pěkné');
    expect(starLabel(4)).toBe('velké');
    expect(starLabel(5)).toBe('bouře – výjimečné');
    expect(starLabel(9)).toBe('bouře – výjimečné');
  });
});
