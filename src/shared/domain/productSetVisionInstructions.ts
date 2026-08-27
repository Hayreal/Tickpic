import { stripJsonFence } from './replaceProductExecutionPrompt.js';

export interface ProductSetVisionInstructionItem {
  index: number;
  presentation_mode?: 'carousel_hero' | 'handheld_use' | 'effect_demo' | 'lifestyle_scene';
  handheld_required?: boolean;
  show_effect?: boolean;
  problem_surface?: string;
  problem_state?: string;
  environment?: {
    location?: string;
    set?: string;
    props?: string;
  };
  composition_directive?: string;
  headline_suggestion?: string;
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

  return { instructions: sorted };
}
