import type { ImageModelProtocol } from '../domain/imageFeatureApi.js';

export const REPLACE_PRODUCT_MODEL_DEFAULT = 'settings-default' as const;
export const REPLACE_PRODUCT_GEMINI_3_PRO_IMAGE = 'gemini-3-pro-image' as const;

export type ReplaceProductModelSelection =
  | typeof REPLACE_PRODUCT_MODEL_DEFAULT
  | typeof REPLACE_PRODUCT_GEMINI_3_PRO_IMAGE;

export interface ReplaceProductModelOption {
  value: ReplaceProductModelSelection;
  label: string;
  description: string;
}

export const REPLACE_PRODUCT_MODEL_OPTIONS: ReplaceProductModelOption[] = [
  {
    value: REPLACE_PRODUCT_MODEL_DEFAULT,
    label: '默认',
    description: '跟随设置中的出图模型',
  },
  {
    value: REPLACE_PRODUCT_GEMINI_3_PRO_IMAGE,
    label: 'Gemini 3 Pro Image',
    description: 'Google GenAI 协议',
  },
];

export function resolveReplaceProductModelOverrides(
  selection: ReplaceProductModelSelection,
): { edit?: string; protocol?: ImageModelProtocol } | undefined {
  if (selection === REPLACE_PRODUCT_MODEL_DEFAULT) {
    return undefined;
  }

  return {
    edit: selection,
    protocol: 'gemini',
  };
}

export function replaceProductModelFromOverrides(overrides?: {
  edit?: string;
  protocol?: ImageModelProtocol;
}): ReplaceProductModelSelection {
  if (overrides?.edit === REPLACE_PRODUCT_GEMINI_3_PRO_IMAGE) {
    return REPLACE_PRODUCT_GEMINI_3_PRO_IMAGE;
  }

  return REPLACE_PRODUCT_MODEL_DEFAULT;
}
