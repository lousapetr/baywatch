import { describe, expect, it } from 'vitest';
import { classifyRange } from './tideRange.ts';

const ranges = [2.27, 2.03, 1.72, 1.53, 1.59, 1.88, 2.24, 2.72];

describe('classifyRange', () => {
  it('splits by relative position in the window', () => {
    expect(classifyRange(2.72, ranges)).toBe('large');
    expect(classifyRange(2.27, ranges)).toBe('medium');
    expect(classifyRange(1.53, ranges)).toBe('small');
    expect(classifyRange(1.59, ranges)).toBe('small');
    expect(classifyRange(2.03, ranges)).toBe('medium');
  });
  it('is medium when the spread is tiny or empty', () => {
    expect(classifyRange(2, [1.9, 2.0, 2.1])).toBe('medium');
    expect(classifyRange(2, [])).toBe('medium');
  });
});
