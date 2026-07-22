import { describe, expect, it } from 'vitest';
import { ENGLISH_ONLY_VISIBLE_TEXT_RULE } from '../../../../../src/shared/domain/imageOutputRules';
import {
  buildExecutionPrompt,
  buildFallbackFinalPrompt,
  buildInstructionUserText,
  finalizeImageInstruction,
  isImageGenerationModel,
  sanitizeRequestForInstruction,
} from '../instructionPrompt';

const STICKER_REPLICA_MAIN_PROMPT =
  '从当前产品图中提取产品表面的贴纸/标签，展开为正视角 2D 平面贴纸图。比例按原贴纸真实形状自主判断，不强制固定画幅。若输入是侧拍、斜拍、弧面或可见包装侧面，必须将可见贴纸/包装版面去透视并拉平成连续平面展开稿，不保留盒体侧面、厚度、折角、阴影、反光或 3D 透视。只输出贴纸本身，不输出产品容器或背景。保留原贴纸的排版、色系、风格、装饰元素和图案位置；画面文字须为英文，若原图文字为中文则翻译为对应英文后呈现。若提供单独 Logo 图，仅作为品牌标识嵌入到对应位置，不作为版式、配色或风格参考。';

function withEnglishOnlyRule(...lines: string[]) {
  return [...lines, ENGLISH_ONLY_VISIBLE_TEXT_RULE].join('\n');
}

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
    };

    expect(buildFallbackFinalPrompt(input)).toContain('MODE: REPLICA');
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

  it('builds execution prompt from feature main prompt without image paths', () => {
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
        mainPrompt: '去除目标产品及喷雾/雾气叠加，补全遮挡区域；保留用户要求的文字与表面状态，不顺带清洁或美化。',
      },
    };

    const text = buildInstructionUserText(input);

    expect(text).toBe(withEnglishOnlyRule(
      '去除目标产品及喷雾/雾气叠加，补全遮挡区域；保留用户要求的文字与表面状态，不顺带清洁或美化。',
    ));
    expect(text).not.toContain('mainPrompt');
    expect(text).not.toContain('/tmp/source.png');
    expect(text).not.toContain('foreground overlays');
    expect(text).not.toContain('Write one concise');
    expect(text).not.toContain('Return one short');
  });

  it('appends user prompt for prompt-only features', () => {
    const text = buildExecutionPrompt({
      feature: 'prompt_only_main_asset',
      prompt: 'pink laundry ad',
    }, '根据用户描述完成电商主图或广告素材生成');

    expect(text).toBe(withEnglishOnlyRule(
      '根据用户描述完成电商主图或广告素材生成',
      '补充要求：pink laundry ad',
    ));
    expect(text).not.toContain('image-generation instruction');
    expect(text).not.toContain('under 60 words total');
  });

  it('includes non-empty user parameters in execution prompt', () => {
    const text = buildExecutionPrompt({
      feature: 'sticker_variation',
      count: 4,
      prompt: 'summer style',
      aspectRatio: '1:1',
    }, '生成同品类贴纸变体，可调整布局、标题区、卖点区与色块。');

    expect(text).toContain('TARGET CANVAS ASPECT RATIO: "1:1"');
    expect(text).toContain('summer style');
    expect(text).toContain('FLAT 2D LABEL ONLY');
    expect(text).not.toContain('Write one concise');
    expect(text).not.toContain('Extra:');
    expect(text).not.toContain('mainPrompt');
  });

  it('includes selected sticker variation direction in execution prompt', () => {
    const text = buildExecutionPrompt({
      feature: 'sticker_variation',
      stickerVariationDirection: 'layout',
      prompt: '保留原来的清洁剂品类',
    }, '基于输入产品图贴纸，做贴纸裂变设计。');

    expect(text).toContain('SELECTED VARIATION: 排版打乱重组。');
    expect(text).toContain('将原本的文字、产品图、功效图、色块和装饰元素重新安排');
    expect(text).toContain('保留原来的清洁剂品类');
    expect(text).toContain('Render no Chinese characters');
  });

  it('does not infer original sticker logo text from product name', () => {
    const text = buildInstructionUserText({
      task: {
        feature: 'sticker_original',
        request: {
          feature: 'sticker_original',
          productName: 'wuku',
          productCategory: '汽车玻璃水',
          sellingPoints: ['清洁强'],
        },
      },
      plan: {
        mainPrompt: '设计原创 2D 平面贴纸初稿。',
      },
    });

    expect(text).toContain('Product name: "wuku"');
    expect(text).toContain('Product category source: "汽车玻璃水"');
    expect(text).toContain('Selling point source: "清洁强"');
    expect(text).not.toContain('Logo text: "wuku"');
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
    });

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

  it('appends English-only visible text rule to every execution prompt', () => {
    const text = buildExecutionPrompt({
      feature: 'remove_product',
      prompt: '保留顶部标题',
    }, '去除目标产品。');

    expect(text).toContain(ENGLISH_ONLY_VISIBLE_TEXT_RULE);
    expect(text).toContain('不得出现任何中文字符');
  });

  it('builds sticker-replica execution prompt as a natural parameter summary', () => {
    const text = buildExecutionPrompt({
      feature: 'sticker_replica',
      images: [
        { role: 'source', path: '/tmp/package.png' },
        { role: 'logo', path: '/tmp/logo.png' },
      ],
      prompt: '品牌名换成 WKUA，整体保留原图的高级黑金风格。',
      brand: 'WKUA',
      productName: 'Serum Pro',
      productCategory: 'car belt silencer',
      colorScheme: 'black and gold',
    }, STICKER_REPLICA_MAIN_PROMPT);

    expect(text).toContain('MODE: REPLICA');
    expect(text).toContain('Brand: "WKUA®"');
    expect(text).toContain('Product name: "Serum Pro"');
    expect(text).toContain('Product category source: "car belt silencer"');
    expect(text).toContain('Color direction: "black and gold"');
    expect(text).not.toContain('Write one concise');
    expect(text).not.toContain('Extra:');
    expect(text).not.toContain('/tmp/logo.png');
    expect(text).toContain('Image 2: brand reference only');
  });

  it('leaves legacy sticker replica finalization neutral because the builder owns guardrails', () => {
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

    expect(finalized).toBe('Replicate the pink effervescent-tablet label with bold red English typography and the wkau logo.');
  });

  it('does not append a universal redesign guardrail to sticker variations', () => {
    const finalized = finalizeImageInstruction(
      'sticker_variation',
      'Edit the source sticker to produce a flat 2D black-and-white spray label with a central diamond 8 card-suit emblem and matching corner markings.',
      {
        feature: 'sticker_variation',
        images: [{ role: 'source', path: '/tmp/sticker.png' }],
      },
    );

    expect(finalized).not.toContain('make a clearly different layout');
    expect(finalized).toContain('central diamond 8 card-suit emblem');
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

  it('does not duplicate main image asset variation guardrail when prompt already requires meaningful redesign', () => {
    const mainPrompt = '基于输入图生成跨境电商主图。若输入已是主图/场景图，则生成明显不同的场景、标题排版或主视觉构图。';
    const finalized = finalizeImageInstruction(
      'main_image_asset_variation',
      mainPrompt,
      {
        feature: 'main_image_asset_variation',
        images: [{ role: 'source', path: '/tmp/main.png' }],
      },
    );

    expect(finalized).toBe(mainPrompt);
    expect(finalized).not.toContain('clearly different scene');
  });

  it('builds main image asset variation prompt with selling points and showProduct', () => {
    const mainPrompt = '基于输入图生成跨境电商主图。若输入是白底/孤立产品图，保留原产品外观、品牌、标签和关键文字，并补充生活方式场景、英文标题、卖点卡片、图标与商业光影。';
    const text = buildExecutionPrompt(
      {
        feature: 'main_image_asset_variation',
        prompt: '鞋子除味喷雾，生成一套全英文电商主图',
        sellingPoints: ['Easy to pack', 'Fresh scent'],
        showProduct: true,
        images: [{ role: 'source', path: '/tmp/product.png' }],
      },
      mainPrompt,
    );

    expect(text).toContain('鞋子除味喷雾，生成一套全英文电商主图');
    expect(text).toContain('卖点包括 Easy to pack、Fresh scent');
    expect(text).toContain('需要展示产品');
    expect(text).toContain('必须为英文');
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
