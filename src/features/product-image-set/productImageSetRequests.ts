import type {
  ComparisonIntensity,
  ComparisonLayout,
  ImageTaskRequest,
  MultiSceneLayout,
  ProductEffectMode,
  ProductHandheldMode,
} from '../../shared/domain/imageFeatureApi';
import type { ImageAspectRatioValue } from '../../shared/view/imageAspectRatioOptions';
import type { ProductSetSubTab } from '../../shared/view/ui';

export interface ProductImageSetRequestInput {
  subTab: ProductSetSubTab;
  skuPaths: string[];
  aspectRatio: ImageAspectRatioValue;
  count: number;
  prompt: string;
  negativePrompt: string;
  scenePrompt: string;
  productHandheldMode: ProductHandheldMode;
  productEffectMode: ProductEffectMode;
  comparisonLayout: ComparisonLayout;
  comparisonIntensity: ComparisonIntensity;
  showProduct: boolean;
  multiSceneLayout: MultiSceneLayout;
  handheldReferencePath?: string | null;
}

const FEATURE_BY_SUB_TAB = {
  main: 'product_main_image',
  comparison: 'product_comparison_image',
  multiScene: 'product_multi_scene',
} as const;

export function buildProductImageSetRequests(
  input: ProductImageSetRequestInput,
): ImageTaskRequest[] {
  if (!Number.isInteger(input.count) || input.count <= 0) {
    throw new Error('生成数量必须是正整数');
  }

  if (input.skuPaths.length === 0) {
    throw new Error('请上传 SKU 产品图');
  }

  const images = input.skuPaths.map((path) => ({ role: 'product' as const, path }));
  const referencePath = input.handheldReferencePath?.trim();
  if (input.subTab === 'main' && input.productHandheldMode === 'handheld' && referencePath) {
    images.push({ role: 'reference', path: referencePath });
  }

  const feature = FEATURE_BY_SUB_TAB[input.subTab];
  const sharedFields = {
    ...optionalString('prompt', input.prompt),
    ...optionalString('negativePrompt', input.negativePrompt),
  };
  const featureFields = input.subTab === 'main'
    ? {
      ...optionalString('scenePrompt', input.scenePrompt),
      productHandheldMode: input.productHandheldMode,
      productEffectMode: input.productEffectMode,
    }
    : input.subTab === 'comparison'
      ? {
        ...optionalString('scenePrompt', input.scenePrompt),
        comparisonLayout: input.comparisonLayout,
        comparisonIntensity: input.comparisonIntensity,
        showProduct: input.showProduct,
      }
      : { multiSceneLayout: input.multiSceneLayout };

  return [{
    feature,
    images,
    count: input.count,
    aspectRatio: input.aspectRatio,
    ...sharedFields,
    ...featureFields,
  }];
}

function optionalString<Key extends 'prompt' | 'negativePrompt' | 'scenePrompt'>(key: Key, value: string) {
  const trimmed = value.trim();
  return trimmed ? { [key]: trimmed } as Pick<ImageTaskRequest, Key> : {};
}
