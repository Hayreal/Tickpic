export const IMAGE_FEATURES = [
  'sticker_replica',
  'sticker_variation',
  'sticker_original',
  'remove_product',
  'replace_product',
  'replace_logo',
  'main_image_asset_variation',
  'scene_variation',
  'create_new_scene',
  'prompt_only_main_asset',
] as const;

export type ImageFeature = typeof IMAGE_FEATURES[number];

export const IMAGE_ROLES = [
  'source',
  'reference',
  'style',
  'product',
  'logo',
] as const;

export type ImageRole = typeof IMAGE_ROLES[number];

export type ImageExecutionModel = 'generation' | 'edit';
export type ImageModelProtocol = 'gemini' | 'openai';
export type ImageTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface ImageTaskProgress {
  completed: number;
  total: number;
}

export interface ImageInput {
  role: ImageRole;
  path: string;
  mimeType?: string;
  label?: string;
}

export interface RegionInput {
  id: string;
  imageRole?: ImageRole;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  operationHint?: string;
}

export interface ImageTaskRequest {
  feature: ImageFeature;
  prompt?: string;
  images?: ImageInput[];
  regions?: RegionInput[];
  count?: number;
  productName?: string;
  productCategory?: string;
  sellingPoints?: string[];
  capacity?: string;
  logoText?: string;
  colorScheme?: string;
  aspectRatio?: string;
  showProduct?: boolean;
  modelOverrides?: {
    vision?: string;
    generation?: string;
    edit?: string;
  };
}

export interface ImageTaskSubmitResult {
  taskId: string;
  feature: ImageFeature;
  status: 'queued';
}

export interface ImageTaskResult {
  taskId: string;
  feature: ImageFeature;
  status: ImageTaskStatus;
  progress?: ImageTaskProgress;
  model?: string;
  protocol?: ImageModelProtocol;
  outputDir?: string;
  images: string[];
  requestJsonPath?: string;
  imageInstructionPath?: string;
  outputJsonPath?: string;
  textNotes?: string[];
  warnings?: string[];
  error?: {
    code: string;
    message: string;
  };
}

export interface ImageTaskRecord extends ImageTaskResult {
  request: ImageTaskRequest;
  createdAt: string;
  updatedAt: string;
}

export interface ImageFeatureDefinition {
  feature: ImageFeature;
  mainPrompt: string;
  acceptedImageRoles: readonly ImageRole[];
  requiredImageRoles: readonly ImageRole[];
  executionModel: ImageExecutionModel;
  executionImageRoles: readonly ImageRole[];
  defaultShowProduct?: boolean;
}

