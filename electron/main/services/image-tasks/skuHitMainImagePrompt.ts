import type { ImageFeature, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';
import {
  buildSkuHitMainConstraintSpec,
  renderSkuHitMainExecutionPrompt,
} from './skuHitMainConstraintSpec.js';

export function isSkuHitMainImageFeature(feature: ImageFeature): boolean {
  return feature === 'sku_hit_main_image';
}

export function buildSkuHitMainImagePrompt(request: ImageTaskRequest, designPlan?: string): string {
  return renderSkuHitMainExecutionPrompt(buildSkuHitMainConstraintSpec(request), designPlan ?? '');
}

export function orderHitMainExecutionImages(images: ImageTaskRequest['images'] = []) {
  const source = images.find((image) => image.role === 'source');
  const reference = images.find((image) => image.role === 'reference');
  if (!source || !reference) {
    return images;
  }
  return [source, reference];
}
