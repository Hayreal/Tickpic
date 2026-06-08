import type { ImageAspectRatioValue } from '../../shared/view/imageAspectRatioOptions';
import type { RegionMap } from '../../lib/regionSelection';
import { regionMapFromTask } from '../../lib/regionSelection';
import type { ImportBatch } from '../../shared/domain/images';
import type { TaskRecord } from '../../shared/domain/tasks';
import type { ProductSubTab } from '../../shared/view/ui';
import { createImportBatch, getImageByRole } from './taskRestoreHelpers';

export interface ProductRestoreState {
  subTab: ProductSubTab;
  removeBatch: ImportBatch | null;
  removeDesc: string;
  removeRegions: RegionMap;
  removeAspectRatio: ImageAspectRatioValue;
  replaceSceneBatch: ImportBatch | null;
  replaceProductBatch: ImportBatch | null;
  replaceDesc: string;
  replaceRegions: RegionMap;
  replaceAspectRatio: ImageAspectRatioValue;
  logoSourceBatch: ImportBatch | null;
  logoTargetBatch: ImportBatch | null;
  logoDesc: string;
  logoText: string;
  logoRegions: RegionMap;
  logoAspectRatio: ImageAspectRatioValue;
  themeRefBatch: ImportBatch | null;
  themePrompt: string;
  themeSellingPoints: string;
  themeColorScheme: string;
  themeAspectRatio: ImageAspectRatioValue;
  themeShowProduct: boolean;
  themeCount: number;
  sceneVariationBatch: ImportBatch | null;
  sceneVariationPrompt: string;
  sceneVariationCategory: string;
  sceneVariationSellingPoints: string;
  sceneVariationColorScheme: string;
  sceneVariationShowProduct: boolean;
  sceneVariationAspectRatio: ImageAspectRatioValue;
  sceneVariationCount: number;
  sceneDesc: string;
  sceneProductCategory: string;
  sceneSellingPoints: string;
  sceneColorScheme: string;
  sceneShowProduct: boolean;
  sceneAspectRatio: ImageAspectRatioValue;
  sceneRefBatch: ImportBatch | null;
  sceneCount: number;
  promptAssetBatch: ImportBatch | null;
  promptAssetPrompt: string;
  promptAssetProductName: string;
  promptAssetSellingPoints: string;
  promptAssetColorScheme: string;
  promptAssetAspectRatio: ImageAspectRatioValue;
  promptAssetCount: number;
}

function aspectRatioFrom(value?: string): ImageAspectRatioValue {
  return (value?.trim() || 'auto') as ImageAspectRatioValue;
}

function batchFromRole(
  request: NonNullable<TaskRecord['request']>,
  role: string,
  page: ImportBatch['page'],
  feature: string,
): ImportBatch | null {
  const image = getImageByRole(request, role);
  return image ? createImportBatch([image], page, feature) : null;
}

