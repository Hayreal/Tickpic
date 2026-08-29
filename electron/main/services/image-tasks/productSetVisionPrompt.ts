import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { ProductSetVisionBatch } from '../../../../src/shared/domain/productSetVisionInstructions.js';
import {
  isProductSetFeature,
  multiSceneLayoutPlan,
  resolveComparisonEvidenceFraming,
  resolveComparisonLayout,
  resolveMultiScenePresentationLayout,
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
    '5. 主图批次由你决定每张的 presentation_mode、handheld_required 与 show_effect，不按 index 固定角色。可选角色包括 carousel_hero、before_after、handheld_use、effect_demo、lifestyle_scene；Before/After、手持、真实使用过程、使用后效果和生活场景都不是必选项。',
    '5a. 同批任意两张至少在场景、使用阶段、构图、机位、产品位置、文案表达中的至少 3 项明显不同；不得只换标题、颜色或轻微移动产品。',
    '5b. 若提供手持参考图，只有你选择 handheld_required=true 时才按参考图握姿；参考图不要求每张手持。',
    '5c. show_effect=true 表示展示真实品类对应的使用动作或使用后效果。仅真实喷雾/泵头/扳机 SKU 可喷射；非喷雾类 SKU 禁止生成喷雾、雾气或虚构喷嘴。',
    '5d. before_after 仅在有同一对象和同一区域的可信前后证据时选择，必须带英文 BEFORE/AFTER 标识且 SKU 不遮挡证据。',
    '6. 最终 SKU 锁定与执行提示词由后续渲染器处理；你只需输出本张真实场景、目标对象/状态、构图与差异方向。合并后直接采用你输出的 presentation_mode、handheld_required 与 show_effect。',
    '7. variant_directive 应写清该张图独有的子场景/构图/光线方向，并与 batch 内其他 index 互斥。',
    '8. 若用户提供 scenePrompt / prompt / negativePrompt，将其要点体现在 environment、composition_directive 或 scene_notes 中。',
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
    ...(request.feature === 'product_comparison_image' && count > 1
      ? { comparison_layout_plan: buildComparisonLayoutPlan(request, count) }
      : {}),
    ...(request.feature === 'product_multi_scene'
      ? { multi_scene_layout_plan: buildMultiSceneLayoutPlan(request, count) }
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
