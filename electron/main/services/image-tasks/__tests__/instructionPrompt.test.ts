import { describe, expect, it } from 'vitest';
import {
  buildFallbackFinalPrompt,
  buildInstructionUserText,
  finalizeImageInstruction,
  isImageGenerationModel,
  sanitizeRequestForInstruction,
} from '../instructionPrompt';
import type { ModelInstructionClientInput } from '../modelGateway';

describe('instructionPrompt', () => {
  it('detects image-only model ids', () => {
    expect(isImageGenerationModel('gpt-image-2-all')).toBe(true);
    expect(isImageGenerationModel('gpt-5.4-mini')).toBe(false);
  });

  it('builds a fallback instruction from structured request fields', () => {
    const input = {
      model: 'gpt-image-2-all',
      systemPrompt: 'system',
      plan: {
        mainPrompt: 'extract sticker',
        request: { feature: 'sticker_replica' },
      },
      task: {
        feature: 'sticker_replica',
        request: {
          feature: 'sticker_replica',
          prompt: 'keep layout',
          productName: 'Serum',
          colorScheme: 'pastel',
        },
      },
      images: [],
    } as unknown as ModelInstructionClientInput;

    expect(buildFallbackFinalPrompt(input)).toContain('extract sticker');
    expect(buildFallbackFinalPrompt(input)).toContain('keep layout');
    expect(buildFallbackFinalPrompt(input)).toContain('Serum');
  });

  it('keeps only user-provided instruction parameters', () => {
    const request = {
      feature: 'remove_product' as const,
      count: 4,
      images: [{ role: 'source' as const, path: '/tmp/source.png' }],
      regions: [],
      aspectRatio: 'auto',
      prompt: 'remove only the spray bottle',
    };

    expect(sanitizeRequestForInstruction(request)).toEqual({
      prompt: 'remove only the spray bottle',
    });
  });

  it('builds instruction user text without redundant mainPrompt or image paths', () => {
    const input = {
      task: {
        feature: 'remove_product',
        request: {
          feature: 'remove_product',
          count: 4,
          images: [{ role: 'source', path: '/tmp/source.png' }],
          regions: [],
          aspectRatio: 'auto',
        },
      },
      plan: {
        mainPrompt: '去掉目标产品并在遮挡区域自然补全背景，保留场景演示效果。',
      },
    } as unknown as ModelInstructionClientInput;

    const text = buildInstructionUserText(input);

    expect(text).toBe([
      'Write one concise English image-edit instruction for "remove_product".',
      'Goal: 去掉目标产品并在遮挡区域自然补全背景，保留场景演示效果。',
      'Return one short executable sentence only, ideally under 35 words. No markdown or explanation.',
    ].join('\n'));
    expect(text).not.toContain('mainPrompt');
    expect(text).not.toContain('/tmp/source.png');
    expect(text).not.toContain('foreground overlays');
  });

  it('uses generation wording for prompt-only features', () => {
    const text = buildInstructionUserText({
      task: {
        feature: 'prompt_only_main_asset',
        request: {
          feature: 'prompt_only_main_asset',
          prompt: 'pink laundry ad',
        },
      },
      plan: {
        mainPrompt: '根据用户描述完成电商主图或广告素材生成',
      },
    } as unknown as ModelInstructionClientInput);

    expect(text).toContain('image-generation instruction');
    expect(text).toContain('under 60 words total');
    expect(text).toContain('User note: pink laundry ad');
  });

  it('includes non-empty user parameters in instruction user text', () => {
    const input = {
      task: {
        feature: 'sticker_variation',
        request: {
          feature: 'sticker_variation',
          count: 4,
          prompt: 'summer style',
          aspectRatio: '1:1',
        },
      },
      plan: {
        mainPrompt: '生成贴纸变体',
      },
    } as unknown as ModelInstructionClientInput;

    const text = buildInstructionUserText(input);

    expect(text).toContain('Write one concise English image-edit instruction for "sticker_variation".');
    expect(text).toContain('User note: summer style');
    expect(text).toContain('Extra: {"aspectRatio":"1:1"}');
    expect(text).toContain('under 35 words');
    expect(text).not.toContain('mainPrompt');
  });

  it('adds spray prefix only when the model omits spray or mist', () => {
    const finalized = finalizeImageInstruction(
      'remove_product',
      'Remove the spray bottle in the right hand only.',
      {
        feature: 'remove_product',
        images: [{ role: 'source', path: '/tmp/source.png' }],
      },
    );

    expect(finalized).toBe(
      'First fully erase foreground spray/mist overlays, not only behind the bottle. Remove the spray bottle in the right hand only. Inpaint removed areas to match adjacent background; keep everything else unchanged.',
    );
    expect(finalized).not.toContain('fully erase every foreground spray');
  });

  it('builds a safe default remove-product instruction when the model returns empty text', () => {
    const finalized = finalizeImageInstruction(
      'remove_product',
      '   ',
      {
        feature: 'remove_product',
        prompt: 'remove only the spray bottle on the right',
        images: [{ role: 'source', path: '/tmp/source.png' }],
      },
    );

    expect(finalized).toContain('remove only the spray bottle on the right');
    expect(finalized).toContain('spray or mist overlays');
    expect(finalized).not.toContain('First fully erase foreground spray');
    expect(finalized).toContain('Inpaint removed areas to match adjacent background');
  });

  it('includes user note in instruction user text for remove product', () => {
    const text = buildInstructionUserText({
      task: {
        feature: 'remove_product',
        request: {
          feature: 'remove_product',
          prompt: '不要去除车灯上面的污渍',
          images: [{ role: 'source', path: '/tmp/source.png' }],
        },
      },
      plan: {
        mainPrompt: '局部去除目标产品并补全遮挡区域，保留原背景、演示效果与文字，不顺带清洁或美化。',
      },
    } as unknown as ModelInstructionClientInput);

    expect(text).toContain('User note: 不要去除车灯上面的污渍');
    expect(text).not.toContain('parameters:');
  });

  it('skips spray prefix when the instruction already mentions mist', () => {
    const finalized = finalizeImageInstruction(
      'remove_product',
      'Remove the spray bottle, hand, and white mist from the nozzle.',
      {
        feature: 'remove_product',
        images: [{ role: 'source', path: '/tmp/source.png' }],
      },
    );

    expect(finalized).toBe(
      'Remove the spray bottle, hand, and white mist from the nozzle. Inpaint removed areas to match adjacent background; keep everything else unchanged.',
    );
    expect(finalized).not.toContain('First fully erase foreground spray');
  });

  it('resolves demonstration-effect conflict and strips legacy suffix from execution prompt', () => {
    const finalized = finalizeImageInstruction(
      'remove_product',
      'Remove the spray bottle, holding hand, and mist, inpainting only their occluded areas to match the original background while preserving text, rust, stains, rails, and demonstration effects. Inpaint only the removed area to match adjacent background; keep everything else unchanged.',
      {
        feature: 'remove_product',
        images: [{ role: 'source', path: '/tmp/source.png' }],
      },
    );

    expect(finalized).toContain('spray and mist overlays are not demonstration effects');
    expect(finalized).not.toContain('Inpaint only the removed area to match adjacent background');
    expect(finalized).toContain('inpaint where the product blocked the background');
    expect(finalized).not.toContain('First fully erase foreground spray');
    expect(finalized).toContain('Inpaint removed areas to match adjacent background');
  });
});
