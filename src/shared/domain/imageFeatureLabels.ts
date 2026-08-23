import type { ImageFeature } from './imageFeatureApi.js';

export interface ImageFeatureLabel {
  category: string;
  feature: string;
}

export const IMAGE_FEATURE_LABELS: Record<ImageFeature, ImageFeatureLabel> = {
  sticker_replica: { category: '贴纸', feature: '贴纸复刻' },
  sticker_variation: { category: '贴纸', feature: '贴纸裂变' },
  sticker_original: { category: '贴纸', feature: '贴纸原创' },
  remove_product: { category: '产品', feature: '去除产品' },
  replace_product: { category: '产品', feature: '替换产品' },
  replace_logo: { category: '产品', feature: '替换 Logo' },
  main_image_asset_variation: { category: '产品', feature: '主图素材裂变' },
  scene_variation: { category: '产品', feature: '场景裂变' },
  create_new_scene: { category: '产品', feature: '创作新场景' },
  prompt_only_main_asset: { category: '产品', feature: '纯提示词主图' },
  product_main_image: { category: '套图', feature: '主图' },
  product_comparison_image: { category: '套图', feature: '对比图' },
  product_multi_scene: { category: '套图', feature: '多场景图' },
  sku_replica: { category: 'SKU', feature: 'SKU 复刻' },
  sku_variation: { category: 'SKU', feature: 'SKU 裂变' },
  sku_original: { category: 'SKU', feature: 'SKU 原创' },
  sku_hit_main_image: { category: 'SKU', feature: 'SKU 爆款主图' },
};

export function getImageFeatureLabel(feature: ImageFeature): ImageFeatureLabel {
  return IMAGE_FEATURE_LABELS[feature];
}
