import { starsGlyph } from '../../shared/score.ts';

/** Star glyphs with a text equivalent for screen readers. */
export function Stars({ stars }: { stars: number }) {
  return (
    <span class="stars">
      <span aria-hidden="true">{starsGlyph(stars)}</span>
      <span class="visually-hidden">{stars} z 5</span>
    </span>
  );
}
