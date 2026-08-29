import { describe, expect, it } from 'vitest';
import {
  buildSkuVisionSystemPrompt,
  buildSkuVisionUserText,
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

  it('rejects a vision batch with Chinese execution text', () => {
    expect(() => parseSkuVisionBatch(
      '{"instructions":[{"index":1,"prompt":"只改标签"}]}',
      1,
    )).toThrow('English-only');
  });
});
