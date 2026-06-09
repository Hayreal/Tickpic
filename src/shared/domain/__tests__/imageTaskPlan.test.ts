import { describe, expect, it } from 'vitest';
import { buildImageTaskPlan } from '../imageTaskPlan';

describe('imageTaskPlan', () => {
  const config = {
    defaultModels: {
      generation: 'gemini-2.5-flash-image',
      vision: 'gpt-5.4-mini',
    },
    modelProtocol: 'openai',
    defaultCount: 4,
    maxCount: 4,
  } as const;

  it('resolves edit models for an edit feature', () => {
    const plan = buildImageTaskPlan({
      feature: 'replace_product',
      images: [
        { role: 'source', path: '/authorized/input/scene.png' },
        { role: 'product', path: '/authorized/input/product.png' },
      ],
      prompt: 'replace the bottle',
      modelOverrides: {
        edit: 'gpt-image-2-all',
      },
    }, config);

    expect(plan.executionStage).toEqual({
      kind: 'edit',
      model: 'gpt-image-2-all',
      protocol: 'openai',
    });
    expect(plan.executionImages).toEqual([
      { role: 'source', path: '/authorized/input/scene.png' },
      { role: 'product', path: '/authorized/input/product.png' },
    ]);
    expect(plan.count).toBe(4);
    expect(plan.mainPrompt).toContain('用目标产品替换场景原产品');
  });

  it('uses generation overrides and keeps prompt-only images out of execution stage', () => {
    const plan = buildImageTaskPlan({
      feature: 'prompt_only_main_asset',
      prompt: 'pink laundry cleaning sheet ad',
      count: 2,
      images: [
        { role: 'reference', path: '/authorized/input/style.png' },
        { role: 'style', path: '/authorized/input/light.png' },
      ],
      modelOverrides: {
        generation: 'gpt-image-2-all',
      },
    }, config);

    expect(plan.executionStage).toEqual({
      kind: 'generation',
      model: 'gpt-image-2-all',
      protocol: 'openai',
    });
    expect(plan.executionImages).toEqual([]);
    expect(plan.count).toBe(2);
  });

  it('builds output aspect-ratio params from the request', () => {
    const plan = buildImageTaskPlan({
      feature: 'sticker_original',
      productCategory: 'cleaning sheets',
      aspectRatio: '9:16',
    }, config);

    expect(plan.outputAspectRatio).toBe('9:16');
    expect(plan.openaiImageSize).toBe('1024x1536');
  });

  it('passes auto sizing through to execution params', () => {
    const plan = buildImageTaskPlan({
      feature: 'replace_logo',
      aspectRatio: 'auto',
      images: [
        { role: 'source', path: '/authorized/input/scene.png' },
        { role: 'logo', path: '/authorized/input/logo.png' },
      ],
    }, config);

    expect(plan.outputAspectRatio).toBe('auto');
    expect(plan.openaiImageSize).toBe('auto');
  });

  it('rejects tasks when the settings generation model is not configured', () => {
    expect(() => buildImageTaskPlan({
      feature: 'sticker_original',
      productCategory: 'cleaning sheets',
    }, {
      ...config,
      defaultModels: { generation: '', vision: 'gpt-5.4-mini' },
    })).toThrow('generation model is not configured in settings');
  });

  it('rejects counts above the configured maximum', () => {
    expect(() => buildImageTaskPlan({
      feature: 'sticker_original',
      productCategory: 'cleaning sheets',
      count: 5,
    }, config)).toThrow('count must be less than or equal to 4');
  });
});
