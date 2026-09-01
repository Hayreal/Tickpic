import { describe, expect, it } from 'vitest';
import { buildSkuLabelConstraintSpec } from '../skuConstraintSpec';
import { buildSkuHitMainConstraintSpec } from '../skuHitMainConstraintSpec';
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

  it('rejects weak sku_original assembled prompts that omit reference-driven layout rules', () => {
    const spec = buildSkuLabelConstraintSpec({
      feature: 'sku_original',
      brand: 'wkau',
      productName: 'Ceramic Cleaner',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    }, {
      brand: 'wkau',
      productName: 'Ceramic Cleaner',
      capacity: 'NET: 500G',
    });

    expect(validateAssembledPrompt(
      'Create a clean label with a strong upper logo zone for wkau, centered Ceramic Cleaner, and NET: 500G.',
      spec,
    )).toBe(false);

    expect(validateAssembledPrompt(
      'Use Images 2+ as the label design system. Replace the entire source label and never preserve Image 1 source label layout, band structure, logo zone, headline placement, palette bands, hero graphics, or decorative arrangement. Display wkau, Ceramic Cleaner, and NET: 500G.',
      spec,
    )).toBe(true);
  });

  it('rejects hit-main assembled prompts with conflicting headlines or duplicate foreground SKU display', () => {
    const spec = buildSkuHitMainConstraintSpec({
      feature: 'sku_hit_main_image',
      brand: 'wkau',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    });

    expect(validateAssembledPrompt(
      'Keep the core headline RESTORE APPLIANCE SURFACES without rewriting, with For everyday metal wear, while showing a wall tile before/after scene. Place the wkau SKU upright in the lower-right foreground and show a hand using the applicator on the wall.',
      spec,
    )).toBe(false);

    expect(validateAssembledPrompt(
      'Create a wall black-spot removal before/after scene with one wkau SKU visible in the hand using the applicator. Rewrite the headline to match wall cleaning. Brand wkau.',
      spec,
    )).toBe(true);
  });
});