const FEATURE_DEFINITIONS: Record<ImageFeature, ImageFeatureDefinition> = {
  sticker_replica: {
    feature: 'sticker_replica',
    mainPrompt: '提取当前产品上面的贴纸',
    acceptedImageRoles: ['source', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'reference'],
  },
  sticker_variation: {
    feature: 'sticker_variation',
    mainPrompt: '参考当前贴纸设计，生成同品类感的新款贴纸变体。可调整标题区、卖点区、图标区、背景纹理与色块比例，输出独立 2D 平面贴纸。',
    acceptedImageRoles: ['source', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'reference'],
  },
  sticker_original: {
    feature: 'sticker_original',
    mainPrompt: '设计一张适合当前产品的原创 2D 平面贴纸初稿，可贴到包装上。根据品类与产品信息补充合适的卖点与视觉风格。',
    acceptedImageRoles: ['reference', 'style'],
    requiredImageRoles: [],
    executionModel: 'generation',
    executionImageRoles: [],
  },
  remove_product: {
    feature: 'remove_product',
    mainPrompt: '在原图基础上仅局部去除目标产品并补全该产品遮挡的像素。源图是固定底图，非目标区域必须与原图完全一致，包括背景、场景、道具、光影、透视、文字与构图。不要换背景、不要修饰无关区域、不要裁切或重新生成场景。',
    acceptedImageRoles: ['source'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source'],
  },
  replace_product: {
    feature: 'replace_product',
    mainPrompt: '用目标产品替换场景图中的原产品，尽量保持原手持姿势、透视、大小比例与光影自然。除非明确要求对比展示，否则不保留新旧产品并存。',
    acceptedImageRoles: ['source', 'product'],
    requiredImageRoles: ['source', 'product'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'product'],
  },
  replace_logo: {
    feature: 'replace_logo',
    mainPrompt: '只替换原图中明显的品牌 Logo 或品牌文字。目标 Logo 仅作标识参考，保持原位置、透视、材质与光影贴合，不改包装结构、产品形态、背景及其他文字。',
    acceptedImageRoles: ['source', 'logo'],
    requiredImageRoles: ['source', 'logo'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'logo'],
  },
  main_image_asset_variation: {
    feature: 'main_image_asset_variation',
    mainPrompt: '参考当前主图，生成同类电商主图素材变体。支持不同风格、色系、构图及 Before/After 对比表达，默认不展示具体产品。',
    acceptedImageRoles: ['source', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'reference'],
    defaultShowProduct: false,
  },
  scene_variation: {
    feature: 'scene_variation',
    mainPrompt: '参考当前场景，生成同品类可用的新使用场景素材。发散不同具体使用场景，而非仅改色或构图，默认不展示具体产品。',
    acceptedImageRoles: ['source', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'reference'],
    defaultShowProduct: false,
  },
  create_new_scene: {
    feature: 'create_new_scene',
    mainPrompt: '根据产品品类与场景要求，创作新的电商使用场景图。自动发散多个真实生活场景，可含使用前后对比与细节图。',
    acceptedImageRoles: ['style'],
    requiredImageRoles: [],
    executionModel: 'generation',
    executionImageRoles: [],
  },
  prompt_only_main_asset: {
    feature: 'prompt_only_main_asset',
    mainPrompt: '根据用户描述完成电商主图或广告素材生成',
    acceptedImageRoles: ['source', 'reference', 'style'],
    requiredImageRoles: [],
    executionModel: 'generation',
    executionImageRoles: [],
  },
};

export function getImageFeatureDefinition(feature: ImageFeature): ImageFeatureDefinition {
  return FEATURE_DEFINITIONS[feature];
}

export function getExecutionImageRoles(request: ImageTaskRequest): ImageRole[] {
  const definition = getImageFeatureDefinition(request.feature);
  const images = request.images ?? [];
  return images
    .map((image) => image.role)
    .filter((role, index, roles) => (
      definition.executionImageRoles.includes(role) && roles.indexOf(role) === index
    ));
}

export function validateImageTaskRequest(input: ImageTaskRequest): ImageTaskRequest {
  if (!IMAGE_FEATURES.includes(input.feature)) {
    throw new Error(`unsupported image feature ${String(input.feature)}`);
  }

  const definition = getImageFeatureDefinition(input.feature);
  const images = input.images ?? [];

  for (const image of images) {
    if (!definition.acceptedImageRoles.includes(image.role)) {
      throw new Error(`${input.feature} does not accept image role ${image.role}`);
    }

    if (!image.path.trim()) {
      throw new Error(`image path for role ${image.role} is required`);
    }
  }

  for (const requiredRole of definition.requiredImageRoles) {
    if (!images.some((image) => image.role === requiredRole)) {
      throw new Error(`${input.feature} requires image role ${requiredRole}`);
    }
  }

  if (input.count !== undefined && (!Number.isInteger(input.count) || input.count <= 0)) {
    throw new Error('count must be a positive integer');
  }

  for (const region of input.regions ?? []) {
    validateRegion(region);
  }

  return {
    ...input,
    images,
    regions: input.regions ?? [],
  };
}

function validateRegion(region: RegionInput) {
  if (!region.id.trim()) {
    throw new Error('region id is required');
  }

  validateNonNegativeNumber(region.id, 'x', region.x);
  validateNonNegativeNumber(region.id, 'y', region.y);
  validateNonNegativeNumber(region.id, 'width', region.width);
  validateNonNegativeNumber(region.id, 'height', region.height);
}

function validateNonNegativeNumber(regionId: string, field: keyof RegionInput, value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new Error(`region ${regionId} ${field} must be a non-negative number`);
  }
}
