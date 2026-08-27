import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ProductSetVisionBatch } from '../../../../src/shared/domain/productSetVisionInstructions.js';
import {
  isProductSetFeature,
  resolveComparisonLayout,
  resolveMainImageVariantPresentation,
} from './productSetJsonPrompt.js';
import { sanitizeRequestForInstruction } from './instructionPrompt.js';

export function buildProductSetVisionSystemPrompt(feature: ImageFeature): string {
  if (!isProductSetFeature(feature)) {
    throw new Error(`buildProductSetVisionSystemPrompt does not support feature ${feature}`);
  }

  return [
    '你是 US Temu 电商套图任务的视觉理解助手。',
    '你会看到 SKU 产品图（以及可选的手持参考图）。',
    '请结合产品外观、品类、用途与任务参数，为每一张待输出图片生成独立的图像编辑指令。',
    '输出 ONLY 一个 JSON 对象，不要 Markdown、不要解释。',
    'JSON 必须严格符合以下 schema 示例（字段可增删数组项，但结构保持一致）：',
    JSON.stringify(createVisionBatchTemplate(feature), null, 2),
    '',
    '规则：',
    '1. instructions 数组长度必须等于 requested_count，index 从 1 递增且连续。',
    '2. 每条 instruction 必须针对真实 SKU 标签/包装上的品类与用途填写，禁止臆造与 SKU 无关的场景（例如清洁剂被写成发动机皮带维护）。',
    '3. 每条 instruction 必须填写 problem_surface 与 problem_state，让画面出现「具体痛点表面 + 可见问题状态」，禁止空泛棚拍或货架陈列。',
    '4. 同一批次内各 instruction 的场景、构图、机位、光线或子环境必须明显不同，不得只改标题或换色。',
    '5. 主图批次中，手持展示与具体效果是「按张分配」的批次策略，不是每张都手持、每张都出特效。',
    '5a. 若 structured_parameters.productHandheldMode=auto：每条 instruction 必须填写 handheld_required（bool），由你根据 batch_presentation_plan 与 SKU 用途判断该张是否需要手持；若用户提供了 handheld reference 图，handheld_required=true 时必须按参考图握姿。',
    '5b. 若 structured_parameters.productHandheldMode=handheld：必须严格遵守 batch_presentation_plan 的 handheld_required，不得省略手。',
    '5c. 若 structured_parameters.productHandheldMode=not_handheld：所有 instruction 的 handheld_required 必须为 false。',
    '5d. 若 structured_parameters.productEffectMode=auto：每条 instruction 必须填写 show_effect（bool），按 batch 策略判断该张是否展示喷射/效果；整个 batch 最多 1 张 show_effect=true。',
    '5e. 若 structured_parameters 含 batch_presentation_plan，必须严格按每张的 presentation_mode 填写 scene 与 composition；handheld_required/show_effect 以 productHandheldMode/productEffectMode 规则为准。',
    '5f. index 1 carousel_hero：handheld_required=false、show_effect=false，但必须同时看见具体痛点表面/问题状态 + 产品主视觉，禁止货架/catalog/纯产品摆拍。',
    '5g. handheld_use：handheld_required 通常为 true（auto 模式下由你判断），但本张 show_effect=false。',
    '5h. effect_demo：show_effect=true；handheld_required 由 handheld 模式决定，auto 时通常为 true（若 SKU 为喷雾/按压类产品）。',
    '6. 最终 SKU 锁定与执行提示词由后续渲染器处理；你只需输出本张真实场景、目标对象/状态、构图与差异方向。合并后 handheld/effect 以 vision 输出的 handheld_required/show_effect 为准（auto 模式）或 UI 固定值为准。',
    '7. variant_directive 应写清该张图独有的子场景/构图/光线方向，并与 batch 内其他 index 互斥。',
    '8. 若用户提供 scenePrompt / prompt / negativePrompt，将其要点体现在 environment、composition_directive 或 scene_notes 中。',
    '9. 多场景图不得输出产品本体、包装、人物或手部；主图/对比图必须锁定 SKU 身份。',
    '9a. 多场景图若 structured_parameters.multiSceneLayout 为 grid 或 collage：每张输出必须是「带英文标签的多格适用范围信息图」，每格一种真实痛点表面+问题状态；禁止单张连续实拍、清洁工具摆拍、或带毛巾/刷子的细节特写。',
    '9b. grid 布局默认 2 行 x 3 列共 6 格；vision 必须为每条 instruction 填写 panel_list（6 项，含 label / problem_surface / problem_state）与 scope_headline。',
    '9c. 多场景 single 布局才允许单张连续场景图；grid/collage 时 problem_surface/problem_state 描述整图主题，具体分格内容写在 panel_list。',
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
    ...(request.feature === 'product_main_image' && count > 1
      ? { batch_presentation_plan: buildMainImagePresentationPlan(request, count) }
      : {}),
    ...(request.feature === 'product_comparison_image' && count > 1
      ? { comparison_layout_plan: buildComparisonLayoutPlan(request, count) }
      : {}),
  };

  return [
    `请基于附带的产品图，为 ${count} 张套图输出各自独立的图像编辑指令 batch。`,
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
      instructions: [{
        ...baseItem,
        presentation_mode: 'carousel_hero',
        handheld_required: false,
        show_effect: false,
        headline_suggestion: '3-7 word English benefit headline coordinated with this scene',
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
        {
          label: 'Water Stains',
          problem_surface: 'car door panel',
          problem_state: 'vertical mineral water streaks',
        },
        {
          label: 'Grease',
          problem_surface: 'car lower side panel',
          problem_state: 'dark greasy vertical drips',
        },
      ],
      composition_directive: '2x3 labeled grid scope infographic with optional top headline banner; no product or cleaning tools',
    }],
  };
}

function buildMainImagePresentationPlan(request: ImageTaskRequest, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const variantIndex = index + 1;
    const presentation = resolveMainImageVariantPresentation({
      ...request,
      variantIndex,
      variantTotal: count,
      count: 1,
    });

    return {
      index: variantIndex,
      presentation_mode: presentation?.mode ?? 'carousel_hero',
      handheld_required: presentation?.handheldRequired ?? false,
      show_effect: presentation?.effectRequired ?? false,
      carousel_ready: presentation?.carouselReady ?? true,
      role: presentation?.label ?? '轮播主图',
      must_show_problem_context: presentation?.sceneStorytelling.must_show ?? [],
      forbidden_scene_types: presentation?.sceneStorytelling.forbidden ?? [],
      ...(request.productHandheldMode === 'auto'
        ? { handheld_decision: 'vision_must_set_handheld_required' as const }
        : {}),
      ...(request.productEffectMode === 'auto'
        ? { effect_decision: 'vision_must_set_show_effect' as const }
        : {}),
    };
  });
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
    };
  });
}
