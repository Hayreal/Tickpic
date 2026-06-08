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
        mainPrompt: '在原图中局部去除目标产品并补全被遮挡区域。',
      },
    } as unknown as ModelInstructionClientInput;

    const text = buildInstructionUserText(input);

    expect(text).toBe([
      'feature: remove_product',
      'taskGoal: 在原图中局部去除目标产品并补全被遮挡区域。',
      'Return only the final image instruction text for ONE standalone output image.',
    ].join('\n'));
    expect(text).not.toContain('mainPrompt');
    expect(text).not.toContain('/tmp/source.png');
    expect(text).not.toContain('"count"');
    expect(text).not.toContain('"regions"');
    expect(text).not.toContain('aspectRatio');
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

    expect(text).toContain('feature: sticker_variation');
    expect(text).toContain('parameters: {"prompt":"summer style","aspectRatio":"1:1"}');
    expect(text).toContain('ONE standalone output image');
    expect(text).not.toContain('mainPrompt');
  });

  it('appends hard guardrails to remove-product execution instructions', () => {
    const finalized = finalizeImageInstruction(
      'remove_product',
      'Remove the spray bottle in the right hand only.',
      {
        feature: 'remove_product',
        images: [{ role: 'source', path: '/tmp/source.png' }],
      },
    );

    expect(finalized).toContain('Remove the spray bottle in the right hand only.');
    expect(finalized).toContain('fixed base layer');
    expect(finalized).toContain('Do not replace the background');
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
    expect(finalized).toContain('Inpaint only the removed target product area');
  });
});
