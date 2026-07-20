import type { ImageTaskRequest, RegionInput } from './imageFeatureApi.js';

export interface ReplaceProductExecutionPrompt {
  task: 'replace_product';
  images: {
    scene: { role: 'source'; label: string };
    target_product: { role: 'product'; label: string };
  };
  goal: string;
  product: {
    source: 'reference_image_2';
    preserve: string[];
    forbidden_changes: string[];
  };
  scene: {
    preserve_except_replaced_product: string[];
  };
  compositing: {
    mode: 'in_place_edit';
    requirements: string[];
  };
  user_notes?: string;
  regions?: Array<{
    id: string;
    imageRole: RegionInput['imageRole'];
    bbox: Pick<RegionInput, 'x' | 'y' | 'width' | 'height'>;
    hint?: string;
    label?: string;
  }>;
  parameters?: Record<string, unknown>;
}

const REPLACE_PRODUCT_GOAL =
  '在图1场景中原位置，用图2的产品替换原有产品，完成通用产品替换合成。';

const REPLACE_PRODUCT_PRESERVE = [
  '整体外形、比例与包装外观',
  '产品表面贴纸/标签的版式、结构、色块布局、文字与图案位置（须与图2一致）',
  'Logo、品牌、容量/规格等印刷信息',
  '包装材质与关键结构细节',
] as const;

const REPLACE_PRODUCT_FORBIDDEN_CHANGES = [
  '重设计或重排贴纸/标签结构',
  '改动标签版式、色块或装饰元素位置',
  '臆造、改写或模糊包装文字',
  '抠图粘贴、贴图感、硬描边、白边、浮空',
  '新旧两个产品同时出现',
] as const;

const REPLACE_PRODUCT_SCENE_PRESERVE = [
  '背景与环境',
  '人物/手部姿势与握持关系',
  '场景透视、景深与光影方向',
  '除被替换产品外的其他物体、文案与装饰元素',
] as const;

const REPLACE_PRODUCT_COMPOSITING = [
  '在场景内原位编辑，不是叠加抠图',
  '新产品须匹配图1的光照、色温、环境反光与接触阴影',
  '产品与手、产品与背景的接触处自然融合',
  '边缘过渡柔和，避免拼贴 collage 效果',
] as const;

function collectReplaceProductParameters(request: ImageTaskRequest): Record<string, unknown> | undefined {
  const parameters: Record<string, unknown> = {};

  if (request.brand?.trim()) {
    parameters.brand = request.brand.trim();
  }
  if (request.productName?.trim()) {
    parameters.productName = request.productName.trim();
  }
  if (request.productCategory?.trim()) {
    parameters.productCategory = request.productCategory.trim();
  }
  if (request.capacity?.trim()) {
    parameters.capacity = request.capacity.trim();
  }
  if (request.logoText?.trim()) {
    parameters.logoText = request.logoText.trim();
  }
  if (request.colorScheme?.trim()) {
    parameters.colorScheme = request.colorScheme.trim();
  }
  if (request.sellingPoints?.length) {
    parameters.sellingPoints = request.sellingPoints
      .map((point) => point.trim())
      .filter(Boolean);
  }
  if (request.aspectRatio && request.aspectRatio !== 'auto') {
    parameters.aspectRatio = request.aspectRatio;
  }

  return Object.keys(parameters).length > 0 ? parameters : undefined;
}

function mapRegions(request: ImageTaskRequest) {
  if (!request.regions?.length) {
    return undefined;
  }

  return request.regions.map((region) => ({
    id: region.id,
    imageRole: region.imageRole ?? 'source',
    bbox: {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    },
    ...(region.operationHint?.trim() ? { hint: region.operationHint.trim() } : {}),
    ...(region.label?.trim() ? { label: region.label.trim() } : {}),
  }));
}

export function buildReplaceProductExecutionPromptObject(
  request: ImageTaskRequest,
): ReplaceProductExecutionPrompt {
  const userNotes = request.prompt?.trim();
  const regions = mapRegions(request);
  const parameters = collectReplaceProductParameters(request);

  return {
    task: 'replace_product',
    images: {
      scene: { role: 'source', label: '图1 场景图' },
      target_product: { role: 'product', label: '图2 目标产品' },
    },
    goal: REPLACE_PRODUCT_GOAL,
    product: {
      source: 'reference_image_2',
      preserve: [...REPLACE_PRODUCT_PRESERVE],
      forbidden_changes: [...REPLACE_PRODUCT_FORBIDDEN_CHANGES],
    },
    scene: {
      preserve_except_replaced_product: [...REPLACE_PRODUCT_SCENE_PRESERVE],
    },
    compositing: {
      mode: 'in_place_edit',
      requirements: [...REPLACE_PRODUCT_COMPOSITING],
    },
    ...(userNotes ? { user_notes: userNotes } : {}),
    ...(regions ? { regions } : {}),
    ...(parameters ? { parameters } : {}),
  };
}

export function buildReplaceProductExecutionPrompt(request: ImageTaskRequest): string {
  return formatReplaceProductExecutionPrompt(buildReplaceProductExecutionPromptObject(request));
}

export function formatReplaceProductExecutionPrompt(prompt: ReplaceProductExecutionPrompt): string {
  return JSON.stringify(prompt, null, 2);
}

export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1]!.trim() : trimmed;
}

export function mergeReplaceProductExecutionPrompt(
  vision: Partial<ReplaceProductExecutionPrompt>,
  request: ImageTaskRequest,
): ReplaceProductExecutionPrompt {
  const fallback = buildReplaceProductExecutionPromptObject(request);
  const userNotes = request.prompt?.trim();
  const regions = mapRegions(request);
  const parameters = collectReplaceProductParameters(request);

  return {
    ...fallback,
    ...vision,
    task: 'replace_product',
    images: fallback.images,
    goal: vision.goal?.trim() || fallback.goal,
    product: {
      source: 'reference_image_2',
      preserve: vision.product?.preserve?.length
        ? [...vision.product.preserve]
        : fallback.product.preserve,
      forbidden_changes: vision.product?.forbidden_changes?.length
        ? [...vision.product.forbidden_changes]
        : fallback.product.forbidden_changes,
    },
    scene: {
      preserve_except_replaced_product: vision.scene?.preserve_except_replaced_product?.length
        ? [...vision.scene.preserve_except_replaced_product]
        : fallback.scene.preserve_except_replaced_product,
    },
    compositing: {
      mode: 'in_place_edit',
      requirements: vision.compositing?.requirements?.length
        ? [...vision.compositing.requirements]
        : fallback.compositing.requirements,
    },
    ...(userNotes ? { user_notes: userNotes } : {}),
    ...(regions ? { regions } : {}),
    ...(parameters ? { parameters } : {}),
  };
}

export function parseReplaceProductExecutionPrompt(
  raw: string,
  request: ImageTaskRequest,
): ReplaceProductExecutionPrompt {
  const parsed = JSON.parse(stripJsonFence(raw)) as Partial<ReplaceProductExecutionPrompt>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('vision model returned invalid JSON instruction');
  }
  return mergeReplaceProductExecutionPrompt(parsed, request);
}

export function parseAndFormatReplaceProductExecutionPrompt(
  raw: string,
  request: ImageTaskRequest,
): string {
  return formatReplaceProductExecutionPrompt(parseReplaceProductExecutionPrompt(raw, request));
}

export function createReplaceProductPromptTemplate(): ReplaceProductExecutionPrompt {
  return buildReplaceProductExecutionPromptObject({ feature: 'replace_product' });
}
