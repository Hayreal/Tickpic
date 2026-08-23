import type { ImageFeature } from '../domain/imageFeatureApi.js';
import type { ActiveTab, ProductSetSubTab, ProductSubTab, SkuSubTab, StickerSubTab } from './ui.js';

export interface FeatureRoute {
  tab: ActiveTab;
  stickerSubTab?: StickerSubTab;
  productSubTab?: ProductSubTab;
  skuSubTab?: SkuSubTab;
  productSetSubTab?: ProductSetSubTab;
}

const FEATURE_ROUTES: Record<ImageFeature, FeatureRoute> = {
  sticker_replica: { tab: 'sticker', stickerSubTab: 'copy' },
  sticker_variation: { tab: 'sticker', stickerSubTab: 'variation' },
  sticker_original: { tab: 'sticker', stickerSubTab: 'original' },
  remove_product: { tab: 'product', productSubTab: 'remove' },
  replace_product: { tab: 'product', productSubTab: 'replace' },
  replace_logo: { tab: 'product', productSubTab: 'logo' },
  main_image_asset_variation: { tab: 'product', productSubTab: 'theme' },
  scene_variation: { tab: 'product', productSubTab: 'sceneVariation' },
  create_new_scene: { tab: 'product', productSubTab: 'scene' },
  prompt_only_main_asset: { tab: 'product', productSubTab: 'promptAsset' },
  product_main_image: { tab: 'productSet', productSetSubTab: 'main' },
  product_comparison_image: { tab: 'productSet', productSetSubTab: 'comparison' },
  product_multi_scene: { tab: 'productSet', productSetSubTab: 'multiScene' },
  sku_replica: { tab: 'sku', skuSubTab: 'replica' },
  sku_variation: { tab: 'sku', skuSubTab: 'variation' },
  sku_original: { tab: 'sku', skuSubTab: 'original' },
  sku_hit_main_image: { tab: 'sku', skuSubTab: 'hitMain' },
};

export function getFeatureRoute(feature: ImageFeature): FeatureRoute {
  return FEATURE_ROUTES[feature];
}
