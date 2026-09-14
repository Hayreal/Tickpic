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

  it('plans one carousel set with a distinct layout and SKU placement per main image', () => {
    const prompt = buildProductSetVisionSystemPrompt('product_main_image');
    const text = buildProductSetVisionUserText({
      feature: 'product_main_image',
      count: 3,
      prompt: 'premium studio lighting',
      negativePrompt: 'no extra bottles',
      scenePrompt: 'show an expected Before/After outcome',
    }, 3);
    const single = buildProductSetVisionUserText({
      feature: 'product_main_image',
      count: 1,
    }, 1);

    expect(prompt).toContain('由你决定每张的 presentation_mode');
    expect(prompt).toContain('至少 3 项明显不同');
    expect(prompt).toContain('requested_count = 1 时只输出一张完整主图');
    expect(prompt).toContain('prompt=补充提示词');
    expect(prompt).toContain('scenePrompt=具体场景词');
    expect(prompt).toContain('主图标题要有电商主标题力度');
    expect(prompt).toContain('SKU 仍是 Photoshop 抠图图层');
    expect(prompt).toContain('禁止整批都落成「左上标题、右下产品、其余铺场景」');
    expect(prompt).toContain('你必须自己生成 set_style');
    expect(prompt).toContain('sku_placement');
    expect(prompt).toContain('headline_treatment');
    expect(prompt).toContain('不要图标行、卖点卡、信息块');
    expect(prompt).toContain('禁止套用固定的图1 opener / 图2 problem / 图3 result');
    expect(text).toContain('一组电商套图');
    expect(text).toContain('requested_count=3');
    expect(text).toContain('"requested_count": 3');
    expect(text).toContain('"show_product_by_index"');
    expect(text).toContain('"user_direction"');
    expect(text).toContain('"prompt": "premium studio lighting"');
    expect(text).toContain('"negative_prompt": "no extra bottles"');
    expect(text).toContain('"scene_prompt": "show an expected Before/After outcome"');
    expect(text).toContain('"main_image_planning_brief"');
    expect(text).toContain('"layout_family_menu"');
    expect(text).toContain('"lockup_ideas"');
    expect(text).toContain('"type_effect_menu"');
    expect(prompt).toContain('字体特效');
    expect(text).toContain('"sku_placement"');
    expect(text).toContain('"headline_treatment"');
    expect(text).not.toContain('"set_role": "opener"');
    expect(text).not.toContain('Hero lockup');
    expect(text).not.toContain('main_image_layout_plan');
    expect(text).not.toContain('batch_presentation_plan');
    expect(single).toContain('请只规划 1 张主图');
    expect(single).toContain('"requested_count": 1');
    expect(single).not.toContain('requested_count=3');
  });

  it('forbids handheld and spray roles on main image', () => {
    const prompt = buildProductSetVisionSystemPrompt('product_main_image');

    expect(prompt).toContain('禁止 handheld_use 与 effect_demo');
    expect(prompt).toContain('禁止手持握瓶和喷雾');
    expect(prompt).not.toContain('真实品类对应的使用动作或使用后效果');
  });

  it('plans a distinct comparison layout for every auto-layout variant', () => {
    const prompt = buildProductSetVisionSystemPrompt('product_comparison_image');
    const text = buildProductSetVisionUserText({
      feature: 'product_comparison_image',
      comparisonLayout: 'auto',
      images: [{ role: 'product', path: '/authorized/input/product.png' }],
    }, 4);

    expect(prompt).not.toContain('一组电商套图');
    expect(prompt).not.toContain('main_image_layout_plan');
    expect(text).not.toContain('main_image_layout_plan');
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
