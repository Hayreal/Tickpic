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

  it('asks Vision to choose a distinct carousel role for each main image', () => {
    const prompt = buildProductSetVisionSystemPrompt('product_main_image');
    const text = buildProductSetVisionUserText({
      feature: 'product_main_image',
      count: 3,
      scenePrompt: 'show an expected Before/After outcome',
    }, 3);

    expect(prompt).toContain('由你决定每张的 presentation_mode');
    expect(prompt).toContain('至少 3 项明显不同');
    expect(text).not.toContain('batch_presentation_plan');
  });

  it('treats effect demos as category-specific use instead of defaulting to spray', () => {
    const prompt = buildProductSetVisionSystemPrompt('product_main_image');

    expect(prompt).toContain('真实品类对应的使用动作或使用后效果');
    expect(prompt).toContain('非喷雾类 SKU 禁止生成喷雾、雾气或虚构喷嘴');
  });

  it('plans a distinct comparison layout for every auto-layout variant', () => {
    const text = buildProductSetVisionUserText({
      feature: 'product_comparison_image',
      comparisonLayout: 'auto',
      images: [{ role: 'product', path: '/authorized/input/product.png' }],
    }, 4);
    const payload = JSON.parse(text.split('\n\n')[1]!) as {
      comparison_layout_plan?: Array<{ layout: string; evidence_framing: string }>;
    };

    expect(payload.comparison_layout_plan?.map((item) => item.layout)).toEqual([
      'horizontal',
      'vertical',
      'grid_2x2',
      'grid_3x2',
    ]);
    expect(payload.comparison_layout_plan?.map((item) => item.evidence_framing)).toEqual([
      'tight macro crop of one clear problem area',
      'contextual medium-distance crop showing the object and target region',
      'edge-to-edge material-detail crop that emphasizes texture or boundary damage',
      'wider crop that establishes the whole object while keeping the evidence readable',
    ]);
  });

  it('plans varied multi-scene geometry instead of repeating a six-cell grid', () => {
    const text = buildProductSetVisionUserText({
      feature: 'product_multi_scene',
      multiSceneLayout: 'grid',
      images: [{ role: 'product', path: '/authorized/input/product.png' }],
    }, 3);
    const payload = JSON.parse(text.split('\n\n')[1]!) as {
      multi_scene_layout_plan?: Array<{ layout: string; panel_count: number }>;
    };

    expect(payload.multi_scene_layout_plan).toEqual([
      expect.objectContaining({ layout: 'grid_2x2', panel_count: 4 }),
      expect.objectContaining({ layout: 'grid_2x3', panel_count: 6 }),
      expect.objectContaining({ layout: 'grid_3x2', panel_count: 6 }),
    ]);
  });
});
