import { stripJsonFence } from './replaceProductExecutionPrompt.js';

export interface ProductSetVisionSetStyle {
  type_family?: string;
  accent_color?: string;
  sku_treatment?: string;
}

export interface ProductSetVisionInstructionItem {
  index: number;
  presentation_mode?: 'carousel_hero' | 'before_after' | 'handheld_use' | 'effect_demo' | 'lifestyle_scene';
  handheld_required?: boolean;
  show_effect?: boolean;
  problem_surface?: string;
  problem_state?: string;
  environment?: {
    location?: string;
    set?: string;
    props?: string;
  };
  set_role?: string;
  layout_family?: string;
  sku_placement?: string;
  headline_placement?: string;
  headline_treatment?: string;
  composition_directive?: string;
  headline_suggestion?: string;
  extra_content?: 'none' | 'selling_points' | 'mini_comparison' | Array<'selling_points' | 'mini_comparison'>;
  selling_point_hints?: string[];
  variant_directive?: string;
  panel_guidance?: string;
  scope_headline?: string;
  panel_list?: Array<{
    label: string;
    problem_surface: string;
    problem_state: string;
  }>;
  scene_notes?: string[];
}

export interface ProductSetVisionBatch {
  set_style?: ProductSetVisionSetStyle;
  instructions: ProductSetVisionInstructionItem[];
}

export function parseProductSetVisionBatch(
  raw: string,
  expectedCount: number,
): ProductSetVisionBatch {
  const parsed = JSON.parse(stripJsonFence(raw)) as Partial<ProductSetVisionBatch>;
  if (!parsed?.instructions || !Array.isArray(parsed.instructions)) {
    throw new Error('vision model returned invalid product-set instruction batch');
  }

  if (parsed.instructions.length !== expectedCount) {
    throw new Error(
      `vision model returned ${parsed.instructions.length} instructions, expected ${expectedCount}`,
    );
  }

  const sorted = [...parsed.instructions].sort((left, right) => left.index - right.index);
  for (let index = 0; index < expectedCount; index += 1) {
    const item = sorted[index];
    if (!item || item.index !== index + 1) {
      throw new Error(`vision model missing instruction for index ${index + 1}`);
    }
  }

  return {
    ...(asSetStyle(parsed.set_style) ? { set_style: asSetStyle(parsed.set_style) } : {}),
    instructions: sorted,
  };
}

function asSetStyle(value: unknown): ProductSetVisionSetStyle | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as ProductSetVisionSetStyle;
  const setStyle = {
    ...(record.type_family?.trim() ? { type_family: record.type_family.trim() } : {}),
    ...(record.accent_color?.trim() ? { accent_color: record.accent_color.trim() } : {}),
    ...(record.sku_treatment?.trim() ? { sku_treatment: record.sku_treatment.trim() } : {}),
  };
  return Object.keys(setStyle).length > 0 ? setStyle : undefined;
}
