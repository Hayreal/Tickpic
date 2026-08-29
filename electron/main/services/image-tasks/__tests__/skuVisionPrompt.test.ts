import { describe, expect, it } from 'vitest';
import {
  buildSkuVisionSystemPrompt,
  buildSkuVisionUserText,
  finalizeSkuVisionInstruction,
  parseSkuVisionBatch,
} from '../skuVisionPrompt';

describe('skuVisionPrompt', () => {
  it.each(['sku_replica', 'sku_variation', 'sku_original'] as const)(
    'requires English label-only prompts for %s',
    (feature) => {
      const prompt = buildSkuVisionSystemPrompt(feature);

      expect(prompt).toContain('Return every execution prompt in English only.');
      expect(prompt).toContain('Never alter the SKU container');
      expect(prompt).toContain('only edit the printed label area');
    },
  );

  it('passes the existing SKU request fields to the vision planner', () => {
    const text = buildSkuVisionUserText({
      feature: 'sku_replica',
      brand: 'wkau',
      productName: '珠宝翻新泡腾片',
      capacity: '40ml',
      prompt: '类似风格，参考文案',
      images: [
        { role: 'source', path: '/authorized/input/sku.png' },
        { role: 'reference', path: '/authorized/input/reference.png' },
      ],
    }, 1);

    expect(text).toContain('"requested_count": 1');
    expect(text).toContain('"productName": "珠宝翻新泡腾片"');
    expect(text).toContain('"prompt": "类似风格，参考文案"');
  });

  it('requests one batch with diversity slots for multi-count SKU planning', () => {
    const text = buildSkuVisionUserText({
      feature: 'sku_original',
      productName: 'Oil Cleaner',
      images: [{ role: 'source', path: '/authorized/input/sku.png' }],
    }, 2);

    expect(text).toContain('Create one batch with 2 independent English SKU label-edit execution prompts');
    expect(text).toContain('"batch_diversity_plan"');
    expect(text).toContain('"index": 2');
  });

  it('locks source-image measurement annotations', () => {
    const prompt = buildSkuVisionSystemPrompt('sku_replica');

    expect(prompt).toContain('Preserve every source-image measurement annotation');
  });

  it('prevents duplicate label brand marks', () => {
    const prompt = buildSkuVisionSystemPrompt('sku_replica');

    expect(prompt).toContain('Never merge or duplicate brand marks');
  });

  it('uses the reference label copy by default in replica mode', () => {
    const prompt = buildSkuVisionSystemPrompt('sku_replica');

    expect(prompt).toContain('Replica mode: treat the reference product label as the default source of label copy');
    expect(prompt).toContain('Do not reinterpret, modernize, simplify, or merely approximate');
  });

  it('keeps every variation inside the reference label design system', () => {
    const plannerPrompt = buildSkuVisionSystemPrompt('sku_variation');
    const executionPrompt = finalizeSkuVisionInstruction({
      feature: 'sku_variation',
      images: [
        { role: 'source', path: '/authorized/input/sku.png' },
        { role: 'reference', path: '/authorized/input/reference.png' },
      ],
    }, 'Use a dark automotive precision design.', {
      brand: 'wkau',
      productName: 'HEADLIGHT RESTORE',
      capacity: '45ML',
    });

    expect(plannerPrompt).toContain('All batch variants must remain unmistakably derived from the same reference label design system');
    expect(plannerPrompt).toContain('Never use the source label design or product category aesthetics as visual direction');
    expect(executionPrompt).toContain('The reference label design system overrides any conflicting LABEL DESIGN PLAN');
    expect(executionPrompt).toContain('Vary layout and element placement only within that reference design system');
    expect(executionPrompt).toContain('accessory quantity callouts, gift badges');
    expect(executionPrompt).toContain('extract visible copy only as brand, product name, and capacity');
  });

  it('extracts only brand, product name, and capacity from the source label in variation mode', () => {
    const executionPrompt = finalizeSkuVisionInstruction({
      feature: 'sku_variation',
      images: [{ role: 'source', path: '/authorized/input/sku.png' }],
    }, 'Use a premium label layout.', {
      brand: 'wukau',
      productName: 'HEADLIGHT RESTORE',
      capacity: '45ML',
    });

    expect(executionPrompt).toContain('The exact brand is "wukau".');
    expect(executionPrompt).toContain('The exact product name is "HEADLIGHT RESTORE".');
    expect(executionPrompt).toContain('The exact capacity is "NET: 45ML".');
    expect(executionPrompt).toContain('Remove ecommerce overlay graphics from Image 1');
  });

  it('adds batch-slot diversity directives for multi-count original outputs', () => {
    const prompt = finalizeSkuVisionInstruction({
      feature: 'sku_original',
      productName: 'Oil Cleaner',
      count: 1,
      variantIndex: 2,
      variantTotal: 2,
      images: [
        { role: 'source', path: '/authorized/input/sku.png' },
        { role: 'reference', path: '/authorized/input/reference.png' },
      ],
    }, 'Use a premium retail label layout.', {
      brand: '',
      productName: 'Oil Cleaner',
      capacity: '',
    });

    expect(prompt).toContain('This is batch output 2/2.');
    expect(prompt).toContain('visibly different from the other outputs');
  });

  it('parses one shared visible-copy lock for the whole batch', () => {
    const batch = parseSkuVisionBatch(JSON.stringify({
      locked_copy: {
        brand: 'wkau',
        product_name: 'Heavy Oil Eliminator',
        capacity: 'NET: 50ML',
      },
      instructions: [
        { index: 1, prompt: 'Use a bold diagonal label layout.' },
        { index: 2, prompt: 'Use a centered modular label layout.' },
      ],
    }), 2);

    expect(batch.lockedCopy).toEqual({
      brand: 'wkau',
      productName: 'Heavy Oil Eliminator',
      capacity: 'NET: 50ML',
    });
  });

  it.each(['sku_replica', 'sku_variation', 'sku_original'] as const)(
    'requires every visible capacity to use the NET: prefix for %s',
    (feature) => {
      const prompt = finalizeSkuVisionInstruction({
        feature,
        images: [{ role: 'source', path: '/authorized/input/sku.png' }],
      }, 'Create a clear label.', {
        brand: '',
        productName: '',
        capacity: '50ML',
      });

      expect(prompt).toContain('The exact capacity is "NET: 50ML".');
      expect(prompt).toContain('Every visible capacity must start with the exact prefix "NET:".');
    },
  );

  it('locks source capacity in original mode when the user does not provide it', () => {
    const prompt = finalizeSkuVisionInstruction({
      feature: 'sku_original',
      images: [{ role: 'source', path: '/authorized/input/sku.png' }],
    }, 'Create a clear label.', {
      brand: '',
      productName: '',
      capacity: '50ML',
    });

    expect(prompt).toContain('The exact capacity is "NET: 50ML".');
    expect(prompt).toContain('Every output must display this exact capacity visibly on the label.');
    expect(prompt).toContain('Every visible capacity must start with the exact prefix "NET:".');
  });

  it('prefers user capacity over source capacity in original mode', () => {
    const prompt = finalizeSkuVisionInstruction({
      feature: 'sku_original',
      capacity: '100ML',
      images: [{ role: 'source', path: '/authorized/input/sku.png' }],
    }, 'Create a clear label.', {
      brand: '',
      productName: '',
      capacity: '50ML',
    });

    expect(prompt).toContain('The exact capacity is "NET: 100ML".');
    expect(prompt).not.toContain('The exact capacity is "NET: 50ML".');
  });

  it('strips planner wording that omits locked capacity', () => {
    const prompt = finalizeSkuVisionInstruction({
      feature: 'sku_original',
      images: [{ role: 'source', path: '/authorized/input/sku.png' }],
    }, 'Use a premium label. Do not add capacity text on the label.', {
      brand: '',
      productName: 'Oil Stain Cleaner',
      capacity: '45ML',
    });

    expect(prompt).toContain('The exact capacity is "NET: 45ML".');
    expect(prompt).not.toContain('Do not add capacity');
    expect(prompt).toContain('The redesigned label must visibly show "NET: 45ML".');
  });

  it('wraps original instructions with source, reference, and exact-copy locks', () => {
    const prompt = finalizeSkuVisionInstruction({
      feature: 'sku_original',
      productName: 'Heavy Oil Eliminator',
      images: [
        { role: 'source', path: '/authorized/input/sku.png' },
        { role: 'reference', path: '/authorized/input/reference.png' },
      ],
    }, 'Use the reference visual language.', {
      brand: '',
      productName: 'Planner Product Name',
      capacity: '',
    });

    expect(prompt).toContain('Image 1 is the fixed source canvas');
    expect(prompt).toContain('dimension lines, arrows, numbers, and units');
    expect(prompt).toContain('Preserve every non-label element in Image 1 exactly as uploaded');
    expect(prompt).toContain('accessories, bundle items, gift icons');
    expect(prompt).not.toContain('Remove ecommerce overlay graphics from Image 1');
    expect(prompt).toContain('From Image 1 primary label only, extract visible copy as brand, product name, and capacity');
    expect(prompt).toContain('blank package render');
    expect(prompt).toContain('Images 2 and later are label-design references only');
    expect(prompt).toContain('The exact product name is "Heavy Oil Eliminator"');
    expect(prompt).not.toContain('Planner Product Name');
    expect(prompt).toContain('Ignore every existing label design on Image 1');
  });

  it('uses the planner translation when the explicit product name is Chinese', () => {
    const prompt = finalizeSkuVisionInstruction({
      feature: 'sku_original',
      productName: '重油污清洁剂',
      images: [{ role: 'source', path: '/authorized/input/sku.png' }],
    }, 'Create a commercial automotive-care label.', {
      brand: '',
      productName: 'Heavy Oil Eliminator',
      capacity: '',
    });

    expect(prompt).toContain('The exact product name is "Heavy Oil Eliminator"');
    expect(prompt).not.toMatch(/\p{Script=Han}/u);
  });

  it('prevents original mode from inheriting source-product category imagery', () => {
    const plannerPrompt = buildSkuVisionSystemPrompt('sku_original');
    const executionPrompt = finalizeSkuVisionInstruction({
      feature: 'sku_original',
      productName: '油污清洁剂',
      images: [
        { role: 'source', path: '/authorized/input/headlight-restorer.png' },
        { role: 'reference', path: '/authorized/input/reference.png' },
      ],
    }, 'Create an automotive-care label with a car graphic.', {
      brand: '',
      productName: 'Oil Stain Cleaner',
      capacity: '',
    });

    expect(plannerPrompt).toContain('Never infer product category, usage, target object, or label imagery from the source image');
    expect(executionPrompt).toContain("The user's product name is the sole semantic authority");
    expect(executionPrompt).toContain('Any source-derived category or usage direction in LABEL DESIGN PLAN is invalid');
    expect(executionPrompt).toContain('do not show cars, vehicles, headlights, engines, dashboards, wheels, or other automotive imagery');
  });

  it('rejects a vision batch with Chinese execution text', () => {
    expect(() => parseSkuVisionBatch(
      '{"locked_copy":{"brand":"","product_name":"","capacity":""},"instructions":[{"index":1,"prompt":"只改标签"}]}',
      1,
    )).toThrow('English-only');
  });
});
