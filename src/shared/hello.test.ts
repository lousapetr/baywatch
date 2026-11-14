import { describe, expect, it } from 'vitest';
import { greeting } from './hello.ts';

describe('greeting', () => {
  it('joins app name and place', () => {
    expect(greeting('Santander')).toBe('Baywatch – Santander');
  });
});
