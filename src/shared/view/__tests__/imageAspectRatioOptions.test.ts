import { describe, expect, it } from 'vitest';
import { filterAspectRatioOptions } from '../imageAspectRatioOptions';

describe('filterAspectRatioOptions', () => {
  it('returns all options when query is empty', () => {
    expect(filterAspectRatioOptions('')).toHaveLength(16);
    expect(filterAspectRatioOptions('   ')).toHaveLength(16);
  });

  it('filters by ratio value', () => {
    expect(filterAspectRatioOptions('16:9').map((option) => option.value)).toEqual(['16:9']);
  });

  it('filters by e-commerce description keywords', () => {
    const results = filterAspectRatioOptions('主图');
    expect(results.some((option) => option.value === '1:1')).toBe(true);
    expect(results.some((option) => option.value === '3:4')).toBe(true);
  });

  it('filters by vertical main-image keywords', () => {
    const results = filterAspectRatioOptions('小红书');
    expect(results.map((option) => option.value)).toEqual(['3:4', '9:16']);
  });
});
