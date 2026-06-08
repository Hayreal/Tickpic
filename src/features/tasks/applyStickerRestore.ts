import type { ImageAspectRatioValue } from '../../shared/view/imageAspectRatioOptions';
import type { RegionMap } from '../../lib/regionSelection';
import { regionMapFromTask } from '../../lib/regionSelection';
import type { ImportBatch } from '../../shared/domain/images';
import type { TaskRecord } from '../../shared/domain/tasks';
import type { StickerSubTab } from '../../shared/view/ui';
import { createImportBatch, getImageByRole } from './taskRestoreHelpers';

export interface StickerRestoreState {
  subTab: StickerSubTab;
  copyBatch: ImportBatch | null;
  copyLogo: ImportBatch | null;
  copyProductName: string;
  copyLogoText: string;
  copyPrompt: string;
  copyColorScheme: string;
  copyAspectRatio: ImageAspectRatioValue;
  copyRegions: RegionMap;
  copyCount: number;
  variationBatch: ImportBatch | null;
  variationPrompt: string;
  variationCount: number;
  variationAspectRatio: ImageAspectRatioValue;
  variationColorScheme: string;
  originalBatch: ImportBatch | null;
  originalCount: number;
  originalAspectRatio: ImageAspectRatioValue;
  originalCategory: string;
  originalBrand: string;
  originalSellingPoint: string;
  originalVolume: string;
  originalStyle: string;
  originalColorScheme: string;
}

function aspectRatioFrom(value?: string): ImageAspectRatioValue {
  return (value?.trim() || 'auto') as ImageAspectRatioValue;
}

export function applyStickerRestore(task: TaskRecord): StickerRestoreState | null {
  const request = task.request;
  if (!request?.feature) {
    return null;
  }

  const sourceImage = getImageByRole(request, 'source');
  const referenceImage = getImageByRole(request, 'reference');
  const styleImage = getImageByRole(request, 'style');

  const base = {
    copyBatch: null,
    copyLogo: null,
    copyProductName: '',
    copyLogoText: '',
    copyPrompt: '',
    copyColorScheme: '',
    copyAspectRatio: 'auto' as ImageAspectRatioValue,
    copyRegions: {},
    copyCount: 1,
    variationBatch: null,
    variationPrompt: '',
    variationCount: 4,
    variationAspectRatio: 'auto' as ImageAspectRatioValue,
    variationColorScheme: '',
    originalBatch: null,
    originalCount: 4,
    originalAspectRatio: 'auto' as ImageAspectRatioValue,
    originalCategory: '',
    originalBrand: '',
    originalSellingPoint: '',
    originalVolume: '',
    originalStyle: '',
    originalColorScheme: '',
  };

  switch (request.feature) {
    case 'sticker_replica':
      return {
        ...base,
        subTab: 'copy',
        copyBatch: sourceImage ? createImportBatch([sourceImage], 'sticker', 'sticker_replica') : null,
        copyLogo: referenceImage ? createImportBatch([referenceImage], 'sticker', 'sticker_replica') : null,
        copyProductName: request.productName ?? '',
        copyLogoText: request.logoText ?? '',
        copyPrompt: request.prompt ?? '',
        copyColorScheme: request.colorScheme ?? '',
        copyAspectRatio: aspectRatioFrom(request.aspectRatio),
        copyRegions: regionMapFromTask(task.imports, request.regions),
        copyCount: request.count ?? 1,
      };
    case 'sticker_variation':
      return {
        ...base,
        subTab: 'variation',
        variationBatch: sourceImage ? createImportBatch([sourceImage], 'sticker', 'sticker_variation') : null,
        variationPrompt: request.prompt ?? '',
        variationCount: request.count ?? 4,
        variationAspectRatio: aspectRatioFrom(request.aspectRatio),
        variationColorScheme: request.colorScheme ?? '',
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
        originalCount: request.count ?? 4,
        originalAspectRatio: aspectRatioFrom(request.aspectRatio),
        originalCategory: request.productCategory ?? '',
        originalBrand: request.productName ?? request.logoText ?? '',
        originalSellingPoint: request.sellingPoints?.join(', ') ?? '',
        originalVolume: request.capacity ?? '',
        originalStyle: request.prompt?.replace(/^Style:\s*/i, '') ?? '',
        originalColorScheme: request.colorScheme ?? '',
      };
    default:
      return null;
  }
}
