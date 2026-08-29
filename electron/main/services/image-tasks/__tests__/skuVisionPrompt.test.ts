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
    expect(prompt).toContain('secondary package, accessory, quantity marker');
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

  it('rejects a vision batch with Chinese execution text', () => {
    expect(() => parseSkuVisionBatch(
      '{"locked_copy":{"brand":"","product_name":"","capacity":""},"instructions":[{"index":1,"prompt":"只改标签"}]}',
      1,
    )).toThrow('English-only');
  });
});
