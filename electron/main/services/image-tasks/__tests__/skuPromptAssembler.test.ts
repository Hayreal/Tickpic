import { describe, expect, it } from 'vitest';
import { buildSkuLabelConstraintSpec } from '../skuConstraintSpec';
import { validateAssembledPrompt } from '../skuPromptAssembler';

describe('skuPromptAssembler', () => {
  it('rejects assembled prompts that omit locked capacity or contain Chinese text', () => {
    const spec = buildSkuLabelConstraintSpec({
      feature: 'sku_original',
      productName: 'Oil Cleaner',
      capacity: '45ML',
      images: [{ role: 'source', path: '/tmp/sku.png' }],
    }, {
      brand: '',
      productName: 'Oil Cleaner',
      capacity: 'NET: 45ML',
    });

    expect(validateAssembledPrompt(
      'Edit Image 1 label with a bold layout and show NET: 45ML for Oil Cleaner.',
      spec,
    )).toBe(false);

    expect(validateAssembledPrompt(
      'Edit Image 1 label with a bold premium layout. Display the exact capacity NET: 45ML and product name Oil Cleaner on the redesigned label while preserving the source container.',
      spec,
    )).toBe(true);

    expect(validateAssembledPrompt('只改标签', spec)).toBe(false);
    expect(validateAssembledPrompt(
      'Redesign the label without capacity text on the bottle.',
      spec,
    )).toBe(false);
  });

  it('rejects weak sku_replica assembled prompts that omit reference fidelity rules', () => {
    const spec = buildSkuLabelConstraintSpec({
      feature: 'sku_replica',
      brand: 'wkau',
      productName: 'HEADLIGHT RESTORE',
      capacity: '45ML',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    }, {
      brand: 'wkau',
      productName: 'HEADLIGHT RESTORE',
      capacity: 'NET: 45ML',
    });

    expect(validateAssembledPrompt(
      'Edit Image 1 label using a white and blue palette. Show wkau, HEADLIGHT RESTORE, and NET: 45ML. Do not copy source-label icons.',
      spec,
    )).toBe(false);

    expect(validateAssembledPrompt(
      'Replace the entire source label with the reference label design system on Images 2+. Reproduce the reference layout, band structure, hero graphic, and decorative language faithfully. Never keep source-label icons or category imagery. Display wkau, HEADLIGHT RESTORE, and NET: 45ML on the redesigned label while preserving Image 1 outside the label.',
      spec,
    )).toBe(true);
  });
});
