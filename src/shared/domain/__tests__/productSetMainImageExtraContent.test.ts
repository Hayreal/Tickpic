import { describe, expect, it } from 'vitest';
import {
  applyMainImageDisplayTags,
  formatMainImageDisplayTags,
  formatMainImageExtraContentSelection,
  isMainImageExtraContentOptionActive,
  mainImageDisplayTagsFromFields,
  migrateLegacyExtraContentMode,
  resolveEffectiveMainImageExtraContentFlags,
  resizeMainImageExtraContentByIndex,
  toggleMainImageDisplayTag,
  toggleMainImageExtraContentOption,
} from '../productSetMainImageExtraContent';

describe('productSetMainImageExtraContent', () => {
  it('allows selling points and mini comparison together', () => {
    const selection = toggleMainImageExtraContentOption(
      toggleMainImageExtraContentOption({ preset: 'none', toggles: [] }, 'selling_points'),
      'mini_comparison',
    );

    expect(selection).toEqual({
      preset: 'custom',
      toggles: ['selling_points', 'mini_comparison'],
    });
    expect(formatMainImageExtraContentSelection(selection)).toBe('卖点(1–3) + 小对比图');
    expect(resolveEffectiveMainImageExtraContentFlags(selection, undefined)).toEqual({
      sellingPoints: true,
      miniComparison: true,
    });
  });

  it('respects forced user modes over vision hints', () => {
    expect(resolveEffectiveMainImageExtraContentFlags(
      { preset: 'none', toggles: [] },
      'selling_points',
    )).toEqual({ sellingPoints: false, miniComparison: false });
    expect(resolveEffectiveMainImageExtraContentFlags(
      { preset: 'auto', toggles: [] },
      ['mini_comparison', 'selling_points'],
    )).toEqual({ sellingPoints: true, miniComparison: true });
  });

  it('migrates legacy single-value requests', () => {
    expect(resizeMainImageExtraContentByIndex(['selling_points'], 2)).toEqual([
      migrateLegacyExtraContentMode('selling_points'),
      { preset: 'auto', toggles: [] },
    ]);
  });

  it('tracks active options for multi-select UI', () => {
    const selection = { preset: 'custom' as const, toggles: ['selling_points' as const] };
    expect(isMainImageExtraContentOptionActive(selection, 'selling_points')).toBe(true);
    expect(isMainImageExtraContentOptionActive(selection, 'mini_comparison')).toBe(false);
    expect(isMainImageExtraContentOptionActive(selection, 'auto')).toBe(false);
  });

  it('maps display tags to request fields', () => {
    const tags = toggleMainImageDisplayTag(
      toggleMainImageDisplayTag(['product'], 'selling_points'),
      'mini_comparison',
    );
    expect(formatMainImageDisplayTags(tags)).toBe('产品、卖点(1-3)、对比图');
    expect(applyMainImageDisplayTags(tags)).toEqual({
      showProduct: true,
      extra: { preset: 'custom', toggles: ['selling_points', 'mini_comparison'] },
    });
    expect(mainImageDisplayTagsFromFields(true, {
      preset: 'custom',
      toggles: ['selling_points', 'mini_comparison'],
    })).toEqual(tags);
  });
});
