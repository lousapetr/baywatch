import { useEffect, useState } from 'preact/hooks';

export const ROUTES = ['/', '/priliv', '/vlny', '/o-aplikaci'] as const;
export type RoutePath = (typeof ROUTES)[number];

export interface Route {
  path: RoutePath;
  params: Record<string, string>;
}

/** Parses a location hash such as `#/vlny?d=2026-11-15`; unknown paths fall back to `/`. */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const q = raw.indexOf('?');
  const pathPart = q < 0 ? raw : raw.slice(0, q);
  const params: Record<string, string> = {};
  if (q >= 0) {
    for (const [k, v] of new URLSearchParams(raw.slice(q + 1))) params[k] = v;
  }
  const path = ROUTES.find((r) => r === pathPart);
  return path ? { path, params } : { path: '/', params: {} };
}

/** Builds a hash link for a route. */
export function href(path: RoutePath, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

/** Current route, re-read on `hashchange`; an unknown hash is rewritten to `#/`. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => {
      const r = parseHash(location.hash);
      if (location.hash !== '' && !isCanonical(location.hash, r)) {
        location.replace(href('/'));
        return;
      }
      setRoute(r);
    };
    onChange();
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function isCanonical(hash: string, r: Route): boolean {
  const pathPart = hash.replace(/^#/, '').split('?')[0];
  return pathPart === r.path;
}
