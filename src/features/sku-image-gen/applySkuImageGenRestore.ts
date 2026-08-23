import type { ImageAspectRatioValue } from '../../shared/view/imageAspectRatioOptions';
import {
  DEFAULT_SKU_HIT_MAIN_COUNT,
  DEFAULT_SKU_ORIGINAL_COUNT,
  DEFAULT_SKU_REPLICA_COUNT,
  DEFAULT_SKU_VARIATION_COUNT,
  resolveSkuImageCount,
} from '../../shared/view/skuCountOptions';
import type { ImportBatch } from '../../shared/domain/images';
import type { TaskRecord } from '../../shared/domain/tasks';
import type { SkuSubTab } from '../../shared/view/ui';
import { createImportBatch, getImageByRole, getImagesByRole } from '../tasks/taskRestoreHelpers';

export interface SkuTabState {
  skuBatch: ImportBatch | null;
  referenceBatch: ImportBatch | null;
  aspectRatio: ImageAspectRatioValue;
  count: number;
  brand: string;
  productName: string;
  capacity: string;
  prompt: string;
  negativePrompt: string;
}

export interface SkuImageGenRestoreState {
  subTab: SkuSubTab;
  replica: SkuTabState;
  variation: SkuTabState;
  original: SkuTabState;
  hitMain: SkuTabState;
}

function aspectRatioFrom(value?: string): ImageAspectRatioValue {
  return (value?.trim() || 'auto') as ImageAspectRatioValue;
}

function emptyTabState(
  defaultCount: number,
  aspectRatio: ImageAspectRatioValue = 'auto',
): SkuTabState {
  return {
    skuBatch: null,
    referenceBatch: null,
    aspectRatio,
    count: defaultCount,
    brand: '',
    productName: '',
    capacity: '',
    prompt: '',
    negativePrompt: '',
  };
}

function structuredFields(request: NonNullable<TaskRecord['request']>) {
  return {
    brand: request.brand ?? '',
    productName: request.productName ?? '',
    capacity: request.capacity ?? '',
    prompt: request.prompt ?? '',
    negativePrompt: request.negativePrompt ?? '',
    aspectRatio: aspectRatioFrom(request.aspectRatio),
    count: request.variantTotal ?? request.count ?? 1,
  };
}

function tabStateFromRequest(
  request: NonNullable<TaskRecord['request']>,
  defaultCount: number,
  pageFeature: string,
): SkuTabState {
  const sourceImage = getImageByRole(request, 'source');
  const referenceImages = getImagesByRole(request, 'reference');
  const structured = structuredFields(request);

  return {
    skuBatch: sourceImage
      ? createImportBatch([sourceImage], 'sku', pageFeature)
      : null,
    referenceBatch: referenceImages.length > 0
      ? createImportBatch(referenceImages, 'sku', `${pageFeature}-reference`)
      : null,
    aspectRatio: structured.aspectRatio,
    count: resolveSkuImageCount(structured.count, defaultCount),
    brand: structured.brand,
    productName: structured.productName,
    capacity: structured.capacity,
    prompt: structured.prompt,
    negativePrompt: structured.negativePrompt,
  };
}

export function applySkuImageGenRestore(task: TaskRecord): SkuImageGenRestoreState | null {
  const request = task.request;
  if (!request?.feature) {
    return null;
  }

  const base = {
    replica: emptyTabState(DEFAULT_SKU_REPLICA_COUNT),
    variation: emptyTabState(DEFAULT_SKU_VARIATION_COUNT),
    original: emptyTabState(DEFAULT_SKU_ORIGINAL_COUNT),
    hitMain: emptyTabState(DEFAULT_SKU_HIT_MAIN_COUNT, '1:1'),
  };

  switch (request.feature) {
    case 'sku_replica':
      return {
        ...base,
        subTab: 'replica',
        replica: tabStateFromRequest(request, DEFAULT_SKU_REPLICA_COUNT, 'sku_replica'),
      };
    case 'sku_variation':
      return {
        ...base,
        subTab: 'variation',
        variation: tabStateFromRequest(request, DEFAULT_SKU_VARIATION_COUNT, 'sku_variation'),
      };
    case 'sku_original':
      return {
        ...base,
        subTab: 'original',
        original: tabStateFromRequest(request, DEFAULT_SKU_ORIGINAL_COUNT, 'sku_original'),
      };
    case 'sku_hit_main_image':
      return {
        ...base,
        subTab: 'hitMain',
        hitMain: tabStateFromRequest(request, DEFAULT_SKU_HIT_MAIN_COUNT, 'sku_hit_main_image'),
      };
    default:
      return null;
  }
}
