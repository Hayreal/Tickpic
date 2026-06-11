import type { ImageAspectRatioValue } from '../../shared/view/imageAspectRatioOptions';
import {
  resolveStickerProductRatio,
  type StickerProductRatioSelection,
} from '../../shared/view/stickerProductRatioOptions';
import { DEFAULT_IMAGE_COUNT } from '../../shared/view/imageCountOptions';
import type { RegionMap } from '../../lib/regionSelection';
import { regionMapFromTask } from '../../lib/regionSelection';
import type { ImportBatch } from '../../shared/domain/images';
import type { TaskRecord } from '../../shared/domain/tasks';
import type { StickerSubTab } from '../../shared/view/ui';
import {
  DEFAULT_STICKER_BRAND,
  DEFAULT_STICKER_REPLICA_LOGO_TEXT,
  STICKER_VARIATION_DIRECTION_NONE,
  type StickerVariationDirectionSelection,
} from '../../shared/domain/stickerPrompts';
import { createImportBatch, getImageByRole } from './taskRestoreHelpers';

export interface StickerRestoreState {
  subTab: StickerSubTab;
  copyBatch: ImportBatch | null;
  copyLogo: ImportBatch | null;
  copyBrand: string;
  copyProductName: string;
  copyMaterial: string;
  copySellingPoint: string;
  copyCapacity: string;
  copyStyle: string;
  copyColorBlockLayout: string;
  copyLogoText: string;
  copyPrompt: string;
  copyColorScheme: string;
  copyRegions: RegionMap;
  copyCount: number;
  copyAspectRatio: ImageAspectRatioValue;
  copyProductRatio: StickerProductRatioSelection;
  variationBatch: ImportBatch | null;
  variationBrand: string;
  variationProductName: string;
  variationMaterial: string;
  variationSellingPoint: string;
  variationCapacity: string;
  variationStyle: string;
  variationColorBlockLayout: string;
  variationPrompt: string;
  variationCount: number;
  variationAspectRatio: ImageAspectRatioValue;
  variationProductRatio: StickerProductRatioSelection;
  variationColorScheme: string;
  variationDirection: StickerVariationDirectionSelection;
  originalBatch: ImportBatch | null;
  originalCount: number;
  originalAspectRatio: ImageAspectRatioValue;
  originalProductRatio: StickerProductRatioSelection;
  originalCategory: string;
  originalBrand: string;
  originalProductName: string;
  originalMaterial: string;
  originalSellingPoint: string;
  originalVolume: string;
  originalStyle: string;
  originalColorBlockLayout: string;
  originalColorScheme: string;
}

function aspectRatioFrom(value?: string): ImageAspectRatioValue {
  return (value?.trim() || 'auto') as ImageAspectRatioValue;
}

function stickerStructuredFields(request: NonNullable<TaskRecord['request']>) {
  return {
    brand: request.brand ?? '',
    productName: request.productName ?? '',
    material: request.material ?? '',
    sellingPoint: request.sellingPoints?.join(', ') ?? '',
    capacity: request.capacity ?? '',
    style: request.style ?? '',
    colorBlockLayout: request.colorBlockLayout ?? '',
    colorScheme: request.colorScheme ?? '',
  };
}

