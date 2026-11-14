interface Props {
  /** Direction the arrow points to, ° clockwise from north. */
  deg: number;
  size?: number;
}

/** Decorative arrow, drawn pointing north and rotated clockwise by `deg`; the compass text next to it carries the meaning. */
export function Arrow({ deg, size = 16 }: Props) {
  return (
    <svg class="arrow" width={size} height={size} viewBox="-8 -8 16 16" aria-hidden="true" focusable="false">
      <path d="M0 -7.5L5.5 -1H1.8V7.5H-1.8V-1H-5.5Z" transform={`rotate(${Math.round(deg)})`} />
    </svg>
  );
}
