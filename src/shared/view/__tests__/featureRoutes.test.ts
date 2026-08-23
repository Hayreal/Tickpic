import { describe, expect, it } from 'vitest';
import { getFeatureRoute } from '../featureRoutes';

describe('feature routes', () => {
  it('restores product-set features to their dedicated subtabs', () => {
    expect(getFeatureRoute('product_main_image')).toEqual({
      tab: 'productSet',
      productSetSubTab: 'main',
    });
    expect(getFeatureRoute('product_comparison_image')).toEqual({
      tab: 'productSet',
      productSetSubTab: 'comparison',
    });
    expect(getFeatureRoute('product_multi_scene')).toEqual({
      tab: 'productSet',
      productSetSubTab: 'multiScene',
    });
  });

  it('restores sku features to their dedicated subtabs', () => {
    expect(getFeatureRoute('sku_replica')).toEqual({
      tab: 'sku',
      skuSubTab: 'replica',
    });
    expect(getFeatureRoute('sku_variation')).toEqual({
      tab: 'sku',
      skuSubTab: 'variation',
    });
    expect(getFeatureRoute('sku_original')).toEqual({
      tab: 'sku',
      skuSubTab: 'original',
    });
    expect(getFeatureRoute('sku_hit_main_image')).toEqual({
      tab: 'sku',
      skuSubTab: 'hitMain',
    });
  });
});
