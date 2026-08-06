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
const PRODUCT_SET_CONFLICT_PRIORITY_GUARD = '优先级规则：用户具体场景、补充要求和反向要求仅执行不与前述功能硬规则及结构化控制项冲突的部分；发生冲突时必须忽略用户冲突内容，以前述规则为准。';

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

  it('orders multi-scene structured controls, prompts, and variant guidance', () => {
    const text = buildExecutionPrompt({
      feature: 'product_multi_scene',
      multiSceneLayout: 'collage',
      prompt: '  a kitchen counter in morning light  ',
      negativePrompt: '  marketing text  ',
      variantIndex: 2,
      variantTotal: 4,
    }, '根据 SKU 生成场景图。');

    expect(text).toBe(withEnglishOnlyRule(
      '根据 SKU 生成场景图。',
      '一张图组合多个适用场景，允许不规则拼贴，各区域边界清晰。',
      PRODUCT_SET_CONFLICT_PRIORITY_GUARD,
      '补充要求：a kitchen counter in morning light',
      '反向要求：避免出现以下内容：marketing text',
      '这是本批次第 2/4 张。生成与同批其他图片明显不同的场景或构图，同时遵守当前功能的全部固定规则。',
    ));
  });

  it.each([
    ['handheld', '必须出现自然的人手持有或操作 SKU。'],
    ['not_handheld', 'SKU 不得由手持有，可放置在场景主体位置。'],
  ] as const)('maps main-image handheld mode %s', (productHandheldMode, line) => {
    expect(buildExecutionPrompt({ feature: 'product_main_image', productHandheldMode }, 'main')).toContain(line);
  });

  it.each([
    ['auto', '根据 SKU 类型决定是否展示具体作用效果。'],
    ['show', '必须明确表现与 SKU 对应的作用过程或效果。'],
    ['hide', '只展示产品和适用环境，不展示作用过程或效果演示。'],
  ] as const)('maps main-image effect mode %s', (productEffectMode, line) => {
    expect(buildExecutionPrompt({ feature: 'product_main_image', productEffectMode }, 'main')).toContain(line);
  });

  it.each([
    ['auto', '根据比例和构图选择左右或上下布局。'],
    ['horizontal', 'Before 左、After 右。'],
    ['vertical', 'Before 上、After 下。'],
  ] as const)('maps comparison layout %s', (comparisonLayout, line) => {
    expect(buildExecutionPrompt({ feature: 'product_comparison_image', comparisonLayout }, 'main')).toContain(line);
  });

  it.each([
    ['light', '前后差异自然克制。'],
    ['medium', '前后差异清晰且可信。'],
    ['heavy', '强化视觉反差，但不得虚构产品无法支持的效果。'],
  ] as const)('maps comparison intensity %s', (comparisonIntensity, line) => {
    expect(buildExecutionPrompt({ feature: 'product_comparison_image', comparisonIntensity }, 'main')).toContain(line);
  });

  it.each([
    [true, 'After 必须展示 SKU。'],
    [false, 'After 只展示改善效果，不展示 SKU。'],
  ] as const)('maps comparison After product visibility %s', (showProduct, line) => {
    const text = buildExecutionPrompt({ feature: 'product_comparison_image', showProduct }, 'main');

    expect(text).toContain(line);
    expect(text).not.toContain(showProduct ? '需要展示产品。' : '不要展示产品。');
  });

  it.each([
    ['single', '每张只展示一个完整场景。'],
    ['collage', '一张图组合多个适用场景，允许不规则拼贴，各区域边界清晰。'],
    ['grid', '一张图使用规则网格展示多个适用场景。'],
  ] as const)('maps multi-scene layout %s', (multiSceneLayout, line) => {
    expect(buildExecutionPrompt({ feature: 'product_multi_scene', multiSceneLayout }, 'main')).toContain(line);
  });

  it('orders main-image controls before scene, generic, negative, and variant lines', () => {
    expect(buildExecutionPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
      scenePrompt: '  bathroom sink  ',
      prompt: '  warm daylight  ',
      negativePrompt: '  extra bottles  ',
      variantIndex: 1,
      variantTotal: 2,
    }, 'main')).toBe(withEnglishOnlyRule(
      'main',
      '必须出现自然的人手持有或操作 SKU。',
      '必须明确表现与 SKU 对应的作用过程或效果。',
      PRODUCT_SET_CONFLICT_PRIORITY_GUARD,
      '具体场景：bathroom sink',
      '补充要求：warm daylight',
      '反向要求：避免出现以下内容：extra bottles',
      '这是本批次第 1/2 张。生成与同批其他图片明显不同的场景或构图，同时遵守当前功能的全部固定规则。',
    ));
  });

  it('orders comparison controls before scene, generic, negative, and variant lines', () => {
    expect(buildExecutionPrompt({
      feature: 'product_comparison_image',
      comparisonLayout: 'vertical',
      comparisonIntensity: 'heavy',
      showProduct: false,
      scenePrompt: '  stained tile wall  ',
      prompt: '  keep the camera fixed  ',
      negativePrompt: '  added products  ',
      variantIndex: 2,
      variantTotal: 3,
    }, 'main')).toBe(withEnglishOnlyRule(
      'main',
      'Before 上、After 下。',
      '强化视觉反差，但不得虚构产品无法支持的效果。',
      'After 只展示改善效果，不展示 SKU。',
      PRODUCT_SET_CONFLICT_PRIORITY_GUARD,
      '具体场景：stained tile wall',
      '补充要求：keep the camera fixed',
      '反向要求：避免出现以下内容：added products',
      '这是本批次第 2/3 张。生成与同批其他图片明显不同的场景或构图，同时遵守当前功能的全部固定规则。',
    ));
  });

  it.each([
    {
      request: {
        feature: 'product_main_image' as const,
        productHandheldMode: 'not_handheld' as const,
        prompt: '必须手持 SKU 展示',
      },
      structuredLine: 'SKU 不得由手持有，可放置在场景主体位置。',
      userLine: '补充要求：必须手持 SKU 展示',
    },
    {
      request: {
        feature: 'product_comparison_image' as const,
        showProduct: false,
        prompt: 'After 必须展示 SKU 产品',
      },
      structuredLine: 'After 只展示改善效果，不展示 SKU。',
      userLine: '补充要求：After 必须展示 SKU 产品',
    },
  ])('places an explicit conflict guard before conflicting user text', ({ request, structuredLine, userLine }) => {
    const text = buildExecutionPrompt(request, 'main');
    expect(text).toContain(structuredLine);
    expect(text).toContain(PRODUCT_SET_CONFLICT_PRIORITY_GUARD);
    expect(text).toContain(userLine);
    expect(text.indexOf(structuredLine)).toBeLessThan(text.indexOf(PRODUCT_SET_CONFLICT_PRIORITY_GUARD));
    expect(text.indexOf(PRODUCT_SET_CONFLICT_PRIORITY_GUARD)).toBeLessThan(text.indexOf(userLine));
  });

  it('keeps all product-set structured fields before scene and leaves the variant last', () => {
    expect(buildExecutionPrompt({
      feature: 'product_comparison_image',
      comparisonLayout: 'horizontal',
      comparisonIntensity: 'light',
      showProduct: true,
      brand: 'WKUA',
      productName: 'Tile Cleaner',
      regions: [{ id: 'tile', x: 0, y: 0, width: 10, height: 10 }],
      scenePrompt: 'bathroom tile',
      prompt: 'show natural light',
      negativePrompt: 'extra bottles',
      variantIndex: 1,
      variantTotal: 2,
    }, 'main')).toBe(withEnglishOnlyRule(
      'main',
      'Before 左、After 右。',
      '前后差异自然克制。',
      'After 必须展示 SKU。',
      '品牌是 WKUA。',
      '产品名称是 Tile Cleaner。',
      '只处理已选择的 1 个矩形区域。',
      PRODUCT_SET_CONFLICT_PRIORITY_GUARD,
      '具体场景：bathroom tile',
      '补充要求：show natural light',
      '反向要求：避免出现以下内容：extra bottles',
      '这是本批次第 1/2 张。生成与同批其他图片明显不同的场景或构图，同时遵守当前功能的全部固定规则。',
    ));
  });

  it('keeps product-set structured fields before scene without a variant', () => {
    expect(buildExecutionPrompt({
      feature: 'product_main_image',
      brand: 'WKUA',
      scenePrompt: 'bathroom tile',
    }, 'main')).toBe(withEnglishOnlyRule(
      'main',
      'SKU 不得由手持有，可放置在场景主体位置。',
      '根据 SKU 类型决定是否展示具体作用效果。',
      '品牌是 WKUA。',
      PRODUCT_SET_CONFLICT_PRIORITY_GUARD,
      '具体场景：bathroom tile',
    ));
  });

  it('omits empty product-set prompt lines', () => {
    const text = buildExecutionPrompt({
      feature: 'product_comparison_image',
      comparisonLayout: 'auto',
      comparisonIntensity: 'medium',
      showProduct: true,
      scenePrompt: '  ',
      prompt: ' ',
      negativePrompt: '',
    }, 'main');

    expect(text).toBe(withEnglishOnlyRule(
      'main',
      '根据比例和构图选择左右或上下布局。',
      '前后差异清晰且可信。',
      'After 必须展示 SKU。',
    ));
  });

  it.each([
    { variantIndex: 2 },
    { variantTotal: 4 },
  ])('omits the variant instruction when only one variant field is present', (variant) => {
    const text = buildExecutionPrompt({
      feature: 'product_multi_scene',
      prompt: 'a kitchen counter in morning light',
      ...variant,
    }, '根据 SKU 生成场景图。');

    expect(text).not.toContain('本批次第');
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
});
