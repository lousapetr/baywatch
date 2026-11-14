import { SAFETY_TEXT } from '../../shared/safety.ts';

/** Safety warning for big waves. */
export function SafetyBanner() {
  return (
    <p class="safety" role="note">
      <span aria-hidden="true">⚠️ </span>
      {SAFETY_TEXT}
    </p>
  );
}
