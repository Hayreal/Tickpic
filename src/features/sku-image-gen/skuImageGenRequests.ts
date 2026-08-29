import type { ImageTaskRequest } from '../../shared/domain/imageFeatureApi';
import type { ImageAspectRatioValue } from '../../shared/view/imageAspectRatioOptions';
import type { SkuSubTab } from '../../shared/view/ui';

export interface SkuImageGenRequestInput {
  subTab: SkuSubTab;
  skuPath: string;
  referencePaths: string[];
  aspectRatio: ImageAspectRatioValue;
  count: number;
  brand: string;
  productName: string;
  capacity: string;
  prompt: string;
  negativePrompt: string;
}

const FEATURE_BY_SUB_TAB = {
  replica: 'sku_replica',
  variation: 'sku_variation',
  original: 'sku_original',
  hitMain: 'sku_hit_main_image',
} as const satisfies Record<SkuSubTab, ImageTaskRequest['feature']>;

function optionalString<Key extends 'brand' | 'productName' | 'capacity' | 'prompt' | 'negativePrompt'>(
  key: Key,
  value: string,
) {
  const trimmed = value.trim();
  return trimmed ? { [key]: trimmed } as Pick<ImageTaskRequest, Key> : {};
}

export function buildSkuImageGenRequests(input: SkuImageGenRequestInput): ImageTaskRequest[] {
  if (!input.skuPath.trim()) {
    throw new Error('请上传 SKU 图');
  }

  if (input.subTab === 'replica' && input.referencePaths.length === 0) {
    throw new Error('请上传参考图');
  }

  if (input.subTab === 'hitMain' && input.referencePaths.length === 0) {
    throw new Error('请上传爆款主图参考');
  }

  if (input.subTab === 'hitMain' && input.referencePaths.length > 1) {
    throw new Error('爆款主图参考只能上传 1 张');
  }

  if (input.subTab === 'original' && !input.productName.trim()) {
    throw new Error('请输入产品名称');
  }

  if (!Number.isInteger(input.count) || input.count <= 0) {
    throw new Error('生成数量必须是正整数');
  }

  const feature = FEATURE_BY_SUB_TAB[input.subTab];
  const images = [
    { role: 'source' as const, path: input.skuPath },
    ...input.referencePaths.map((path) => ({ role: 'reference' as const, path })),
  ];
  const sharedFields = {
    aspectRatio: input.aspectRatio,
    ...optionalString('brand', input.brand),
    ...optionalString('productName', input.productName),
    ...optionalString('capacity', input.capacity),
    ...optionalString('prompt', input.prompt),
    ...optionalString('negativePrompt', input.negativePrompt),
  };

  return [{
    feature,
    images,
    count: input.count,
    ...sharedFields,
  }];
}

export function getSkuImageGenFeature(subTab: SkuSubTab): ImageTaskRequest['feature'] {
  return FEATURE_BY_SUB_TAB[subTab];
}
