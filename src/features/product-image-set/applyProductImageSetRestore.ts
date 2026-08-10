import type {
  ComparisonIntensity,
  ComparisonLayout,
  MultiSceneLayout,
  ProductEffectMode,
  ProductHandheldMode,
} from '../../shared/domain/imageFeatureApi';
import type { ImportBatch, StoredImageRecord } from '../../shared/domain/images';
import type { TaskRecord } from '../../shared/domain/tasks';
import type { ImageAspectRatioValue } from '../../shared/view/imageAspectRatioOptions';
import { resolveImageCount } from '../../shared/view/imageCountOptions';
import { getFeatureRoute } from '../../shared/view/featureRoutes';
import type { ProductSetSubTab } from '../../shared/view/ui';
import { createImportBatch } from '../tasks/taskRestoreHelpers';

export interface ProductImageSetRestoreState {
  subTab: ProductSetSubTab;
  skuBatch: ImportBatch | null;
  prompt: string;
  negativePrompt: string;
  scenePrompt: string;
  productHandheldMode: ProductHandheldMode;
  productEffectMode: ProductEffectMode;
  comparisonLayout: ComparisonLayout;
  comparisonIntensity: ComparisonIntensity;
  showProduct: boolean;
  multiSceneLayout: MultiSceneLayout;
  aspectRatio: ImageAspectRatioValue;
  count: number;
}

function imageFromRequest(
  image: NonNullable<TaskRecord['request']>['images'][number],
  index: number,
  createdAt: string,
): StoredImageRecord {
  return {
    id: `product-${index}`,
    fileName: image.path.split(/[\\/]/).pop() ?? image.path,
    filePath: image.path,
    fileSize: 0,
    mimeType: image.mimeType ?? 'image/png',
    createdAt,
  };
}

export function applyProductImageSetRestore(task: TaskRecord): ProductImageSetRestoreState | null {
  const request = task.request;
  if (!request?.feature) {
    return null;
  }

  const subTab = getFeatureRoute(request.feature).productSetSubTab;
  if (!subTab) {
    return null;
  }

  const images = request.images
    .filter((image) => image.role === 'product')
    .map((image, index) => imageFromRequest(image, index, task.createdAt));

  return {
    subTab,
    skuBatch: createImportBatch(images, 'productSet', request.feature),
    prompt: request.prompt ?? '',
    negativePrompt: request.negativePrompt ?? '',
    scenePrompt: subTab === 'multiScene' ? '' : request.scenePrompt ?? '',
    productHandheldMode: resolveEnum(request.productHandheldMode, ['handheld', 'not_handheld'], 'not_handheld'),
    productEffectMode: resolveEnum(request.productEffectMode, ['auto', 'show', 'hide'], 'auto'),
    comparisonLayout: resolveEnum(request.comparisonLayout, ['auto', 'horizontal', 'vertical'], 'auto'),
    comparisonIntensity: resolveEnum(request.comparisonIntensity, ['light', 'medium', 'heavy'], 'medium'),
    showProduct: request.showProduct ?? true,
    multiSceneLayout: resolveEnum(request.multiSceneLayout, ['single', 'collage', 'grid'], 'single'),
    aspectRatio: (request.aspectRatio?.trim() || '1:1') as ImageAspectRatioValue,
    count: resolveImageCount(request.variantTotal ?? request.count ?? 1),
  };
}

function resolveEnum<Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  fallback: Value,
): Value {
  return typeof value === 'string' && allowed.includes(value as Value) ? value as Value : fallback;
}
