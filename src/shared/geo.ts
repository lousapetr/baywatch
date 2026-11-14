/** Czech 16-point compass: S = sever, J = jih, V = východ, Z = západ. */
const COMPASS = [
  'S', 'SSV', 'SV', 'VSV', 'V', 'VJV', 'JV', 'JJV',
  'J', 'JJZ', 'JZ', 'ZJZ', 'Z', 'ZSZ', 'SZ', 'SSZ',
] as const;

/** Normalises an angle to [0, 360). */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Smallest absolute angle between two bearings, 0–180°. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return d > 180 ? 360 - d : d;
}

/** Compass abbreviation of a bearing (direction the wind/waves come from); `–` if not finite. */
export function compass(deg: number): string {
  const idx = Math.round(normalizeDeg(deg) / 22.5) % 16;
  return COMPASS[idx] ?? '–';
}

/** Direction of travel for a "coming from" bearing. */
export function travelDeg(fromDeg: number): number {
  return normalizeDeg(fromDeg + 180);
}
