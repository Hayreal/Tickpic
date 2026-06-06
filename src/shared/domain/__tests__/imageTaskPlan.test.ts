import { describe, expect, it } from 'vitest';
import { buildImageTaskPlan } from '../imageTaskPlan';

describe('imageTaskPlan', () => {
  const config = {
    defaultModels: {
      generation: 'gemini-2.5-flash-image',
    },
    modelProtocols: {
      'gemini-3.1-flash-lite': 'gemini',
      'gemini-2.5-flash-image': 'gemini',
      'gpt-image-2': 'openai',
      'gpt-5.4-mini': 'openai',
    },
    defaultCount: 4,
    maxCount: 8,
  } as const;

  it('resolves vision and edit models for an edit feature', () => {
    const plan = buildImageTaskPlan({
      feature: 'replace_product',
      images: [
        { role: 'source', path: '/authorized/input/scene.png' },
        { role: 'product', path: '/authorized/input/product.png' },
      ],
      prompt: 'replace the bottle',
      modelOverrides: {
        vision: 'gpt-5.4-mini',
      },
    }, config);

    expect(plan.instructionStage).toEqual({
      model: 'gpt-5.4-mini',
      protocol: 'openai',
    });
    expect(plan.executionStage).toEqual({
      kind: 'edit',
      model: 'gemini-2.5-flash-image',
      protocol: 'gemini',
    });
    expect(plan.executionImages).toEqual([
      { role: 'source', path: '/authorized/input/scene.png' },
      { role: 'product', path: '/authorized/input/product.png' },
    ]);
    expect(plan.count).toBe(4);
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
        generation: 'gpt-image-2',
      },
    }, config);

    expect(plan.executionStage).toEqual({
      kind: 'generation',
      model: 'gpt-image-2',
      protocol: 'openai',
    });
    expect(plan.instructionImages).toHaveLength(2);
    expect(plan.executionImages).toEqual([]);
    expect(plan.count).toBe(2);
  });

  it('builds the documented instruction system prompt and output aspect-ratio params', () => {
    const plan = buildImageTaskPlan({
      feature: 'sticker_original',
      productCategory: 'cleaning sheets',
      aspectRatio: '9:16',
    }, config);

    expect(plan.instructionSystemPrompt).toContain('Your task is not to generate images.');
    expect(plan.instructionSystemPrompt).toContain('You are performing the "Original Sticker Design" task.');
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

  it('rejects selected models without a configured protocol mapping', () => {
    expect(() => buildImageTaskPlan({
      feature: 'sticker_original',
      productCategory: 'cleaning sheets',
      modelOverrides: {
        generation: 'unknown-image-model',
      },
    }, config)).toThrow('model unknown-image-model is missing protocol mapping');
  });

  it('rejects counts above the configured maximum', () => {
    expect(() => buildImageTaskPlan({
      feature: 'sticker_original',
      productCategory: 'cleaning sheets',
      count: 9,
    }, config)).toThrow('count must be less than or equal to 8');
  });
});
