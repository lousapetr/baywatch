/** Stars from which a window triggers the safety banner. */
export const SAFETY_MIN_STARS = 4;
/** Wave height (m) from which the safety banner is shown. */
export const SAFETY_MIN_WAVE_M = 4;

export const SAFETY_TEXT = 'Velké vlny jsou nebezpečné – držte se dál od hrany útesů a mokrých skal.';

/** True when the window is big (≥ 4★) or any wave reaches 4 m. */
export function needsSafetyWarning(stars: number, maxWaveHeightM: number): boolean {
  return stars >= SAFETY_MIN_STARS || maxWaveHeightM >= SAFETY_MIN_WAVE_M;
}
