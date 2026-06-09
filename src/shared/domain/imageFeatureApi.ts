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
  brand?: string;
  sellingPoints?: string[];
  capacity?: string;
  logoText?: string;
  material?: string;
  style?: string;
  colorBlockLayout?: string;
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
    mainPrompt: '基于输入产品图贴纸展开， 复刻 2D 平面贴纸，：输出比例保持与输入一致，只输出平面包装图，不输出产品容器。色系、风格、排版和装饰元素保持严格一致，文案、品牌、容量可低优先级处理，可按入参替换、删除或固定为“wkau”；若无入参则默认尽量相似复刻。',
    acceptedImageRoles: ['source', 'logo', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'logo'],
  },
  sticker_variation: {
    feature: 'sticker_variation',
    mainPrompt: '基于输入产品图贴纸，做贴纸裂变设计：适当样式，色块，输出一张独立 2D 平面产品包装贴纸。尺寸严格按照输入图贴纸展开一样，具有商业设计质感，要像真实可用的商品贴纸。',
    acceptedImageRoles: ['source', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'reference'],
  },
  sticker_original: {
    feature: 'sticker_original',
    mainPrompt: '设计原创 2D 平面贴纸初稿，按品类与产品信息补充卖点与视觉风格。画面干净、专业、高清，具有商业设计质感，要像真实可用的商品贴纸',
    acceptedImageRoles: ['reference', 'style'],
    requiredImageRoles: [],
    executionModel: 'generation',
    executionImageRoles: [],
  },
  remove_product: {
    feature: 'remove_product',
    mainPrompt: '去除目标产品及喷雾/雾气叠加，补全遮挡区域；保留用户要求的文字与表面状态，不顺带清洁或美化。',
    acceptedImageRoles: ['source'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source'],
  },
  replace_product: {
    feature: 'replace_product',
    mainPrompt: '用目标产品替换场景原产品，保持姿势、透视、比例与光影自然。',
    acceptedImageRoles: ['source', 'product'],
    requiredImageRoles: ['source', 'product'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'product'],
  },
  replace_logo: {
    feature: 'replace_logo',
    mainPrompt: '只替换品牌 Logo，保持原位置、透视、材质与光影。',
    acceptedImageRoles: ['source', 'logo'],
    requiredImageRoles: ['source', 'logo'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'logo'],
  },
  main_image_asset_variation: {
    feature: 'main_image_asset_variation',
    mainPrompt: '生成主图素材变体，支持风格/构图/Before-After，默认无具体产品。',
    acceptedImageRoles: ['source', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'reference'],
    defaultShowProduct: false,
  },
  scene_variation: {
    feature: 'scene_variation',
    mainPrompt: '生成新的具体使用场景素材，默认无具体产品。',
    acceptedImageRoles: ['source', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'reference'],
    defaultShowProduct: false,
  },
  create_new_scene: {
    feature: 'create_new_scene',
    mainPrompt: '创作新的电商使用场景图，按品类发散真实生活场景。',
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
