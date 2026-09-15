import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ProductSetVisionBatch } from '../../../../src/shared/domain/productSetVisionInstructions.js';
import {
  MAIN_IMAGE_LAYOUT_FAMILY_MENU,
  MAIN_IMAGE_LOCKUP_IDEAS,
  MAIN_IMAGE_SET_STYLE,
  MAIN_IMAGE_TYPE_EFFECT_MENU,
  MAIN_IMAGE_SKU_INTEGRATION_MENU,
  isProductSetFeature,
  multiSceneLayoutPlan,
  resolveComparisonEvidenceFraming,
  resolveComparisonLayout,
  resolveMultiScenePresentationLayout,
} from './productSetJsonPrompt.js';
import { resizeShowProductByIndex } from '../../../../src/shared/domain/productSetShowProductByIndex.js';
import { sanitizeRequestForInstruction } from './instructionPrompt.js';

export function buildProductSetVisionSystemPrompt(feature: ImageFeature): string {
  if (!isProductSetFeature(feature)) {
    throw new Error(`buildProductSetVisionSystemPrompt does not support feature ${feature}`);
  }

  return [
    '你是 US Temu 电商套图任务的视觉理解助手。',
    '你会看到 SKU 产品图（以及可选的手持参考图）。',
    feature === 'product_main_image'
      ? '请结合产品外观、品类、用途、用户提示词与 requested_count，规划恰好这么多张主图。1 张就设计一张完整主图；2 张或 3 张才当成一组套图，不要默认按三张套来写。'
      : '请结合产品外观、品类、用途与任务参数，为每一张待输出图片生成独立的图像编辑指令。',
    '输出 ONLY 一个 JSON 对象，不要 Markdown、不要解释。',
    'JSON 必须严格符合以下 schema 示例（字段可增删数组项，但结构保持一致）：',
    JSON.stringify(createVisionBatchTemplate(feature), null, 2),
    '',
    '规则：',
    '1. instructions 数组长度必须等于 requested_count，index 从 1 递增且连续。',
    '2. 每条 instruction 必须针对真实 SKU 标签/包装上的品类与用途填写，禁止臆造与 SKU 无关的场景（例如清洁剂被写成发动机皮带维护）。',
    '3. 每条 instruction 必须填写 problem_surface 与 problem_state，让画面出现「具体痛点表面 + 可见问题状态」，禁止空泛棚拍或货架陈列。',
    '4. 仅当 requested_count > 1 时，各 instruction 的场景、构图、机位、光线或子环境必须明显不同，不得只改标题或换色。requested_count = 1 时只输出一张完整主图，不要硬拆成套图角色。',
    '5. 主图批次由你决定每张的 presentation_mode，不按 index 固定角色。可选角色只有 carousel_hero、before_after、lifestyle_scene。禁止 handheld_use 与 effect_demo，禁止手持握瓶和喷雾/雾气/喷射效果。',
    '5a. 仅当 requested_count > 1 时，任意两张至少在场景、使用阶段、构图、机位、产品位置、文案表达中的至少 3 项明显不同；不得只换标题、颜色或轻微移动产品。',
    '5d. before_after 仅在有同一对象和同一区域的可信前后证据时选择，必须带英文 BEFORE/AFTER 标识且 SKU 不遮挡证据。',
    ...(feature === 'product_main_image'
      ? [
        '5e. 主图标题要有电商主标题力度和字体特效：先发明一套 set_style（从 SKU 标签取样的字体气质 + 强调色 + 统一抠图气质），再按 requested_count 为每一张发明 headline_treatment。headline_treatment 必须写清字效：描边/空心字、投影、色块底、双色填充、下划线或装饰块等，并让它服务该张的卖点词，不要做成平淡的单色平字。标题必须落在水平基线上，禁止整行倾斜、斜体、对角排版或透视扭曲。文案要够词、够卖：可以是一行长标题，也可以是两行主标题，或「可选小标题/kicker + 一行或两行主标题」；总词量宜 3–12 个英文词（可更多），必须有一个明显更大的主词。不要编造乱码英文，不要额外角标墙。禁止三行及以上等高层叠、等字号单词墙，禁止整批都用白/黑/黄三行堆字，禁止套用固定的图1 opener / 图2 problem / 图3 result。',
        '5f. 按 main_image_planning_brief.show_product_by_index 中对应 index 的 show_product 决定是否规划 SKU 图层。false 时不得规划 sku_placement、包装、品牌 logo 或 wordmark。true 时 SKU 仍是 Photoshop 抠图图层，但要融入排版节奏：瓶身必须竖直、标签正向可读、旋转角度为 0；可写清 scale、edge bleed、与标题留白区的 overlap。不要立在任何表面上，不要加地面接触阴影；极轻的图形分离阴影可以。禁止手握 SKU，禁止喷雾、雾气或产品喷射效果。',
        '5h. handheld_required 与 show_effect 必须始终为 false。',
        '5g. 你必须自己生成 set_style，以及每张 instruction 的 set_role、layout_family、sku_placement、headline_placement、headline_treatment，条数必须等于 requested_count。composition_directive 必须点名这五项。requested_count > 1 时共用一套字体家族/强调色/SKU 抠图气质，像一组轮播套图，且不得重复同一种构图或同一种堆字。排版家族和 lockup 可从菜单选，也可以发明新名字。',
        '5g1. showProduct=true 时画面只保留：一张使用场景、一组主标题排版（可选小标题 + 一行或两行主标题）、一层 SKU 抠图；before_after 才加一组对比。showProduct=false 时只保留场景与主标题组，不要 SKU 抠图。不要图标行、卖点卡、信息块、角标墙。',
        '5g2. showProduct=true 时 sku_placement 必须同时写清位置、比例、竖直摆放（0° 旋转、标签朝镜头）和与标题/场景的关系，让 SKU 像设计过的图层而不是硬贴素材；标签仍要够读。禁止倾斜/侧倒瓶身，禁止缩成角落小贴纸，禁止多张都右下或都右中竖直悬浮。',
        '5g3. 可选排版家族：product-anchor=SKU 占约三分之一当锚点；type-over-action=大标题压痛点，SKU 在对侧；magazine-offset=标题和 SKU 同一侧栏；bleed-overlap=场景满幅，SKU 切边；type-slab=标题色块切图；diagonal-mass=对角大面，标题和 SKU 在对角留白。也可以发明新家族，只要同批不重复。',
        '5g4. 禁止整批都落成「左上标题、右下产品、其余铺场景」。',
        '5i. 用户字段：prompt=补充提示词，negativePrompt=反向提示词，scenePrompt=具体场景词。有值就必须纳入规划：scenePrompt 约束场景范围，prompt 约束风格/构图/光线/文案，negativePrompt 是禁止项。冲突时 negativePrompt 优先。空字段由你按 SKU 自行决定。',
      ]
      : []),
    '6. 最终 SKU 锁定与执行提示词由后续渲染器处理；你只需输出本张真实场景、目标对象/状态、构图与差异方向。合并后直接采用你输出的 presentation_mode。',
    '7. variant_directive 应写清该张图独有的子场景/构图/光线方向，并与 batch 内其他 index 互斥。',
    '8. 若用户提供 scenePrompt / prompt / negativePrompt，将其要点体现在 environment、composition_directive 或 scene_notes 中。冲突时 negativePrompt 优先于 prompt，禁止项不得被附加要求覆盖。',
    '9. 多场景图不得输出产品本体、包装、人物或手部；主图/对比图必须锁定 SKU 身份。',
    '9a. 多场景图若 structured_parameters.multiSceneLayout 为 auto、grid 或 collage：每张输出必须是「带英文标签的多格适用范围信息图」，每格一种真实痛点表面+问题状态；禁止单张连续实拍、清洁工具摆拍、或带毛巾/刷子的细节特写。',
    '9b. 若请求中提供 multi_scene_layout_plan，必须严格遵守对应 index 的 layout、panel_count、headline_treatment；panel_list 的项数必须精确等于 panel_count。批次内不得重复同一种宫格/拼图几何、标题位置与标签条样式组合。',
    '9c. 多场景 single 布局才允许单张连续场景图；grid/collage 时 problem_surface/problem_state 描述整图主题，具体分格内容写在 panel_list。',
    '9d. 若请求中提供 comparison_layout_plan，必须严格遵守对应 index 的 layout 与 evidence_framing。即使布局重复，也必须按 evidence_framing 改变证据镜头、裁切与主体区域，不能只换标题、滤镜或产品位置。',
    '10. 不要输出图片路径、base64 或任何非 JSON 文本。',
  ].join('\n');
}

