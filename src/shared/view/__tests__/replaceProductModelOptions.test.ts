import { describe, expect, it } from 'vitest';
import {
  REPLACE_PRODUCT_GEMINI_3_PRO_IMAGE,
  REPLACE_PRODUCT_MODEL_DEFAULT,
  replaceProductModelFromOverrides,
  resolveReplaceProductModelOverrides,
} from '../replaceProductModelOptions';

describe('replaceProductModelOptions', () => {
  it('returns no overrides for the default selection', () => {
    expect(resolveReplaceProductModelOverrides(REPLACE_PRODUCT_MODEL_DEFAULT)).toBeUndefined();
  });

  it('maps Gemini 3 Pro Image to edit override with gemini protocol', () => {
    expect(resolveReplaceProductModelOverrides(REPLACE_PRODUCT_GEMINI_3_PRO_IMAGE)).toEqual({
      edit: 'gemini-3-pro-image',
      protocol: 'gemini',
    });
  });

  it('restores selection from task overrides', () => {
    expect(replaceProductModelFromOverrides({
      edit: 'gemini-3-pro-image',
      protocol: 'gemini',
    })).toBe(REPLACE_PRODUCT_GEMINI_3_PRO_IMAGE);
    expect(replaceProductModelFromOverrides({
      edit: 'gpt-image-2-all',
    })).toBe(REPLACE_PRODUCT_MODEL_DEFAULT);
  });
});
