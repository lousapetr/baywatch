import { describe, expect, it } from 'vitest';
import { href, parseHash } from './router.ts';

describe('parseHash', () => {
  it('parses known paths', () => {
    expect(parseHash('#/priliv')).toEqual({ path: '/priliv', params: {} });
    expect(parseHash('#/o-aplikaci').path).toBe('/o-aplikaci');
  });
  it('parses the query part', () => {
    expect(parseHash('#/vlny?d=2026-11-15')).toEqual({ path: '/vlny', params: { d: '2026-11-15' } });
  });
  it('falls back to / for empty and unknown hashes', () => {
    expect(parseHash('')).toEqual({ path: '/', params: {} });
    expect(parseHash('#')).toEqual({ path: '/', params: {} });
    expect(parseHash('#/nope?d=1')).toEqual({ path: '/', params: {} });
  });
});

describe('href', () => {
  it('builds links with and without params', () => {
    expect(href('/vlny')).toBe('#/vlny');
    expect(href('/vlny', { d: '2026-11-15' })).toBe('#/vlny?d=2026-11-15');
  });
});
