import { describe, expect, it } from 'vitest';
import {
  buildProductSetVisionSystemPrompt,
  buildProductSetVisionUserText,
} from '../productSetVisionPrompt';

describe('productSetVisionPrompt', () => {
  it('keeps the vision system prompt focused on its own small JSON schema', () => {
    const prompt = buildProductSetVisionSystemPrompt('product_main_image');

    expect(prompt).not.toContain('静态执行模板参考');
    expect(prompt).not.toContain('"sku_lock"');
    expect(prompt).toContain('最终 SKU 锁定与执行提示词由后续渲染器处理');
  });

  it('plans a distinct comparison layout for every auto-layout variant', () => {
    const text = buildProductSetVisionUserText({
      feature: 'product_comparison_image',
      comparisonLayout: 'auto',
      images: [{ role: 'product', path: '/authorized/input/product.png' }],
    }, 4);
    const payload = JSON.parse(text.split('\n\n')[1]!) as {
      comparison_layout_plan?: Array<{ layout: string }>;
    };

    expect(payload.comparison_layout_plan?.map((item) => item.layout)).toEqual([
      'horizontal',
      'vertical',
      'grid_2x2',
      'grid_3x2',
    ]);
  });
});
