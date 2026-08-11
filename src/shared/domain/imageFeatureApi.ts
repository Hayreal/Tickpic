import type { StickerVariationDirection } from './stickerPrompts.js';

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
  'product_main_image',
  'product_comparison_image',
  'product_multi_scene',
] as const;

export type ImageFeature = typeof IMAGE_FEATURES[number];

const SHOW_PRODUCT_FEATURES: readonly ImageFeature[] = [
  'main_image_asset_variation',
  'scene_variation',
  'create_new_scene',
  'product_comparison_image',
];

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
export type ProductHandheldMode = 'handheld' | 'not_handheld';
export type ProductEffectMode = 'auto' | 'show' | 'hide';
export type ComparisonLayout = 'auto' | 'horizontal' | 'vertical';
export type ComparisonIntensity = 'light' | 'medium' | 'heavy';
export type MultiSceneLayout = 'single' | 'collage' | 'grid';

export const MAX_NEGATIVE_PROMPT_LENGTH = 500;

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
  negativePrompt?: string;
  scenePrompt?: string;
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
  stickerVariationDirection?: StickerVariationDirection;
  variantIndex?: number;
  variantTotal?: number;
  /** When set, multiple tasks from one UI batch share the same output folder. */
  outputBatchId?: string;
  aspectRatio?: string;
  productRatio?: string;
  showProduct?: boolean;
  productHandheldMode?: ProductHandheldMode;
  productEffectMode?: ProductEffectMode;
  comparisonLayout?: ComparisonLayout;
  comparisonIntensity?: ComparisonIntensity;
  multiSceneLayout?: MultiSceneLayout;
  modelOverrides?: {
    vision?: string;
    generation?: string;
    edit?: string;
    protocol?: ImageModelProtocol;
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

const STICKER_RECTANGLE_SHAPE_REQUIREMENT =
  '所有贴纸输出都必须是直角矩形平面贴纸：四角为 90 度直角，边缘为水平/垂直直线；不要圆角、弧边、圆形、椭圆、异形、模切边或瓶身弧面轮廓。';

const FEATURE_DEFINITIONS: Record<ImageFeature, ImageFeatureDefinition> = {
  sticker_replica: {
    feature: 'sticker_replica',
    mainPrompt: `从当前产品图中提取产品表面的贴纸/标签，展开为正视角 2D 平面贴纸图。可以按内容判断横竖比例，但外轮廓必须输出为直角矩形，不按原图圆角、弧边或瓶身曲面轮廓出图。若输入是侧拍、斜拍、弧面或可见包装侧面，必须将可见贴纸/包装版面去透视并拉平成连续平面展开稿，不保留盒体侧面、厚度、折角、阴影、反光或 3D 透视。只输出贴纸本身，不输出产品容器或背景。保留原贴纸的排版、色系、风格、装饰元素和图案位置；画面文字须为英文，若原图文字为中文则翻译为对应英文后呈现。若提供单独 Logo 图，仅作为品牌标识嵌入到对应位置，不作为版式、配色或风格参考。${STICKER_RECTANGLE_SHAPE_REQUIREMENT}`,
    acceptedImageRoles: ['source', 'logo', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'logo'],
  },
  sticker_variation: {
    feature: 'sticker_variation',
    mainPrompt: `基于输入产品图贴纸，做贴纸裂变设计：适当样式，色块，输出一张独立 2D 平面产品包装贴纸。可以参考输入贴纸内容比例，但外轮廓必须是直角矩形，不要沿用原图圆角、弧边或瓶身曲面轮廓。具有商业设计质感，要像真实可用的商品贴纸。${STICKER_RECTANGLE_SHAPE_REQUIREMENT}`,
    acceptedImageRoles: ['source', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'reference'],
  },
  sticker_original: {
    feature: 'sticker_original',
    mainPrompt: `设计原创 2D 平面贴纸初稿，按品类与产品信息补充卖点与视觉风格。画面干净、专业、高清，具有商业设计质感，要像真实可用的商品贴纸。${STICKER_RECTANGLE_SHAPE_REQUIREMENT}`,
    acceptedImageRoles: ['reference', 'style'],
    requiredImageRoles: [],
    executionModel: 'generation',
    executionImageRoles: ['style', 'reference'],
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
    mainPrompt: '用目标产品替换场景原产品，保持姿势、透视、比例与光影自然。产品的品牌，产品名称，容量，色系，风格，排版等细节要严格一致，不要有任何的差异。',
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
    mainPrompt: '基于输入图生成跨境电商主图。若输入是白底/孤立产品图，保留原产品外观、品牌、标签和关键文字，并补充生活方式场景、英文标题、卖点卡片、图标与商业光影；若输入已是主图/场景图，则生成明显不同的场景、标题排版或主视觉构图。画面高清干净，适合商品主图/广告素材。',
    acceptedImageRoles: ['source', 'reference'],
    requiredImageRoles: ['source'],
    executionModel: 'edit',
    executionImageRoles: ['source', 'reference'],
    defaultShowProduct: true,
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
  product_main_image: {
    feature: 'product_main_image',
    mainPrompt: 'Generate one US Temu ecommerce main product image from a single primary SKU photo. Keep SKU identity locked, include a short English headline, and freely choose the strongest commercial visual approach. Structured handheld/effect controls and batch variant index/total are encoded in the JSON execution prompt.',
    acceptedImageRoles: ['product'],
    requiredImageRoles: ['product'],
    executionModel: 'edit',
    executionImageRoles: ['product'],
    defaultShowProduct: true,
  },
  product_comparison_image: {
    feature: 'product_comparison_image',
    mainPrompt: 'Generate one US Temu before/after comparison image from a single primary SKU photo. One scene, one BEFORE/AFTER pair, panels without SKU; optional enlarged foreground product overlay. Structured layout/intensity/showProduct and batch variant index/total are encoded in the JSON execution prompt.',
    acceptedImageRoles: ['product'],
    requiredImageRoles: ['product'],
    executionModel: 'edit',
    executionImageRoles: ['product'],
    defaultShowProduct: true,
  },
  product_multi_scene: {
    feature: 'product_multi_scene',
    mainPrompt: 'Generate one US Temu multi-application-scope image from a single primary SKU photo used only for category/use recognition. Never render the SKU body or people. Structured single/collage/grid layout and batch variant index/total are encoded in the JSON execution prompt.',
    acceptedImageRoles: ['product'],
    requiredImageRoles: ['product'],
    executionModel: 'edit',
    executionImageRoles: ['product'],
    defaultShowProduct: false,
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

  validateProductSetControls(input);

  if (input.count !== undefined && (!Number.isInteger(input.count) || input.count <= 0)) {
    throw new Error('count must be a positive integer');
  }

  if (input.negativePrompt !== undefined && input.negativePrompt.length > MAX_NEGATIVE_PROMPT_LENGTH) {
    throw new Error(`negativePrompt must be at most ${MAX_NEGATIVE_PROMPT_LENGTH} characters`);
  }

  if ((input.variantIndex === undefined) !== (input.variantTotal === undefined)) {
    throw new Error('variantIndex and variantTotal must be provided together');
  }

  if (input.variantIndex !== undefined && (!Number.isInteger(input.variantIndex) || input.variantIndex <= 0)) {
    throw new Error('variantIndex must be a positive integer');
  }

  if (input.variantTotal !== undefined && (!Number.isInteger(input.variantTotal) || input.variantTotal <= 0)) {
    throw new Error('variantTotal must be a positive integer');
  }

  if (input.variantIndex !== undefined && input.variantTotal !== undefined && input.variantIndex > input.variantTotal) {
    throw new Error('variantIndex must be less than or equal to variantTotal');
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

function validateProductSetControls(input: ImageTaskRequest) {
  validateEnum(input.productHandheldMode, ['handheld', 'not_handheld'], 'productHandheldMode');
  validateEnum(input.productEffectMode, ['auto', 'show', 'hide'], 'productEffectMode');
  validateEnum(input.comparisonLayout, ['auto', 'horizontal', 'vertical'], 'comparisonLayout');
  validateEnum(input.comparisonIntensity, ['light', 'medium', 'heavy'], 'comparisonIntensity');
  validateEnum(input.multiSceneLayout, ['single', 'collage', 'grid'], 'multiSceneLayout');

  validateControlOwnership(input, 'productHandheldMode', ['product_main_image']);
  validateControlOwnership(input, 'productEffectMode', ['product_main_image']);
  validateControlOwnership(input, 'comparisonLayout', ['product_comparison_image']);
  validateControlOwnership(input, 'comparisonIntensity', ['product_comparison_image']);
  validateControlOwnership(input, 'multiSceneLayout', ['product_multi_scene']);
  validateControlOwnership(input, 'scenePrompt', ['product_main_image', 'product_comparison_image']);

  if (input.showProduct !== undefined) {
    if (typeof input.showProduct !== 'boolean') {
      throw new Error('showProduct must be a boolean');
    }

    if (!SHOW_PRODUCT_FEATURES.includes(input.feature)) {
      throw new Error(`showProduct is not supported by ${input.feature}`);
    }
  }
}

function validateEnum(value: unknown, allowed: readonly string[], field: string) {
  if (value !== undefined && (typeof value !== 'string' || !allowed.includes(value))) {
    throw new Error(`${field} must be one of ${allowed.join(', ')}`);
  }
}

function validateControlOwnership(
  input: ImageTaskRequest,
  field: keyof ImageTaskRequest,
  supportedFeatures: readonly ImageFeature[],
) {
  if (input[field] !== undefined && !supportedFeatures.includes(input.feature)) {
    throw new Error(`${field} is not supported by ${input.feature}`);
  }
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
