import { describe, expect, it } from 'vitest';
import { getImageFeatureDefinition } from '../../../../../src/shared/domain/imageFeatureApi';
import { ENGLISH_ONLY_VISIBLE_TEXT_RULE } from '../../../../../src/shared/domain/imageOutputRules';
import {
  buildExecutionPrompt,
  buildFallbackFinalPrompt,
  buildInstructionUserText,
  finalizeImageInstruction,
  isImageGenerationModel,
  sanitizeRequestForInstruction,
} from '../instructionPrompt';
import { buildProductSetSpec } from '../productSetJsonPrompt';

const STICKER_REPLICA_MAIN_PROMPT =
  '从当前产品图中提取产品表面的贴纸/标签，展开为正视角 2D 平面贴纸图。比例按原贴纸真实形状自主判断，不强制固定画幅。若输入是侧拍、斜拍、弧面或可见包装侧面，必须将可见贴纸/包装版面去透视并拉平成连续平面展开稿，不保留盒体侧面、厚度、折角、阴影、反光或 3D 透视。只输出贴纸本身，不输出产品容器或背景。保留原贴纸的排版、色系、风格、装饰元素和图案位置；画面文字须为英文，若原图文字为中文则翻译为对应英文后呈现。若提供单独 Logo 图，仅作为品牌标识嵌入到对应位置，不作为版式、配色或风格参考。';

function withEnglishOnlyRule(...lines: string[]) {
  return [...lines, ENGLISH_ONLY_VISIBLE_TEXT_RULE].join('\n');
}