export function applyStickerRestore(task: TaskRecord): StickerRestoreState | null {
  const request = task.request;
  if (!request?.feature) {
    return null;
  }

  const sourceImage = getImageByRole(request, 'source');
  const referenceImage = getImageByRole(request, 'reference');
  const logoImage = getImageByRole(request, 'logo');
  const styleImage = getImageByRole(request, 'style');
  const structured = stickerStructuredFields(request);

  const base: Omit<StickerRestoreState, 'subTab'> = {
    copyBatch: null,
    copyLogo: null,
    copyBrand: '',
    copyProductName: '',
    copyMaterial: '',
    copySellingPoint: '',
    copyCapacity: '',
    copyStyle: '',
    copyColorBlockLayout: '',
    copyLogoText: DEFAULT_STICKER_REPLICA_LOGO_TEXT,
    copyPrompt: '',
    copyColorScheme: '',
    copyRegions: {},
    copyCount: DEFAULT_IMAGE_COUNT,
    copyAspectRatio: 'auto' as ImageAspectRatioValue,
    copyProductRatio: '',
    variationBatch: null,
    variationBrand: DEFAULT_STICKER_BRAND,
    variationProductName: '',
    variationMaterial: '',
    variationSellingPoint: '',
    variationCapacity: '',
    variationStyle: '',
    variationColorBlockLayout: '',
    variationPrompt: '',
    variationCount: DEFAULT_IMAGE_COUNT,
    variationAspectRatio: 'auto' as ImageAspectRatioValue,
    variationProductRatio: '',
    variationColorScheme: '',
    variationDirection: STICKER_VARIATION_DIRECTION_NONE,
    originalBatch: null,
    originalCount: DEFAULT_IMAGE_COUNT,
    originalAspectRatio: 'auto' as ImageAspectRatioValue,
    originalProductRatio: '',
    originalCategory: '',
    originalBrand: DEFAULT_STICKER_BRAND,
    originalProductName: '',
    originalMaterial: '',
    originalSellingPoint: '',
    originalVolume: '',
    originalStyle: '',
    originalColorBlockLayout: '',
    originalColorScheme: '',
  };

  switch (request.feature) {
    case 'sticker_replica':
      return {
        ...base,
        subTab: 'copy',
        copyBatch: sourceImage ? createImportBatch([sourceImage], 'sticker', 'sticker_replica') : null,
        copyLogo: (logoImage ?? referenceImage)
          ? createImportBatch([logoImage ?? referenceImage!], 'sticker', 'sticker_replica')
          : null,
        copyBrand: structured.brand,
        copyProductName: structured.productName,
        copyMaterial: structured.material,
        copySellingPoint: structured.sellingPoint,
        copyCapacity: structured.capacity,
        copyStyle: structured.style,
        copyColorBlockLayout: structured.colorBlockLayout,
        copyLogoText: request.logoText ?? DEFAULT_STICKER_REPLICA_LOGO_TEXT,
        copyPrompt: request.prompt ?? '',
        copyColorScheme: structured.colorScheme,
        copyRegions: regionMapFromTask(task.imports, request.regions),
        copyCount: request.count ?? DEFAULT_IMAGE_COUNT,
        copyAspectRatio: aspectRatioFrom(request.aspectRatio),
        copyProductRatio: resolveStickerProductRatio(request.productRatio),
      };
    case 'sticker_variation':
      return {
        ...base,
        subTab: 'variation',
        variationBatch: sourceImage ? createImportBatch([sourceImage], 'sticker', 'sticker_variation') : null,
        variationBrand: structured.brand || DEFAULT_STICKER_BRAND,
        variationProductName: structured.productName,
        variationMaterial: structured.material,
        variationSellingPoint: structured.sellingPoint,
        variationCapacity: structured.capacity,
        variationStyle: structured.style,
        variationColorBlockLayout: structured.colorBlockLayout,
        variationPrompt: request.prompt ?? '',
        variationCount: request.count ?? DEFAULT_IMAGE_COUNT,
        variationAspectRatio: aspectRatioFrom(request.aspectRatio),
        variationProductRatio: resolveStickerProductRatio(request.productRatio),
        variationColorScheme: structured.colorScheme,
        variationDirection: request.stickerVariationDirection ?? STICKER_VARIATION_DIRECTION_NONE,
      };
    case 'sticker_original':
      return {
        ...base,
        subTab: 'original',
        originalBatch: styleImage
          ? createImportBatch([styleImage], 'sticker', 'sticker_original')
          : referenceImage
            ? createImportBatch([referenceImage], 'sticker', 'sticker_original')
            : null,
        originalCount: request.count ?? DEFAULT_IMAGE_COUNT,
        originalAspectRatio: aspectRatioFrom(request.aspectRatio),
        originalProductRatio: resolveStickerProductRatio(request.productRatio),
        originalCategory: request.productCategory ?? '',
        originalBrand: structured.brand || request.productName || request.logoText || DEFAULT_STICKER_BRAND,
        originalProductName: structured.productName,
        originalMaterial: structured.material,
        originalSellingPoint: structured.sellingPoint,
        originalVolume: structured.capacity,
        originalStyle: structured.style,
        originalColorBlockLayout: structured.colorBlockLayout,
        originalColorScheme: structured.colorScheme,
      };
    default:
      return null;
  }
}
