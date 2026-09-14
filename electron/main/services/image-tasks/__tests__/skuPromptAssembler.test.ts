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

  it('requires an independent sku_original layout when a reference is present', () => {
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
    )).toBe(false);

    expect(validateAssembledPrompt(
      'Create an independent original label layout for wkau Ceramic Cleaner with NET: 500G. Use the reference image only for a loose premium mood and color inspiration; do not copy its exact layout, headline lockup, band structure, or decorative arrangement, and do not preserve any Image 1 source-label design.',
      spec,
    )).toBe(true);

    expect(validateAssembledPrompt(
      'Create an independent original label layout but reproduce the exact reference layout faithfully for wkau Ceramic Cleaner with NET: 500G. Never preserve Image 1 source-label design.',
      spec,
    )).toBe(false);

    expect(validateAssembledPrompt(
      'Create an independent original label layout for wkau Ceramic Cleaner with NET: 500G. Do not reproduce the exact reference layout; use only its loose mood and color inspiration, and never preserve Image 1 source-label design.',
      spec,
    )).toBe(true);
  });

  it('accepts page-ordered SKU/reference prompts and rejects authority inversion', () => {
    const spec = buildSkuHitMainConstraintSpec({
      feature: 'sku_hit_main_image',
      brand: 'wkau',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    });

    expect(validateAssembledPrompt(
      'Overlay Image 1 SKU as a single foreground product layer onto the rebuilt main-image scene; keep Image 1 packaging pixel-identical without redrawing the bottle. Image 1 packaging identity must remain exact. Preserve the exact dispensing mechanism and never borrow, merge, or transplant any product part from Image 2. Image 2 is the viral reference; preserve its WHITE RADIATOR REPAIR headline, target object, usage scene, and before/after promise while rebuilding the composition. Apply wkau only on the Image 1 cutout label when needed. Use only marketing wording actually visible in Image 2 and preserve its original language; do not invent or promote Image 1 SKU label copy. Compare the same localized area of the same target object with aligned perspective.',
      spec,
    )).toBe(true);

    expect(validateAssembledPrompt(
      'Make Image 1 SKU category and label copy the headline and usage-scene authority. Rewrite the Image 2 reference headline, replace its target object with the SKU category, and preserve only a generic selling angle.',
      spec,
    )).toBe(false);

    expect(validateAssembledPrompt(
      'Image 1 is the new SKU product and its packaging identity must remain exact. Image 2 is the viral reference; preserve its headline and target object while rebuilding the composition. Show the primary wkau SKU clearly.',
      spec,
    )).toBe(false);

    expect(validateAssembledPrompt(
      'Overlay Image 1 SKU as a single foreground product layer onto the rebuilt main-image scene; keep Image 1 packaging pixel-identical without redrawing the bottle. Image 1 packaging identity must remain exact. Apply wkau only on the Image 1 cutout label when needed. Preserve the Image 2 reference copy "喷一喷 / 冰雪融化" in its original language. Never borrow, merge, or transplant any cap, pump, trigger, nozzle, or other product part from Image 2. Compare the same localized area of the same target object with aligned perspective.',
      spec,
    )).toBe(true);
  });
});
