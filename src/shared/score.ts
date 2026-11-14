import { angleDiff } from './geo.ts';

/** Energy flux per metre of wave crest, deep-water approximation, kW/m. */
export function wavePower(heightM: number, periodS: number): number {
  return 0.5 * heightM * heightM * periodS;
}

/** Larger of the swell power and the total-sea power, kW/m. */
export function combinedPower(
  swellHeight: number,
  swellPeriod: number,
  waveHeight: number,
  wavePeriod: number,
): number {
  return Math.max(wavePower(swellHeight, swellPeriod), wavePower(waveHeight, wavePeriod));
}

/** Directional factor: full when the swell hits the coast head-on, floor 0.15 up to 90°, fading to 0 by 120°. */
export function dirFactor(swellDir: number, facingDeg: number): number {
  const delta = angleDiff(swellDir, facingDeg);
  if (delta <= 90) return Math.max(0.15, Math.cos((delta * Math.PI) / 180));
  return 0.15 * Math.max(0, 1 - (delta - 90) / 30);
}

/** Tide factor: 1 at high water, `1 - tideWeight` at low water. */
export function tideFactor(tideWeight: number, tideNorm: number): number {
  return 1 - tideWeight + tideWeight * tideNorm;
}

/** Piecewise-linear [kW/m, stars] knots. */
export const STAR_THRESHOLDS: readonly (readonly [number, number])[] = [
  [5, 0],
  [15, 1],
  [30, 2],
  [60, 3],
  [120, 4],
  [200, 5],
];

/** Stars 0–5, one decimal, from effective power in kW/m; non-finite input gives 0. */
export function starsFromPower(eff: number): number {
  const first = STAR_THRESHOLDS[0]!;
  const last = STAR_THRESHOLDS[STAR_THRESHOLDS.length - 1]!;
  let stars: number;
  if (!(eff > first[0])) stars = first[1];
  else if (eff >= last[0]) stars = last[1];
  else {
    stars = last[1];
    for (let i = 1; i < STAR_THRESHOLDS.length; i++) {
      const [x1, y1] = STAR_THRESHOLDS[i]!;
      if (eff <= x1) {
        const [x0, y0] = STAR_THRESHOLDS[i - 1]!;
        stars = y0 + ((eff - x0) / (x1 - x0)) * (y1 - y0);
        break;
      }
    }
  }
  return Math.round(stars * 10) / 10;
}

export interface ScoreHour {
  powerKwM: number;
  swellDir: number;
  facingDeg: number;
  tideWeight: number;
  /** Tide level normalised to 0–1 over the forecast window. */
  tideNorm: number;
}

/** Score 0–5 (one decimal) for one hour at one spot. */
export function scoreHour(h: ScoreHour): number {
  const eff = h.powerKwM * dirFactor(h.swellDir, h.facingDeg) * tideFactor(h.tideWeight, h.tideNorm);
  return starsFromPower(eff);
}

const LABELS = ['klid', 'slabé', 'ujde', 'pěkné', 'velké', 'bouře – výjimečné'] as const;

/** Czech label for a (possibly fractional) star value, rounded to an integer. */
export function starLabel(stars: number): string {
  const i = Math.min(5, Math.max(0, Math.round(stars)));
  return LABELS[i] as string;
}
