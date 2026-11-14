import { useEffect, useRef } from 'preact/hooks';
import type { DayInfo } from '../../shared/types.ts';
import { formatDayLabel } from '../../shared/format.ts';
import { href, type RoutePath } from '../router.ts';

interface Props {
  path: RoutePath;
  days: DayInfo[];
  selected: string;
  now: number;
  label: string;
}

/** Horizontally scrolling day chips linking to `path?d=date`; the selected one is centred. */
export function DaySwitch({ path, days, selected, now, label }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = ref.current;
    const chip = nav?.querySelector('[aria-current="true"]');
    if (!nav || !chip) return;
    const n = nav.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    nav.scrollLeft += c.left - n.left - (n.width - c.width) / 2;
  }, [selected]);
  return (
    <nav class="day-switch" aria-label={label} ref={ref}>
      {days.map((d) => (
        <a key={d.date} class="day-chip" href={href(path, { d: d.date })} aria-current={d.date === selected ? 'true' : undefined}>
          {formatDayLabel(d.sunrise, now)}
        </a>
      ))}
    </nav>
  );
}