export function buildProductSetVisionUserText(
  request: ImageTaskRequest,
  count: number,
): string {
  const parameters = sanitizeRequestForInstruction({
    ...request,
    count,
    variantIndex: undefined,
    variantTotal: undefined,
  });

  const payload = {
    feature: request.feature,
    requested_count: count,
    structured_parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
    ...(request.feature === 'product_main_image'
      ? {
          main_image_planning_brief: {
            requested_count: count,
            invent: [
              'set_style',
              'exactly requested_count cards',
              'per-card set_role',
              'layout_family',
              'sku_placement',
              'headline_placement',
              'headline_treatment',
            ],
            show_product_by_index: resizeShowProductByIndex(
              request.showProductByIndex,
              count,
              request.showProduct !== false,
            ).map((showProduct, index) => ({
              index: index + 1,
              show_product: showProduct,
            })),
            user_direction: {
              prompt: request.prompt?.trim() || null,
              negative_prompt: request.negativePrompt?.trim() || null,
              scene_prompt: request.scenePrompt?.trim() || null,
            },
            shared_constraints: MAIN_IMAGE_SET_STYLE,
            layout_family_menu: MAIN_IMAGE_LAYOUT_FAMILY_MENU,
            lockup_ideas: MAIN_IMAGE_LOCKUP_IDEAS,
            type_effect_menu: MAIN_IMAGE_TYPE_EFFECT_MENU,
            sku_integration_menu: MAIN_IMAGE_SKU_INTEGRATION_MENU,
          },
        }
      : {}),
    ...(request.feature === 'product_comparison_image' && count > 1
      ? { comparison_layout_plan: buildComparisonLayoutPlan(request, count) }
      : {}),
    ...(request.feature === 'product_multi_scene'
      ? { multi_scene_layout_plan: buildMultiSceneLayoutPlan(request, count) }
      : {}),
  };

  return [
    request.feature === 'product_main_image'
      ? count === 1
        ? '请只规划 1 张主图：发明 set_style、排版、SKU 落点和标题 lockup。必须吸收用户提示词、反向提示词和具体场景词；空字段才由你按 SKU 决定。'
        : `请按 requested_count=${count} 规划一组电商套图：先发明一套 set_style，再为这 ${count} 张各发明不同的排版、SKU 落点和标题 lockup。必须吸收用户提示词、反向提示词和具体场景词。不要套用固定的图1 opener / 图2 problem / 图3 result。`
      : `请基于附带的产品图，为 ${count} 张套图输出各自独立的图像编辑指令 batch。`,
    JSON.stringify(payload, null, 2),
  ].join('\n\n');
}