function productSetSpec(request: Parameters<typeof buildExecutionPrompt>[0]) {
  return buildProductSetSpec(request);
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

    expect(buildFallbackFinalPrompt(input)).toContain('模式: 贴纸复刻。');
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

    expect(text).toContain('目标画布比例: "1:1"');
    expect(text).toContain('summer style');
    expect(text).toContain('标签设计铺满整个画布');
    expect(text).not.toContain('四边出血');
    expect(text).not.toContain('Write one concise');
    expect(text).not.toContain('Extra:');
    expect(text).not.toContain('mainPrompt');
  });

  it('routes product-set execution prompts through compact natural language', () => {
    const text = buildExecutionPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
      scenePrompt: 'fixative spray',
      prompt: 'premium look',
      negativePrompt: 'extra bottles',
      count: 3,
      aspectRatio: '1:1',
    }, 'ignored main prompt');

    expect(text).not.toMatch(/^\s*\{/);
    expect(text).not.toContain('"sku_lock"');
    expect(text).not.toContain('--- BATCH DIVERSITY');
    expect(text).not.toContain(ENGLISH_ONLY_VISIBLE_TEXT_RULE);
    expect(text).toContain('Use the supplied SKU as the only product identity reference.');
    expect(text).toContain('Show a natural hand directly using or holding the SKU beside the actual use target.');
    expect(text).toContain('When showing product action, it must originate from the SKU’s real actuator');
    expect(text).toContain('User scene direction: fixative spray.');
    expect(text).toContain('Additional direction: premium look.');
    expect(text).toContain('Avoid: extra bottles.');
  });

  it.each(['auto', 'handheld', 'not_handheld'] as const)('maps main-image handheld mode %s into JSON', (productHandheldMode) => {
    const spec = productSetSpec({ feature: 'product_main_image', productHandheldMode });
    if (productHandheldMode === 'handheld') {
      expect(spec.handheld.mode).toBe('handheld');
    } else {
      expect(spec.handheld.mode).toBe('not_handheld');
    }
    if (productHandheldMode === 'handheld') {
      expect(spec.handheld.rules.join(' ')).toMatch(/thumb must be visible/i);
      expect(spec.handheld.rules.join(' ')).toMatch(/wrist/i);
    } else {
      expect(spec.handheld.rules.join(' ')).toMatch(/must not be held/i);
    }
  });

  it.each(['auto', 'show', 'hide'] as const)('maps main-image effect mode %s into JSON', (productEffectMode) => {
    const spec = productSetSpec({ feature: 'product_main_image', productEffectMode });
    expect(spec.effect.mode).toBe(productEffectMode);
    if (productEffectMode === 'show') {
      expect(spec.spray_physics.nozzle_must_match_sku).toBe(true);
    } else {
      expect(spec.spray_physics).toBeUndefined();
    }
  });

  it.each([
    ['auto', 'horizontal'],
    ['horizontal', 'horizontal'],
    ['vertical', 'vertical'],
    ['grid_2x2', 'grid_2x2'],
    ['grid_3x2', 'grid_3x2'],
  ] as const)('maps comparison layout %s into its effective layout', (comparisonLayout, expectedLayout) => {
    const spec = productSetSpec({ feature: 'product_comparison_image', comparisonLayout, showProduct: true });
    expect(spec.composition.layout).toBe(expectedLayout);
    expect(spec.product_overlay.enabled).toBe(true);
    expect(String(spec.product_overlay.scale)).toMatch(/larger|hero/i);
  });

  it.each(['light', 'medium', 'heavy'] as const)('maps comparison intensity %s into JSON', (comparisonIntensity) => {
    const spec = productSetSpec({ feature: 'product_comparison_image', comparisonIntensity });
    expect(spec.intensity).toBe(comparisonIntensity);
    expect(String(spec.intensity_guidance).length).toBeGreaterThan(10);
  });

  it('disables comparison product overlay when showProduct is false', () => {
    const spec = productSetSpec({
      feature: 'product_comparison_image',
      comparisonLayout: 'horizontal',
      showProduct: false,
    });
    expect(spec.product_overlay.enabled).toBe(false);
    expect(spec.panels.sku_inside_panels).toBe(false);
    expect(spec.copy.allowed_labels).toEqual(['BEFORE', 'AFTER']);
  });

  it.each(['single', 'collage', 'grid'] as const)('maps multi-scene layout %s into JSON', (multiSceneLayout) => {
    const spec = productSetSpec({ feature: 'product_multi_scene', multiSceneLayout });
    expect(spec.composition.layout).toBe(multiSceneLayout);
    expect(spec.composition.sku_in_frame).toBe(false);
    expect(spec.composition.people_allowed).toBe(false);
  });

  it('keeps multi-scene hard exclusions even when user asks for product and people', () => {
    const spec = productSetSpec({
      feature: 'product_multi_scene',
      prompt: 'Show the branded bottle held by a smiling person with marketing text.',
    });
    expect(spec.composition.sku_in_frame).toBe(false);
    expect(spec.composition.people_allowed).toBe(false);
    expect(spec.user_overrides.priority).toMatch(/sku_lock/i);
    expect(spec.negative_prompt.join(' ')).toMatch(/SKU|people|hands/i);
  });

  it('adds batch_output for multi-count product-set requests and forbids in-frame stacking', () => {
    const first = productSetSpec({ feature: 'product_main_image', count: 3 });
    const second = productSetSpec({ feature: 'product_main_image', count: 6 });
    const one = productSetSpec({ feature: 'product_main_image', count: 1 });

    expect(first.composition.strategy).toBe('free_within_controls');
    expect(first.batch_output).toEqual(expect.objectContaining({
      count: 3,
      require_distinct: true,
      diversity: expect.objectContaining({
        slots: expect.arrayContaining([
          expect.objectContaining({ index: 1 }),
          expect.objectContaining({ index: 2 }),
          expect.objectContaining({ index: 3 }),
        ]),
      }),
    }));
    expect(first.batch_output.forbidden.join(' ')).toMatch(/stack|collage|layer|recolor-only/i);
    expect(second.batch_output.count).toBe(6);
    expect(one.batch_output).toBeUndefined();
    expect(first.variant).toBeUndefined();
  });

  it('omits variant from product-set JSON when only one variant field is present', () => {
    const byIndex = productSetSpec({ feature: 'product_multi_scene', variantIndex: 2 });
    const byTotal = productSetSpec({ feature: 'product_multi_scene', variantTotal: 4 });
    expect(byIndex.variant).toBeUndefined();
    expect(byTotal.variant).toBeUndefined();
  });

  it('stores user scene/supplement/avoid inside product-set JSON overrides', () => {
    const spec = productSetSpec({
      feature: 'product_comparison_image',
      comparisonLayout: 'vertical',
      comparisonIntensity: 'heavy',
      showProduct: false,
      scenePrompt: '  stained tile wall  ',
      prompt: '  keep the camera fixed  ',
      negativePrompt: '  added products  ',
      count: 3,
    });

    expect(spec.user_overrides).toEqual(expect.objectContaining({
      scene: 'stained tile wall',
      supplement: 'keep the camera fixed',
      avoid: 'added products',
    }));
    expect(spec.batch_output).toEqual(expect.objectContaining({ count: 3 }));
    expect(spec.composition.one_pair_only).toMatch(/exactly one matched BEFORE\/AFTER pair/i);
    expect(spec.variant).toBeUndefined();
  });

  it('omits empty product-set override strings', () => {
    const spec = productSetSpec({
      feature: 'product_main_image',
      scenePrompt: '  ',
      prompt: ' ',
      negativePrompt: '',
    });
    expect(spec.user_overrides).not.toHaveProperty('scene');
    expect(spec.user_overrides).not.toHaveProperty('supplement');
    expect(spec.user_overrides).not.toHaveProperty('avoid');
    expect(spec.user_overrides.priority).toEqual(expect.any(String));
    expect(spec.variant).toBeUndefined();
  });

  it('includes selected sticker variation direction in execution prompt', () => {
    const text = buildExecutionPrompt({
      feature: 'sticker_variation',
      stickerVariationDirection: 'layout',
      prompt: '保留原来的清洁剂品类',
    }, '基于输入产品图贴纸，做贴纸裂变设计。');

    expect(text).toContain('裂变方向: 排版打乱重组。');
    expect(text).toContain('允许变化：重新安排允许文案来源中的文字、图形和色块的位置与组合');
    expect(text).toContain('保留原来的清洁剂品类');
    expect(text).toContain('其他可见文字必须是自然英文');
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

    expect(text).toContain('产品名: "wuku"');
    expect(text).toContain('产品品类: "汽车玻璃水"');
    expect(text).toContain('卖点来源: "清洁强"');
    expect(text).not.toContain('品牌: "wuku"');
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

  it('appends the global English-only constraint to main and supplemental prompts', () => {
    const text = buildExecutionPrompt({
      feature: 'remove_product',
      prompt: '保留顶部标题',
    }, '去除目标产品。');

    expect(text).toBe(withEnglishOnlyRule(
      '去除目标产品。',
      '补充要求：保留顶部标题',
    ));
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

    expect(text).toContain('模式: 贴纸复刻。');
    expect(text).toContain('品牌: "WKUA®"');
    expect(text).toContain('产品名: "Serum Pro"');
    expect(text).toContain('产品品类: "car belt silencer"');
    expect(text).toContain('配色方向: "black and gold"');
    expect(text).not.toContain('Write one concise');
    expect(text).not.toContain('Extra:');
    expect(text).not.toContain('/tmp/logo.png');
    expect(text).toContain('图片 2：品牌参考图');
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

    expect(text).toBe(withEnglishOnlyRule(
      mainPrompt,
      '补充要求：鞋子除味喷雾，生成一套全英文电商主图',
      '卖点包括 Easy to pack、Fresh scent。',
      '需要展示产品。',
    ));
    expect(text).toContain('不得出现任何中文字符');
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

  it.each([
    'product_main_image',
    'product_comparison_image',
    'product_multi_scene',
  ] as const)('rewrites create wording into SKU edit wording for %s', (feature) => {
    const finalized = finalizeImageInstruction(
      feature,
      'Create a polished ecommerce image from the supplied products.',
      {
        feature,
        images: [{ role: 'product', path: '/tmp/product.png' }],
      },
    );

    expect(finalized).toBe('Edit the SKU reference images to produce a polished ecommerce image from the supplied products.');
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

  it('routes sku hit main image through its own prompt instead of bottle SKU prompt', () => {
    const prompt = buildExecutionPrompt({
      feature: 'sku_hit_main_image',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/hit-main.png' },
      ],
      brand: 'wkau',
    }, 'short main prompt that should not be concatenated');

    expect(prompt).toContain('图 1');
    expect(prompt).toContain('爆款主图参考');
    expect(prompt).toContain('品牌: "wkau"');
    expect(prompt).not.toContain('输出一张完整的 SKU 产品图');
    expect(prompt).not.toContain('short main prompt that should not be concatenated');
  });
});

