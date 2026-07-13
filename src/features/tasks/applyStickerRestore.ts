import {
  isStickerProductRatioPreset,
} from '../../shared/view/stickerProductRatioOptions';
import {
  DEFAULT_STICKER_OUTPUT_QUALITY,
  isStickerOutputQuality,
  type StickerOutputQuality,
} from '../../shared/domain/stickerOutputSpec';
import { DEFAULT_IMAGE_COUNT } from '../../shared/view/imageCountOptions';
import type { RegionMap } from '../../lib/regionSelection';
import { regionMapFromTask } from '../../lib/regionSelection';
import type { ImportBatch } from '../../shared/domain/images';
import type { TaskRecord } from '../../shared/domain/tasks';
import type { StickerSubTab } from '../../shared/view/ui';
import {
  DEFAULT_STICKER_BRAND,
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
  copyPrompt: string;
  copyColorScheme: string;
  copyRegions: RegionMap;
  copyCount: number;
  copyAspectRatio: string;
  copyOutputQuality: StickerOutputQuality;
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
  variationAspectRatio: string;
  variationOutputQuality: StickerOutputQuality;
  variationColorScheme: string;
  variationDirection: StickerVariationDirectionSelection;
  originalBatch: ImportBatch | null;
  originalCount: number;
  originalAspectRatio: string;
  originalOutputQuality: StickerOutputQuality;
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

function restoredRatio(request: NonNullable<TaskRecord['request']>): string {
  const aspectRatio = request.aspectRatio?.trim();
  if (aspectRatio && aspectRatio !== 'auto') {
    return aspectRatio;
  }
  return request.productRatio && isStickerProductRatioPreset(request.productRatio)
    ? request.productRatio
    : 'auto';
}

function restoredQuality(value?: string): StickerOutputQuality {
  return isStickerOutputQuality(value) ? value : DEFAULT_STICKER_OUTPUT_QUALITY;
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
    copyPrompt: '',
    copyColorScheme: '',
    copyRegions: {},
    copyCount: DEFAULT_IMAGE_COUNT,
    copyAspectRatio: 'auto',
    copyOutputQuality: DEFAULT_STICKER_OUTPUT_QUALITY,
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
    variationAspectRatio: 'auto',
    variationOutputQuality: DEFAULT_STICKER_OUTPUT_QUALITY,
    variationColorScheme: '',
    variationDirection: STICKER_VARIATION_DIRECTION_NONE,
    originalBatch: null,
    originalCount: DEFAULT_IMAGE_COUNT,
    originalAspectRatio: 'auto',
    originalOutputQuality: DEFAULT_STICKER_OUTPUT_QUALITY,
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
        copyBrand: structured.brand || request.logoText || DEFAULT_STICKER_BRAND,
        copyProductName: structured.productName,
        copyMaterial: structured.material,
        copySellingPoint: structured.sellingPoint,
        copyCapacity: structured.capacity,
        copyStyle: structured.style,
        copyColorBlockLayout: structured.colorBlockLayout,
        copyPrompt: request.prompt ?? '',
        copyColorScheme: structured.colorScheme,
        copyRegions: regionMapFromTask(task.imports, request.regions),
        copyCount: request.count ?? DEFAULT_IMAGE_COUNT,
        copyAspectRatio: restoredRatio(request),
        copyOutputQuality: restoredQuality(request.outputQuality),
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
        variationAspectRatio: restoredRatio(request),
        variationOutputQuality: restoredQuality(request.outputQuality),
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
        originalAspectRatio: restoredRatio(request),
        originalOutputQuality: restoredQuality(request.outputQuality),
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
