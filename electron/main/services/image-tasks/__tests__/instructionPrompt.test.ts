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

  it('builds natural instruction user text without redundant mainPrompt or image paths', () => {
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
        mainPrompt: '去除目标产品并补全背景。',
      },
    } as unknown as ModelInstructionClientInput;

    const text = buildInstructionUserText(input);

    expect(text).toBe('参考上传的图片，移除目标产品并自然补全背景。');
    expect(text).not.toContain('mainPrompt');
    expect(text).not.toContain('/tmp/source.png');
    expect(text).not.toContain('foreground overlays');
    expect(text).not.toContain('Write one concise');
    expect(text).not.toContain('Return one short');
  });

  it('uses natural generation wording for prompt-only features', () => {
    const text = buildInstructionUserText({
      task: {
        feature: 'prompt_only_main_asset',
        request: {
          feature: 'prompt_only_main_asset',
          prompt: 'pink laundry ad',
        },
      },
      plan: {
        mainPrompt: '根据用户描述完成电商主图或广告素材生成。',
      },
    } as unknown as ModelInstructionClientInput);

    expect(text).toBe([
      '根据文本提示创建一张电商主图或广告素材。',
      '补充要求：pink laundry ad',
    ].join('\n'));
    expect(text).not.toContain('image-generation instruction');
    expect(text).not.toContain('under 60 words total');
  });

  it('includes non-empty user parameters in natural instruction user text', () => {
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

    expect(text).toBe([
      '参考上传的贴纸图，生成一张同品类氛围的新 2D 平面贴纸。',
      '补充要求：summer style',
      '输出比例是 1:1。',
    ].join('\n'));
    expect(text).not.toContain('Write one concise');
    expect(text).not.toContain('Extra:');
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

  it('includes user note in natural instruction user text for remove product', () => {
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
        mainPrompt: '局部去除目标产品并补全遮挡区域。',
      },
    } as unknown as ModelInstructionClientInput);

    expect(text).toContain('补充要求：不要去除车灯上面的污渍');
    expect(text).not.toContain('parameters:');
    expect(text).not.toContain('Return one short');
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

  it('builds sticker-replica user text as a natural parameter summary', () => {
    const text = buildInstructionUserText({
      task: {
        feature: 'sticker_replica',
        request: {
          feature: 'sticker_replica',
          images: [
            { role: 'source', path: '/tmp/package.png' },
            { role: 'logo', path: '/tmp/logo.png' },
          ],
          prompt: '品牌名换成 WKUA，整体保留原图的高级黑金风格。',
          productName: 'WKUA',
          productCategory: 'car belt silencer',
          colorScheme: 'black and gold',
        },
      },
      plan: {
        mainPrompt: '从包装参考图提取版式，输出独立 2D 平面贴纸。',
      },
    } as unknown as ModelInstructionClientInput);

    expect(text).toBe([
      '提取上传图片中产品上的贴纸，输出独立 2D 平面贴纸。',
      '补充要求：品牌名换成 WKUA，整体保留原图的高级黑金风格。',
      '品牌名换成 WKUA。',
      '产品品类是 car belt silencer。',
      '整体保留原图的 black and gold 风格。',
      '如果提供了单独 Logo 图，只把它作为品牌标识嵌入，不要把 Logo 图当作版式参考。',
    ].join('\n'));
    expect(text).not.toContain('Write one concise');
    expect(text).not.toContain('Extra:');
    expect(text).not.toContain('/tmp/logo.png');
  });

  it('appends sticker-extraction guardrail to sticker replica execution instructions', () => {
    const finalized = finalizeImageInstruction(
      'sticker_replica',
      'Replicate the pink effervescent-tablet label with bold red English typography and the wkau logo.',
      {
        feature: 'sticker_replica',
        images: [
          { role: 'source', path: '/tmp/package.png' },
          { role: 'logo', path: '/tmp/logo.png' },
        ],
      },
    );

    expect(finalized).toContain('Output only the extracted flat 2D sticker/label');
    expect(finalized).toContain('no product body, bottle, box, jar, packaging mockup');
    expect(finalized).not.toContain('similar rectangular layout');
  });

  it('appends meaningful-redesign guardrail to sticker variation execution instructions', () => {
    const finalized = finalizeImageInstruction(
      'sticker_variation',
      'Edit the source sticker to produce a flat 2D black-and-white spray label with a central diamond 8 card-suit emblem and matching corner markings.',
      {
        feature: 'sticker_variation',
        images: [{ role: 'source', path: '/tmp/sticker.png' }],
      },
    );

    expect(finalized).toContain('make a clearly different layout');
    expect(finalized).toContain('not a small text, icon, suit, or color swap');
    expect(finalized).not.toContain('substantially rework');
    expect(finalized).not.toContain('near-copy');
  });

  it('does not duplicate sticker variation redesign guardrail when already present', () => {
    const finalized = finalizeImageInstruction(
      'sticker_variation',
      'Edit the source sticker into a new flat 2D label; make a clearly different layout.',
      {
        feature: 'sticker_variation',
        images: [{ role: 'source', path: '/tmp/sticker.png' }],
      },
    );

    expect(finalized.match(/make a clearly different layout/g)).toHaveLength(1);
  });

  it('rewrites create wording into edit wording for sticker replica execution', () => {
    const finalized = finalizeImageInstruction(
      'sticker_replica',
      'Create an independent flat 2D sticker with bold red English typography and the black wkau logo, with no packaging mockup.',
      {
        feature: 'sticker_replica',
        images: [{ role: 'source', path: '/tmp/package.png' }],
      },
    );

    expect(finalized).toBe(
      'Edit the source image to extract an independent flat 2D sticker with bold red English typography and the black wkau logo, with no packaging mockup.',
    );
    expect(finalized).not.toMatch(/^Create\b/i);
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
