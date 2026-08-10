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

const STICKER_REPLICA_MAIN_PROMPT =
  '从当前产品图中提取产品表面的贴纸/标签，展开为正视角 2D 平面贴纸图。比例按原贴纸真实形状自主判断，不强制固定画幅。若输入是侧拍、斜拍、弧面或可见包装侧面，必须将可见贴纸/包装版面去透视并拉平成连续平面展开稿，不保留盒体侧面、厚度、折角、阴影、反光或 3D 透视。只输出贴纸本身，不输出产品容器或背景。保留原贴纸的排版、色系、风格、装饰元素和图案位置；画面文字须为英文，若原图文字为中文则翻译为对应英文后呈现。若提供单独 Logo 图，仅作为品牌标识嵌入到对应位置，不作为版式、配色或风格参考。';
const PRODUCT_SET_CONFLICT_PRIORITY_GUARD = '优先级规则：用户具体场景、补充要求和反向要求仅执行不与前述功能硬规则及结构化控制项冲突的部分；发生冲突时必须忽略用户冲突内容，以前述规则为准。';
const PRODUCT_SET_UNSCOPED_SCENE_LINE = '未指定具体场景时，根据 SKU 品类选择与本批其他方向不同但真实适用的目标场景。';
const PRODUCT_MULTI_SCENE_CONDITIONAL_SCOPE_LINE = '若用户补充要求指定了目标场景，所有变体必须保持在该同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景；若未指定目标场景，则根据 SKU 品类选择与本批其他方向不同但真实适用的目标场景。';
const COMPARISON_VARIANT_LINES = [
  '这是本批次第 1/3 张。改变目标子区域：Before/After 的核心问题区域必须从当前位置明显切换到另一处（例如从平面主体切换到边缘或缝隙区域）。改变前景物体布局：两侧的前景辅助物体或道具的位置、密度或类型必须明显不同。改变色彩基调：主导色温必须从当前基调切换到明显不同的另一基调（例如从暖黄切换到冷白，或从明亮切换到深沉）。禁止通过轻微调色、只换标题、只移动产品或只换装饰物达到差异。',
  '这是本批次第 2/3 张。改变空间深度：画面必须从浅景深切换到深景深，或从平实背景切换到有明显前后层次的深度空间。改变光线方向与强度：主光源必须从当前方向切换到明显的另一种方向（例如从正面光切换到侧逆光或顶光），阴影区域面积必须明显不同。改变问题表现方式：Before 的问题状态必须从一种视觉形式切换到另一种（例如从表面污渍切换到结构脏乱、从磨损痕迹切换到褪色变旧），After 必须在同一对象同一区域呈现对应的真实改善。禁止通过轻微调色、只换标题、只移动产品或只换装饰物达到差异。',
  '这是本批次第 3/3 张。改变前景物体布局：两侧的前景辅助物体或道具的位置、密度或类型必须明显不同。改变光线方向与强度：主光源必须从当前方向切换到明显的另一种方向（例如从正面光切换到侧逆光或顶光），阴影区域面积必须明显不同。改变问题表现方式：Before 的问题状态必须从一种视觉形式切换到另一种（例如从表面污渍切换到结构脏乱、从磨损痕迹切换到褪色变旧），After 必须在同一对象同一区域呈现对应的真实改善。禁止通过轻微调色、只换标题、只移动产品或只换装饰物达到差异。',
] as const;
const MULTI_SCENE_VARIANT_LINES = [
  '这是本批次第 1/3 张。改变空间类型：目标场景的空间类型必须从当前位置明显切换到另一种（例如从室内台面切换到室外地面环境、从明亮空间切换到暗调空间）。改变观察距离与角度：主体场景的景别和观察角度必须明显变化（例如从近景切换到中远景、或从俯视切换到正视）。改变光影氛围：光线环境必须从当前氛围明显切换到另一种（例如从均匀商业光切换到强烈方向光、或从白天自然光切换到暖色人工光）。仅输出不同的具体目标场景、对象、表面、空间或环境状态，不得出现产品或人物。',
  '这是本批次第 2/3 张。改变主体对象：画面中核心展示的表面或物体必须从一种类型切换到另一种（例如从光滑瓷砖切换到纹理粗糙的木质或石质表面）。改变背景复杂度：背景环境必须从简单空旷切换到丰富多层次，或从密集杂乱切换到简洁有序，两种状态不能相同。改变空间类型：目标场景的空间类型必须从当前位置明显切换到另一种（例如从台面附近切换到墙角转折处、从开阔区域切换到狭窄区域）。仅输出不同的具体目标场景、对象、表面、空间或环境状态，不得出现产品或人物。',
  '这是本批次第 3/3 张。改变观察距离与角度：主体场景的景别和观察角度必须明显变化（例如从近景切换到中远景、或从俯视切换到正视）。改变主体对象：画面中核心展示的表面或物体必须从一种类型切换到另一种（例如从光滑瓷砖切换到纹理粗糙的木质或石质表面）。改变背景复杂度：背景环境必须从简单空旷切换到丰富多层次，或从密集杂乱切换到简洁有序，两种状态不能相同。仅输出不同的具体目标场景、对象、表面、空间或环境状态，不得出现产品或人物。',
] as const;
const MAIN_VARIANT_LINES = [
  '这是本批次第 1/3 张。改变目标子场景：核心展示的空间位置必须从当前位置明显切换到另一种（例如从台面切换到墙边、从室内近景切换到带窗外景的中景）。改变色彩基调：主导色温必须从当前基调切换到明显不同的另一基调（例如从暖黄切换到冷白，或从明亮切换到深沉）。改变前景层次：前景辅助元素的位置、密度或类型必须明显不同（例如从无前景切换到有前景道具、从分散元素切换到集中元素）。',
  '这是本批次第 2/3 张。改变空间深度：画面必须从浅景深切换到深景深，或从平实背景切换到有明显前后层次的深度空间。改变光线方向与强度：主光源必须从当前方向切换到明显的另一种方向（例如从正面光切换到侧逆光或顶光），阴影区域面积必须明显不同。改变背景元素密度：背景环境的简洁程度必须明显变化（例如从单色高光背景切换到丰富多层次环境背景，或相反）。',
  '这是本批次第 3/3 张。改变色彩基调：主导色温必须从当前基调切换到明显不同的另一基调（例如从暖黄切换到冷白，或从明亮切换到深沉）。改变光线方向与强度：主光源必须从当前方向切换到明显的另一种方向（例如从正面光切换到侧逆光或顶光），阴影区域面积必须明显不同。改变背景元素密度：背景环境的简洁程度必须明显变化（例如从单色高光背景切换到丰富多层次环境背景，或相反）。',
] as const;
const PRODUCT_MAIN_IMAGE_BASE_PROMPT = '综合参考输入的多张 SKU 图片生成一张电商主图。画面必须包含输入 SKU 产品，由 AI 自动生成清晰的英文大标题，并呈现明确的核心使用场景；产品为主视觉。严格保持产品形状、包装、品牌、标签、颜色与关键文字一致，不得重新设计 SKU；不得出现中文营销文字。场景必须服务于产品卖点，无关装饰不堆叠。';
const PRODUCT_COMPARISON_IMAGE_BASE_PROMPT = '基于输入 SKU 生成一张对比图：每张只包含一个场景、一组 Before/After。同一组中环境、对象、视角、构图与光线必须保持一致。Before 与 After 两个面板内部均不得展示 SKU。使用清晰英文 BEFORE 和 AFTER 标识，不得出现中文营销文字；不得拆成多图或四阶段过程图。严格保持 SKU 的产品形状、包装、品牌、标签、颜色与关键文字一致。';
const PRODUCT_MULTI_SCENE_BASE_PROMPT = '输入 SKU 只用于识别产品品类、用途和适用环境。只输出目标场景、目标对象、表面、空间或环境状态；输出不得包含 SKU、输入产品、产品包装、带品牌的瓶/容器或其他可识别的产品实例；不得包含人物、身体、脸部、手部、手持动作或人物使用动作。画面模式由结构化选项控制为单场景、拼图或宫格。默认不添加标题、卖点或营销文字，除非用户明确要求且不与前述硬规则冲突。';

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
      '将画布分为 4 个不规则区域作为独立面板，至少包含 2 种不同的宽高比，面板之间必须有清晰可见的边界线或分隔线；每个面板展示一个完整的、与其他面板不同的目标场景；不同面板之间不得选用色调相近或内容雷同的场景；同一批次的不同输出不得复用同一组面板场景组合。',
      PRODUCT_MULTI_SCENE_CONDITIONAL_SCOPE_LINE,
      PRODUCT_SET_CONFLICT_PRIORITY_GUARD,
      '补充要求：a kitchen counter in morning light',
      '反向要求：避免出现以下内容：marketing text',
      '这是本批次第 2/4 张。改变主体对象：画面中核心展示的表面或物体必须从一种类型切换到另一种（例如从光滑瓷砖切换到纹理粗糙的木质或石质表面）。改变背景复杂度：背景环境必须从简单空旷切换到丰富多层次，或从密集杂乱切换到简洁有序，两种状态不能相同。改变空间类型：目标场景的空间类型必须从当前位置明显切换到另一种（例如从台面附近切换到墙角转折处、从开阔区域切换到狭窄区域）。仅输出不同的具体目标场景、对象、表面、空间或环境状态，不得出现产品或人物。',
    ));
  });

  it.each([
    ['handheld', '必须出现自然、完整的真人手持有或操作 SKU。手部必须五指齐全、比例正常，不得缺指、断指或多指；拇指与其余手指自然环握产品主体或握持区，产品的操作端（喷口、喷嘴、扳机、泵头、瓶口、握柄等）必须朝外，不得被握反或握错方向；手掌和手指不得遮挡产品正面主标签、品牌文字以及喷口、喷头、按键等核心结构；手部关节与腕部过渡自然，不得出现手掌反向或手部畸变。'],
    ['not_handheld', 'SKU 不得由手持有，可放置在场景主体位置。'],
  ] as const)('maps main-image handheld mode %s', (productHandheldMode, line) => {
    expect(buildExecutionPrompt({ feature: 'product_main_image', productHandheldMode }, 'main')).toContain(line);
  });

  it.each([
    ['auto', '根据 SKU 类型决定是否展示具体作用效果；若展示效果，作用物必须从产品真实开口发出，且使用动作必须符合产品真实物理结构。'],
    ['show', '必须明确表现与 SKU 对应的作用过程或效果，且使用动作必须符合产品真实物理结构与真实使用方式。喷射类（喷雾、喷剂、香水）：作用物必须从真实喷口/喷嘴口部喷出，不得从瓶身、喷头侧面、瓶底或空中凭空出现；喷头/扳机/泵头必须处于展开或按压状态，喷射方向沿喷口指向方向，雾团从喷口发散。泵压/按压类：泵头、压嘴、瓶盖朝向必须正确，作用物从出口或瓶口流出。不得出现产品结构无法支撑的动作或效果，作用物不得从产品不存在的开口出现。'],
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
    ['light', '轻度对比：Before 与 After 必须存在可辨认但自然克制的小范围状态改善，不能几乎一致。'],
    ['medium', '中度对比：Before 的核心问题区域必须清晰可见，After 必须在同一区域呈现直接、明确且可信的改善，无需仔细观察即可理解变化。'],
    ['heavy', '重度对比：Before 的核心问题必须大面积、显著且一眼可见，After 必须在同一对象、同一区域呈现强烈、明确且可信的改善；不得更换或改变场景、对象、机位、材质或结构，也不得仅靠压暗 Before、提高 After 饱和度或增加效果光制造反差。'],
  ] as const)('maps comparison intensity %s', (comparisonIntensity, line) => {
    expect(buildExecutionPrompt({ feature: 'product_comparison_image', comparisonIntensity }, 'main')).toContain(line);
  });

  it.each([
    [true, '展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。选择布局后，产品必须按对应方向跨在分界线中央。'],
    [false, '整张图不展示 SKU，只使用 Before 与 After 的场景状态表达改善效果。'],
  ] as const)('maps comparison product visibility %s', (showProduct, line) => {
    const text = buildExecutionPrompt({ feature: 'product_comparison_image', showProduct }, 'main');

    expect(text).toContain(line);
    expect(text).not.toContain(showProduct ? '需要展示产品。' : '不要展示产品。');
  });

  it.each([
    [true, 'auto', '选择布局后，产品必须按对应方向跨在分界线中央。'],
    [true, 'horizontal', '产品必须垂直跨在左右分界线中央。'],
    [true, 'vertical', '产品必须水平跨在上下分界线中央。'],
    [false, 'auto', undefined],
    [false, 'horizontal', undefined],
    [false, 'vertical', undefined],
  ] as const)('applies comparison SKU placement only when visibility is %s for %s layout', (showProduct, comparisonLayout, placement) => {
    const text = buildExecutionPrompt({
      feature: 'product_comparison_image',
      comparisonLayout,
      showProduct,
    }, 'main');

    if (placement) {
      expect(text).toContain('独立于 Before 和 After 面板的前景商品层');
      expect(text).toContain(placement);
      return;
    }

    expect(text).toContain('整张图不展示 SKU，只使用 Before 与 After 的场景状态表达改善效果。');
    expect(text).not.toContain('前景商品层');
    expect(text).not.toContain('跨在');
    expect(text).not.toContain('产品必须');
  });

  it('requires heavy contrast to preserve the scene while improving the same object and area', () => {
    const text = buildExecutionPrompt({
      feature: 'product_comparison_image',
      comparisonIntensity: 'heavy',
    }, 'main');

    expect(text).toContain('不得更换或改变场景、对象、机位、材质或结构');
    expect(text).not.toContain('不得通过更换场景、对象、机位、材质或结构制造差异');
  });

  it('places one SKU as a centered foreground layer without obscuring comparison content', () => {
    const text = buildExecutionPrompt({
      feature: 'product_comparison_image',
      comparisonLayout: 'horizontal',
      showProduct: true,
    }, 'main');

    expect(text).toContain('Before 左、After 右。');
    expect(text).toContain('展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。产品必须垂直跨在左右分界线中央。');
  });

  it('composes the real comparison main prompt with panel-only SKU exclusion and one foreground SKU', () => {
    const mainPrompt = getImageFeatureDefinition('product_comparison_image').mainPrompt;
    const text = buildExecutionPrompt({
      feature: 'product_comparison_image',
      comparisonLayout: 'horizontal',
      showProduct: true,
    }, mainPrompt);

    expect(text).toContain('Before 与 After 两个面板内部均不得展示 SKU。');
    expect(text).toContain('只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层');
    expect(text).toContain('Before 与 After 必须保持同一场景、对象、机位、尺度、材质与结构。');
    expect(text).toContain('构图与光线必须保持一致。');
    expect(text).not.toContain('After 是否展示 SKU');
    expect(text.match(/只展示一个产品实例/g)).toHaveLength(1);
  });

  it('composes the real comparison main prompt without SKU placement when product visibility is disabled', () => {
    const mainPrompt = getImageFeatureDefinition('product_comparison_image').mainPrompt;
    const text = buildExecutionPrompt({
      feature: 'product_comparison_image',
      comparisonLayout: 'horizontal',
      showProduct: false,
    }, mainPrompt);

    expect(text).toContain('Before 与 After 两个面板内部均不得展示 SKU。');
    expect(text).toContain('整张图不展示 SKU，只使用 Before 与 After 的场景状态表达改善效果。');
    expect(text).not.toContain('前景 SKU');
    expect(text).not.toContain('中心分界线');
    expect(text).not.toContain('前景商品层');
    expect(text).not.toContain('只展示一个产品实例');
  });

  it.each([
    ['single', '每张只展示一个完整目标场景，包含可观察的前中后景层次和具体的材质、物体、光影细节；同一批次的不同输出必须使用不同的具体场景。'],
    ['collage', '将画布分为 4 个不规则区域作为独立面板，至少包含 2 种不同的宽高比，面板之间必须有清晰可见的边界线或分隔线；每个面板展示一个完整的、与其他面板不同的目标场景；不同面板之间不得选用色调相近或内容雷同的场景；同一批次的不同输出不得复用同一组面板场景组合。'],
    ['grid', '将画布划分为 2 行 × 2 列共 4 个等大小单元格，单元格之间必须有清晰可见的分隔线或边框；每个单元格展示一个完整的、与其他单元格不同的目标场景；不得用纯色或相近色调填满所有单元格导致网格边界消失；同一批次的不同输出不得复用同一格场景组合。'],
  ] as const)('maps multi-scene layout %s', (multiSceneLayout, line) => {
    expect(buildExecutionPrompt({ feature: 'product_multi_scene', multiSceneLayout }, 'main')).toContain(line);
  });

  it('places the real multi-scene exclusions before the conflict guard and conflicting user text', () => {
    const text = buildExecutionPrompt({
      feature: 'product_multi_scene',
      prompt: 'Show the branded bottle held by a smiling person with marketing text.',
    }, getImageFeatureDefinition('product_multi_scene').mainPrompt);

    const exclusions = '输出不得包含 SKU、输入产品、产品包装、带品牌的瓶/容器或其他可识别的产品实例；不得包含人物、身体、脸部、手部、手持动作或人物使用动作。';
    expect(text).toContain(exclusions);
    expect(text.indexOf(exclusions)).toBeLessThan(text.indexOf(PRODUCT_SET_CONFLICT_PRIORITY_GUARD));
    expect(text.indexOf(PRODUCT_SET_CONFLICT_PRIORITY_GUARD)).toBeLessThan(text.indexOf('补充要求：Show the branded bottle held by a smiling person with marketing text.'));
  });

  it.each([
    'kitchen counter in morning light',
    'warm natural lighting',
    undefined,
  ])('adds conditional scene guidance for multi-scene prompts of %s', (prompt) => {
    const mainPrompt = getImageFeatureDefinition('product_multi_scene').mainPrompt;
    const text = buildExecutionPrompt({
      feature: 'product_multi_scene',
      prompt,
    }, mainPrompt);

    expect(text).toContain(PRODUCT_MULTI_SCENE_CONDITIONAL_SCOPE_LINE);
    expect(text).not.toContain(PRODUCT_SET_UNSCOPED_SCENE_LINE);
  });

  it.each([
    [4, '改变目标子场景'],
    [5, '改变空间深度'],
    [6, '改变色彩基调'],
  ] as const)('marks repeated product-set direction %s/6 as a later cycle', (variantIndex, dimensionText) => {
    const text = buildExecutionPrompt({
      feature: 'product_main_image',
      variantIndex,
      variantTotal: 6,
    }, getImageFeatureDefinition('product_main_image').mainPrompt);

    expect(text).toContain(dimensionText);
    expect(text).toContain('这是该方向的第 2 轮变化，必须选择此前同方向未使用的具体子场景、主体对象和构图，不得复用前一轮内容。');
  });

  it('keeps the repeated core direction distinct from its first cycle', () => {
    const mainPrompt = getImageFeatureDefinition('product_main_image').mainPrompt;
    const first = buildExecutionPrompt({
      feature: 'product_main_image',
      variantIndex: 1,
      variantTotal: 6,
    }, mainPrompt);
    const repeated = buildExecutionPrompt({
      feature: 'product_main_image',
      variantIndex: 4,
      variantTotal: 6,
    }, mainPrompt);

    expect(repeated).not.toBe(first);
    expect(repeated).toContain('这是该方向的第 2 轮变化');
  });

  it.each([
    ['product_main_image', 1, undefined, PRODUCT_MAIN_IMAGE_BASE_PROMPT, [
      'SKU 不得由手持有，可放置在场景主体位置。',
      '根据 SKU 类型决定是否展示具体作用效果；若展示效果，作用物必须从产品真实开口发出，且使用动作必须符合产品真实物理结构。',
    ], MAIN_VARIANT_LINES[0]],
    ['product_main_image', 2, undefined, PRODUCT_MAIN_IMAGE_BASE_PROMPT, [
      'SKU 不得由手持有，可放置在场景主体位置。',
      '根据 SKU 类型决定是否展示具体作用效果；若展示效果，作用物必须从产品真实开口发出，且使用动作必须符合产品真实物理结构。',
    ], MAIN_VARIANT_LINES[1]],
    ['product_main_image', 3, undefined, PRODUCT_MAIN_IMAGE_BASE_PROMPT, [
      'SKU 不得由手持有，可放置在场景主体位置。',
      '根据 SKU 类型决定是否展示具体作用效果；若展示效果，作用物必须从产品真实开口发出，且使用动作必须符合产品真实物理结构。',
    ], MAIN_VARIANT_LINES[2]],
    ['product_comparison_image', 1, undefined, PRODUCT_COMPARISON_IMAGE_BASE_PROMPT, [
      '根据比例和构图选择左右或上下布局。',
      'Before 与 After 必须保持同一场景、对象、机位、尺度、材质与结构。',
      '中度对比：Before 的核心问题区域必须清晰可见，After 必须在同一区域呈现直接、明确且可信的改善，无需仔细观察即可理解变化。',
      '展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。选择布局后，产品必须按对应方向跨在分界线中央。',
    ], COMPARISON_VARIANT_LINES[0]],
    ['product_comparison_image', 2, undefined, PRODUCT_COMPARISON_IMAGE_BASE_PROMPT, [
      '根据比例和构图选择左右或上下布局。',
      'Before 与 After 必须保持同一场景、对象、机位、尺度、材质与结构。',
      '中度对比：Before 的核心问题区域必须清晰可见，After 必须在同一区域呈现直接、明确且可信的改善，无需仔细观察即可理解变化。',
      '展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。选择布局后，产品必须按对应方向跨在分界线中央。',
    ], COMPARISON_VARIANT_LINES[1]],
    ['product_comparison_image', 3, undefined, PRODUCT_COMPARISON_IMAGE_BASE_PROMPT, [
      '根据比例和构图选择左右或上下布局。',
      'Before 与 After 必须保持同一场景、对象、机位、尺度、材质与结构。',
      '中度对比：Before 的核心问题区域必须清晰可见，After 必须在同一区域呈现直接、明确且可信的改善，无需仔细观察即可理解变化。',
      '展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。选择布局后，产品必须按对应方向跨在分界线中央。',
    ], COMPARISON_VARIANT_LINES[2]],
    ['product_multi_scene', 1, 'single', PRODUCT_MULTI_SCENE_BASE_PROMPT, [
      '每张只展示一个完整目标场景，包含可观察的前中后景层次和具体的材质、物体、光影细节；同一批次的不同输出必须使用不同的具体场景。',
    ], MULTI_SCENE_VARIANT_LINES[0]],
    ['product_multi_scene', 2, 'collage', PRODUCT_MULTI_SCENE_BASE_PROMPT, [
      '将画布分为 4 个不规则区域作为独立面板，至少包含 2 种不同的宽高比，面板之间必须有清晰可见的边界线或分隔线；每个面板展示一个完整的、与其他面板不同的目标场景；不同面板之间不得选用色调相近或内容雷同的场景；同一批次的不同输出不得复用同一组面板场景组合。',
    ], MULTI_SCENE_VARIANT_LINES[1]],
    ['product_multi_scene', 3, 'grid', PRODUCT_MULTI_SCENE_BASE_PROMPT, [
      '将画布划分为 2 行 × 2 列共 4 个等大小单元格，单元格之间必须有清晰可见的分隔线或边框；每个单元格展示一个完整的、与其他单元格不同的目标场景；不得用纯色或相近色调填满所有单元格导致网格边界消失；同一批次的不同输出不得复用同一格场景组合。',
    ], MULTI_SCENE_VARIANT_LINES[2]],
  ] as const)('assembles exact real %s variant %s/3 output', (feature, variantIndex, multiSceneLayout, basePrompt, controlLines, variantLine) => {
    expect(buildExecutionPrompt({
      feature,
      multiSceneLayout,
      variantIndex,
      variantTotal: 3,
    }, getImageFeatureDefinition(feature).mainPrompt)).toBe(withEnglishOnlyRule(
      basePrompt,
      ...controlLines,
      feature === 'product_multi_scene'
        ? PRODUCT_MULTI_SCENE_CONDITIONAL_SCOPE_LINE
        : PRODUCT_SET_UNSCOPED_SCENE_LINE,
      variantLine as string,
    ));
  });

  it.each([
    'product_main_image',
    'product_comparison_image',
  ] as const)('scopes and unscopes real %s variant prompts', (feature) => {
    const mainPrompt = getImageFeatureDefinition(feature).mainPrompt;
    const scoped = buildExecutionPrompt({
      feature,
      scenePrompt: '浴室瓷砖',
      variantIndex: 1,
      variantTotal: 3,
    }, mainPrompt);
    const unscoped = buildExecutionPrompt({
      feature,
      variantIndex: 1,
      variantTotal: 3,
    }, mainPrompt);

    expect(scoped).toContain('所有变体必须保持在“浴室瓷砖”的同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景。');
    expect(unscoped).toContain(PRODUCT_SET_UNSCOPED_SCENE_LINE);
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
      '必须出现自然、完整的真人手持有或操作 SKU。手部必须五指齐全、比例正常，不得缺指、断指或多指；拇指与其余手指自然环握产品主体或握持区，产品的操作端（喷口、喷嘴、扳机、泵头、瓶口、握柄等）必须朝外，不得被握反或握错方向；手掌和手指不得遮挡产品正面主标签、品牌文字以及喷口、喷头、按键等核心结构；手部关节与腕部过渡自然，不得出现手掌反向或手部畸变。',
      '必须明确表现与 SKU 对应的作用过程或效果，且使用动作必须符合产品真实物理结构与真实使用方式。喷射类（喷雾、喷剂、香水）：作用物必须从真实喷口/喷嘴口部喷出，不得从瓶身、喷头侧面、瓶底或空中凭空出现；喷头/扳机/泵头必须处于展开或按压状态，喷射方向沿喷口指向方向，雾团从喷口发散。泵压/按压类：泵头、压嘴、瓶盖朝向必须正确，作用物从出口或瓶口流出。不得出现产品结构无法支撑的动作或效果，作用物不得从产品不存在的开口出现。',
      '所有变体必须保持在“bathroom sink”的同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景。',
      PRODUCT_SET_CONFLICT_PRIORITY_GUARD,
      '具体场景：bathroom sink',
      '补充要求：warm daylight',
      '反向要求：避免出现以下内容：extra bottles',
      '这是本批次第 1/2 张。改变目标子场景：核心展示的空间位置必须从当前位置明显切换到另一种（例如从台面切换到墙边、从室内近景切换到带窗外景的中景）。改变色彩基调：主导色温必须从当前基调切换到明显不同的另一基调（例如从暖黄切换到冷白，或从明亮切换到深沉）。改变前景层次：前景辅助元素的位置、密度或类型必须明显不同（例如从无前景切换到有前景道具、从分散元素切换到集中元素）。',
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
      'Before 与 After 必须保持同一场景、对象、机位、尺度、材质与结构。',
      '重度对比：Before 的核心问题必须大面积、显著且一眼可见，After 必须在同一对象、同一区域呈现强烈、明确且可信的改善；不得更换或改变场景、对象、机位、材质或结构，也不得仅靠压暗 Before、提高 After 饱和度或增加效果光制造反差。',
      '整张图不展示 SKU，只使用 Before 与 After 的场景状态表达改善效果。',
      '所有变体必须保持在“stained tile wall”的同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景。',
      PRODUCT_SET_CONFLICT_PRIORITY_GUARD,
      '具体场景：stained tile wall',
      '补充要求：keep the camera fixed',
      '反向要求：避免出现以下内容：added products',
      COMPARISON_VARIANT_LINES[1],
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
      structuredLine: '整张图不展示 SKU，只使用 Before 与 After 的场景状态表达改善效果。',
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
      'Before 与 After 必须保持同一场景、对象、机位、尺度、材质与结构。',
      '轻度对比：Before 与 After 必须存在可辨认但自然克制的小范围状态改善，不能几乎一致。',
      '展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。产品必须垂直跨在左右分界线中央。',
      '品牌是 WKUA。',
      '产品名称是 Tile Cleaner。',
      '只处理已选择的 1 个矩形区域。',
      '所有变体必须保持在“bathroom tile”的同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景。',
      PRODUCT_SET_CONFLICT_PRIORITY_GUARD,
      '具体场景：bathroom tile',
      '补充要求：show natural light',
      '反向要求：避免出现以下内容：extra bottles',
      '这是本批次第 1/2 张。改变目标子区域：Before/After 的核心问题区域必须从当前位置明显切换到另一处（例如从平面主体切换到边缘或缝隙区域）。改变前景物体布局：两侧的前景辅助物体或道具的位置、密度或类型必须明显不同。改变色彩基调：主导色温必须从当前基调切换到明显不同的另一基调（例如从暖黄切换到冷白，或从明亮切换到深沉）。禁止通过轻微调色、只换标题、只移动产品或只换装饰物达到差异。',
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
      '根据 SKU 类型决定是否展示具体作用效果；若展示效果，作用物必须从产品真实开口发出，且使用动作必须符合产品真实物理结构。',
      '品牌是 WKUA。',
      '所有变体必须保持在“bathroom tile”的同类目标场景范围内，只能通过不同子场景、对象、空间位置、构图、机位和光线形成差异，不得扩展到无关场景。',
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
      'Before 与 After 必须保持同一场景、对象、机位、尺度、材质与结构。',
      '中度对比：Before 的核心问题区域必须清晰可见，After 必须在同一区域呈现直接、明确且可信的改善，无需仔细观察即可理解变化。',
      '展示 SKU 时，只展示一个产品实例，并将其作为独立于 Before 和 After 面板的前景商品层；两个面板内部不得重复出现 SKU，产品不得遮挡核心问题区域或 BEFORE、AFTER 标签。选择布局后，产品必须按对应方向跨在分界线中央。',
      '未指定具体场景时，根据 SKU 品类选择与本批其他方向不同但真实适用的目标场景。',
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
    }, getImageFeatureDefinition('product_multi_scene').mainPrompt);

    expect(text).not.toContain('本批次第');
    expect(text).not.toContain('改变目标子区域');
    expect(text).not.toContain('改变空间深度');
    expect(text).not.toContain('改变前景物体布局');
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
