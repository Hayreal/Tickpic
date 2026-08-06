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
});
