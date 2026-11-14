import type { JSX } from 'preact';
import { href, type RoutePath } from '../router.ts';

const svg = (children: JSX.Element) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const TABS: { path: RoutePath; label: string; icon: JSX.Element }[] = [
  { path: '/', label: 'Přehled', icon: svg(<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />) },
  { path: '/priliv', label: 'Příliv', icon: svg(<path d="M2 9c3-3 5 3 8 0s5 3 8 0 3-1 4 0M2 15c3-3 5 3 8 0s5 3 8 0 3-1 4 0" />) },
  { path: '/vlny', label: 'Vlny', icon: svg(<path d="M3 18c4 0 5-3 5-7s3-7 7-7c-2 2-1 5 2 6s4 4 4 8M3 21h18" />) },
  {
    path: '/pocasi',
    label: 'Počasí',
    icon: svg(
      <>
        <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.75 4.75 0 0 1 0 9.5z" />
        <path d="M9 21l1-2M13 21l1-2" />
      </>,
    ),
  },
];

export function TabBar({ current }: { current: RoutePath }) {
  return (
    <nav class="tabbar" aria-label="Hlavní navigace">
      {TABS.map((t) => (
        <a key={t.path} href={href(t.path)} class="tab" aria-current={t.path === current ? 'page' : undefined}>
          {t.icon}
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
