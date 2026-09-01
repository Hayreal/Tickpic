import { describe, expect, it } from 'vitest';
import {
  appendSkuExecutionImageRoles,
  filterSkuLabelExecutionImages,
} from '../skuExecutionImageRoles';

describe('skuExecutionImageRoles', () => {
  it('passes source and reference images for SKU label edits', () => {
    const images = [
      { role: 'source', path: '/tmp/sku.png' },
      { role: 'reference', path: '/tmp/reference.png' },
    ];

    expect(filterSkuLabelExecutionImages(images)).toEqual(images);
  });

  it('keeps source-only execution when no reference is provided', () => {
    const images = [{ role: 'source', path: '/tmp/sku.png' }];

    expect(filterSkuLabelExecutionImages(images)).toEqual(images);
  });

  it('forbids reusing Image 1 label layout for variation execution', () => {
    const prompt = appendSkuExecutionImageRoles(
      'Create a bold label variation.',
      'sku_variation',
      true,
    );

    expect(prompt).toContain('EXECUTION IMAGE ROLES:');
    expect(prompt).toContain('forbidden visual input');
    expect(prompt).toContain('printable-surface curvature');
    expect(prompt).toContain('never reuse Image 1 label structure');
  });

  it('forbids reusing Image 1 label layout for original execution', () => {
    const prompt = appendSkuExecutionImageRoles(
      'Create a new commercial label.',
      'sku_original',
      true,
    );

    expect(prompt).toContain('label design system reference');
    expect(prompt).toContain('never reuse Image 1 label structure');
  });
});
