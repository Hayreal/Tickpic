import { describe, expect, it } from 'vitest';
import { closestAspectRatioOption, formatAspectRatio } from '../aspectRatioFromImage';

describe('aspectRatioFromImage', () => {
  it('formats image dimensions into a simplified ratio', () => {
    expect(formatAspectRatio(800, 600)).toBe('4:3');
    expect(formatAspectRatio(1000, 1000)).toBe('1:1');
  });

  it('picks the closest supported ratio when exact match is unavailable', () => {
    expect(closestAspectRatioOption(700, 500)).toBe('4:3');
    expect(closestAspectRatioOption(1920, 1080)).toBe('16:9');
  });
});