function createVisionBatchTemplate(feature: ImageFeature): ProductSetVisionBatch {
  const baseItem = {
    index: 1,
    problem_surface: 'specific surface/object where the SKU is applied (e.g. car windshield, tile grout, fabric stain)',
    problem_state: 'visible before-use problem state that the SKU solves (e.g. insect residue, mold spot, grease mark)',
    environment: {
      location: 'specific sub-scene derived from SKU category and user scene scope',
      set: 'supporting set dressing for this variant only',
      props: 'relevant props without clutter',
    },
    composition_directive: 'concrete camera angle, product scale, and layout for this output file',
    variant_directive: 'how this output differs from other indexes in the same batch',
    scene_notes: ['SKU-specific quality checks for this variant'],
  };

  if (feature === 'product_main_image') {
    return {
      set_style: {
        type_family: 'display family sampled from the SKU label',
        accent_color: 'one accent pulled from the SKU label',
        sku_treatment: 'same floating cutout, no contact shadow',
      },
      instructions: [{
        ...baseItem,
        presentation_mode: 'carousel_hero',
        handheld_required: false,
        show_effect: false,
        set_role: 'short role name you invent for this card in the set',
        layout_family: 'a layout family you choose or invent; unique in this batch',
        sku_placement: 'where and how the SKU cutout sits: zone, scale, upright 0° rotation, label facing camera, bleed, overlap with headline or scene',
        headline_placement: 'where the headline lockup sits on a level horizontal baseline',
        headline_treatment: 'how this card’s type lockup is designed with visible effects (outline, shadow, slab, accent) without slant or italic; must differ from other cards',
        headline_suggestion: 'English benefit copy for this scene: optional small kicker plus one or two main lines, word-rich (often 3–12+ words); you decide exact wording',
        composition_directive: 'Name the invented set_role, layout_family, sku_placement, headline_placement, and headline_treatment',
      }],
    };
  }

  if (feature === 'product_comparison_image') {
    return {
      instructions: [{
        ...baseItem,
        panel_guidance: 'specific BEFORE problem state and AFTER improvement on the same object/region',
      }],
    };
  }

  return {
    instructions: [{
      ...baseItem,
      scope_headline: '3-8 word English benefit headline for the scope infographic (e.g. ALL THESE CAN BE REMOVED)',
      panel_list: [
        {
          label: 'Black Spots',
          problem_surface: 'car exterior paint panel',
          problem_state: 'speckled black road tar spots',
        },
        {
          label: 'Bug Splatter',
          problem_surface: 'car hood',
          problem_state: 'dried insect residue splatters',
        },
        {
          label: 'Tree Sap',
          problem_surface: 'car hood',
          problem_state: 'sticky hazy sap film',
        },
        {
          label: 'Bird Droppings',
          problem_surface: 'car windshield and hood',
          problem_state: 'messy white bird droppings',
        },
      ],
      composition_directive: 'Follow the supplied multi_scene_layout_plan geometry and panel_count; labeled scope infographic with no product or cleaning tools',
    }],
  };
}

function buildComparisonLayoutPlan(request: ImageTaskRequest, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const variantIndex = index + 1;
    return {
      index: variantIndex,
      layout: resolveComparisonLayout({
        ...request,
        count: 1,
        variantIndex,
        variantTotal: count,
      }),
      evidence_framing: resolveComparisonEvidenceFraming({
        ...request,
        count: 1,
        variantIndex,
        variantTotal: count,
      }),
    };
  });
}

function buildMultiSceneLayoutPlan(request: ImageTaskRequest, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const variantIndex = index + 1;
    const layout = resolveMultiScenePresentationLayout({
      ...request,
      count: 1,
      variantIndex,
      variantTotal: count,
    });
    const plan = multiSceneLayoutPlan(layout);
    return {
      index: variantIndex,
      layout,
      panel_count: plan.panelCount,
      headline_treatment: plan.headlineTreatment,
    };
  });
}
