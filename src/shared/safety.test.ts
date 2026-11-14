import { describe, expect, it } from 'vitest';
import { needsSafetyWarning } from './safety.ts';

describe('needsSafetyWarning', () => {
  it('triggers on stars or wave height', () => {
    expect(needsSafetyWarning(4, 1)).toBe(true);
    expect(needsSafetyWarning(2, 4)).toBe(true);
    expect(needsSafetyWarning(3, 3.9)).toBe(false);
  });
});
