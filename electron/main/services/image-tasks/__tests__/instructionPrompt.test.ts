import { describe, expect, it } from 'vitest';
import { buildFallbackFinalPrompt, buildInstructionUserText, isImageGenerationModel, sanitizeRequestForInstruction } from '../instructionPrompt';
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

  it('removes count from instruction-stage request payload', () => {
    const request = {
      feature: 'sticker_variation' as const,
      count: 4,
      prompt: 'summer style',
    };

    expect(sanitizeRequestForInstruction(request)).toEqual({
      feature: 'sticker_variation',
      prompt: 'summer style',
    });
  });

  it('builds instruction user text for one standalone output image', () => {
    const input = {
      task: {
        feature: 'sticker_variation',
        request: {
          feature: 'sticker_variation',
          count: 4,
          prompt: 'summer style',
        },
      },
      plan: {
        mainPrompt: '生成贴纸变体',
      },
    } as unknown as ModelInstructionClientInput;

    const text = buildInstructionUserText(input);

    expect(text).not.toContain('"count":4');
    expect(text).toContain('ONE standalone output image');
    expect(text).toContain('summer style');
  });
});