export function applyProductRestore(task: TaskRecord): ProductRestoreState | null {
  const request = task.request;
  if (!request?.feature) {
    return null;
  }

  const base: ProductRestoreState = {
    subTab: 'remove',
    removeBatch: null,
    removeDesc: '',
    removeRegions: {},
    removeAspectRatio: 'auto',
    replaceSceneBatch: null,
    replaceProductBatch: null,
    replaceDesc: '',
    replaceRegions: {},
    replaceAspectRatio: 'auto',
    logoSourceBatch: null,
    logoTargetBatch: null,
    logoDesc: '',
    logoText: '',
    logoRegions: {},
    logoAspectRatio: 'auto',
    themeRefBatch: null,
    themePrompt: '',
    themeSellingPoints: '',
    themeColorScheme: '',
    themeAspectRatio: 'auto',
    themeShowProduct: false,
    themeCount: 4,
    sceneVariationBatch: null,
    sceneVariationPrompt: '',
    sceneVariationCategory: '',
    sceneVariationSellingPoints: '',
    sceneVariationColorScheme: '',
    sceneVariationShowProduct: false,
    sceneVariationAspectRatio: 'auto',
    sceneVariationCount: 1,
    sceneDesc: '',
    sceneProductCategory: '',
    sceneSellingPoints: '',
    sceneColorScheme: '',
    sceneShowProduct: true,
    sceneAspectRatio: 'auto',
    sceneRefBatch: null,
    sceneCount: 4,
    promptAssetBatch: null,
    promptAssetPrompt: '',
    promptAssetProductName: '',
    promptAssetSellingPoints: '',
    promptAssetColorScheme: '',
    promptAssetAspectRatio: 'auto',
    promptAssetCount: 4,
  };

  switch (request.feature) {
    case 'remove_product':
      return {
        ...base,
        subTab: 'remove',
        removeBatch: batchFromRole(request, 'source', 'product', 'remove_product'),
        removeDesc: request.prompt ?? '',
        removeRegions: regionMapFromTask(task.imports, request.regions),
        removeAspectRatio: aspectRatioFrom(request.aspectRatio),
      };
    case 'replace_product':
      return {
        ...base,
        subTab: 'replace',
        replaceSceneBatch: batchFromRole(request, 'source', 'product', 'replace_product'),
        replaceProductBatch: batchFromRole(request, 'product', 'product', 'replace_product'),
        replaceDesc: request.prompt ?? '',
        replaceRegions: regionMapFromTask(task.imports, request.regions),
        replaceAspectRatio: aspectRatioFrom(request.aspectRatio),
      };
    case 'replace_logo':
      return {
        ...base,
        subTab: 'logo',
        logoSourceBatch: batchFromRole(request, 'source', 'product', 'replace_logo'),
        logoTargetBatch: batchFromRole(request, 'logo', 'product', 'replace_logo'),
        logoDesc: request.prompt ?? '',
        logoText: request.logoText ?? '',
        logoRegions: regionMapFromTask(task.imports, request.regions),
        logoAspectRatio: aspectRatioFrom(request.aspectRatio),
      };
    case 'main_image_asset_variation':
      return {
        ...base,
        subTab: 'theme',
        themeRefBatch: batchFromRole(request, 'source', 'product', 'main_image_asset_variation'),
        themePrompt: request.prompt ?? '',
        themeSellingPoints: request.sellingPoints?.join(', ') ?? '',
        themeColorScheme: request.colorScheme ?? '',
        themeAspectRatio: aspectRatioFrom(request.aspectRatio),
        themeShowProduct: request.showProduct ?? false,
        themeCount: request.count ?? 4,
      };
    case 'scene_variation':
      return {
        ...base,
        subTab: 'sceneVariation',
        sceneVariationBatch: batchFromRole(request, 'source', 'product', 'scene_variation'),
        sceneVariationPrompt: request.prompt ?? '',
        sceneVariationCategory: request.productCategory ?? '',
        sceneVariationSellingPoints: request.sellingPoints?.join(', ') ?? '',
        sceneVariationColorScheme: request.colorScheme ?? '',
        sceneVariationShowProduct: request.showProduct ?? false,
        sceneVariationAspectRatio: aspectRatioFrom(request.aspectRatio),
        sceneVariationCount: request.count ?? 1,
      };
    case 'create_new_scene':
      return {
        ...base,
        subTab: 'scene',
        sceneDesc: request.prompt ?? '',
        sceneProductCategory: request.productCategory ?? '',
        sceneSellingPoints: request.sellingPoints?.join(', ') ?? '',
        sceneColorScheme: request.colorScheme ?? '',
        sceneShowProduct: request.showProduct ?? true,
        sceneAspectRatio: aspectRatioFrom(request.aspectRatio),
        sceneRefBatch: batchFromRole(request, 'style', 'product', 'create_new_scene'),
        sceneCount: request.count ?? 4,
      };
    case 'prompt_only_main_asset':
      return {
        ...base,
        subTab: 'promptAsset',
        promptAssetBatch: request.images && request.images.length > 0
          ? createImportBatch(
            request.images.map((image, index) => ({
              id: `${image.role}-${index}`,
              fileName: image.path.split('/').pop() ?? image.path,
              filePath: image.path,
              fileSize: 0,
              mimeType: image.mimeType ?? 'image/png',
              createdAt: task.createdAt,
            })),
            'product',
            'prompt_only_main_asset',
          )
          : null,
        promptAssetPrompt: request.prompt ?? '',
        promptAssetProductName: request.productName ?? '',
        promptAssetSellingPoints: request.sellingPoints?.join(', ') ?? '',
        promptAssetColorScheme: request.colorScheme ?? '',
        promptAssetAspectRatio: aspectRatioFrom(request.aspectRatio),
        promptAssetCount: request.count ?? 4,
      };
    default:
      return null;
  }
}
