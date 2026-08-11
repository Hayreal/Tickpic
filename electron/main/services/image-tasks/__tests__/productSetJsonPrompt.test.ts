import { describe, expect, it } from 'vitest';
import { buildProductSetJsonPrompt, parseProductSetJsonPrompt } from '../productSetJsonPrompt';

describe('productSetJsonPrompt', () => {
  it('returns parseable JSON for a main-image handheld spray request', () => {
    const text = buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'show',
      scenePrompt: 'fixative spray on canvas',
      prompt: 'premium commercial look',
      negativePrompt: 'extra bottles',
      variantIndex: 1,
      variantTotal: 3,
      aspectRatio: '1:1',
    });

    const spec = parseProductSetJsonPrompt(text);

    expect(spec.task).toBe('product_main_image');
    expect(spec.output.aspect_ratio).toBe('1:1');
    expect(spec.output.marketplace).toBe('US Temu ecommerce');
    expect(spec.sku_lock.source).toContain('single primary SKU');
    expect(spec.sku_lock.must_preserve).toEqual(expect.arrayContaining([
      'exact product aspect ratio',
      'cap/nozzle/trigger geometry',
    ]));
    expect(spec.composition.strategy).toBe('free_within_controls');
    expect(spec.composition.product_required).toBe(true);
    expect(spec.composition.hand_required).toBe(true);
    expect(spec.handheld.mode).toBe('handheld');
    expect(spec.handheld.required).toBe(true);
    expect(spec.handheld.fallback).toBeUndefined();
    expect(spec.handheld.rules).toEqual(expect.arrayContaining([
      expect.stringContaining('5 fingers'),
      expect.stringContaining('thumb must be visible'),
      expect.stringContaining('not extend past the wrist'),
    ]));
    expect(spec.spray_physics.spray_origin).toContain('nozzle');
    expect(spec.copy.headline).toEqual(expect.objectContaining({
      language: 'en',
      word_count: '3-7',
    }));
    expect(spec.negative_prompt).toEqual(expect.arrayContaining([
      expect.stringMatching(/icon|badge|selling point/i),
      expect.stringMatching(/Chinese/i),
    ]));
    expect(spec.quality_targets).toEqual(expect.arrayContaining([
      expect.stringMatching(/thumb/i),
      expect.stringMatching(/wrist/i),
    ]));
    expect(spec.user_overrides).toEqual({
      scene: 'fixative spray on canvas',
      supplement: 'premium commercial look',
      avoid: 'extra bottles',
      priority: expect.stringContaining('sku_lock'),
    });
    expect(spec.variant).toEqual(expect.objectContaining({
      index: 1,
      total: 3,
    }));
    expect(typeof spec.variant.directive).toBe('string');
    expect(spec.variant.directive.length).toBeGreaterThan(20);
  });

  it('keeps main-image visual strategy free and only varies by N', () => {
    const one = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      variantIndex: 1,
      variantTotal: 3,
    }));
    const two = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      variantIndex: 2,
      variantTotal: 3,
    }));

    expect(one.composition.strategy).toBe('free_within_controls');
    expect(two.composition.strategy).toBe('free_within_controls');
    expect(one.variant.directive).not.toBe(two.variant.directive);
    expect(one.composition.forced_style_mix).toBeUndefined();
  });

  it('makes handheld a hard requirement that cannot be escaped by free composition or fallback', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'auto',
      variantIndex: 1,
      variantTotal: 1,
    }));

    expect(spec.handheld.mode).toBe('handheld');
    expect(spec.handheld.required).toBe(true);
    expect(spec.handheld.fallback).toBeUndefined();
    expect(spec.composition.hand_required).toBe(true);
    expect(spec.composition.allowed_approaches).toEqual(expect.arrayContaining([
      expect.stringMatching(/handheld/i),
    ]));
    expect(spec.composition.allowed_approaches.join(' ')).not.toMatch(/lifestyle placement|free-standing|product on table alone/i);
    expect(spec.composition.forbidden_approaches).toEqual(expect.arrayContaining([
      expect.stringMatching(/no hand|free-standing|table-top product only/i),
    ]));
    expect(spec.quality_targets).toEqual(expect.arrayContaining([
      expect.stringMatching(/hand must appear|must be held by a real hand/i),
    ]));
    expect(spec.negative_prompt).toEqual(expect.arrayContaining([
      expect.stringMatching(/no free-standing product without a hand|no product standing alone/i),
    ]));
    expect(spec.user_overrides.priority).toMatch(/handheld/);
    expect(spec.variant).toBeUndefined();
  });

  it('assembles main-image JSON with hard controls before free visual fields and omits conflicting defaults', () => {
    const text = buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productHandheldMode: 'handheld',
      productEffectMode: 'auto',
      variantIndex: 1,
      variantTotal: 3,
      aspectRatio: '1:1',
    });
    const spec = parseProductSetJsonPrompt(text);
    const keys = Object.keys(spec);

    expect(keys.indexOf('sku_lock')).toBeLessThan(keys.indexOf('handheld'));
    expect(keys.indexOf('handheld')).toBeLessThan(keys.indexOf('composition'));
    expect(keys.indexOf('composition')).toBeLessThan(keys.indexOf('lighting'));
    expect(keys.indexOf('lighting')).toBeLessThan(keys.indexOf('variant'));
    expect(spec.spray_physics).toBeUndefined();
    expect(String(spec.effect.guidance)).toMatch(/only if the SKU truly has/i);
    expect(spec.lighting.key.position).toMatch(/Front-side|Side|Back|Top/i);
    expect(spec.camera.lens.focal_length_mm).toMatch(/^\d+$/);
    expect(spec.camera.exposure.iso).toMatch(/^\d+$/);
    expect(spec.user_overrides).not.toHaveProperty('scene');
    expect(spec.user_overrides).not.toHaveProperty('supplement');
    expect(spec.user_overrides).not.toHaveProperty('avoid');
    expect(spec.user_overrides.priority).toMatch(/variant/);
  });

  it('includes spray_physics only when effect mode is show', () => {
    const autoSpec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productEffectMode: 'auto',
    }));
    const showSpec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productEffectMode: 'show',
    }));
    const hideSpec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      productEffectMode: 'hide',
    }));

    expect(autoSpec.spray_physics).toBeUndefined();
    expect(hideSpec.spray_physics).toBeUndefined();
    expect(showSpec.spray_physics.spray_origin).toMatch(/nozzle/i);
  });

  it('varies concrete lighting and camera by variant index', () => {
    const one = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      variantIndex: 1,
      variantTotal: 3,
    }));
    const two = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      variantIndex: 2,
      variantTotal: 3,
    }));

    expect(one.lighting).not.toEqual(two.lighting);
    expect(one.camera).not.toEqual(two.camera);
    expect(one.lighting.white_balance_k).not.toBe(two.lighting.white_balance_k);
  });

  it('builds comparison JSON with enlarged foreground product when showProduct is true', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_comparison_image',
      comparisonLayout: 'horizontal',
      comparisonIntensity: 'heavy',
      showProduct: true,
      scenePrompt: 'stained bathroom tile',
      variantIndex: 2,
      variantTotal: 3,
    }));

    expect(spec.task).toBe('product_comparison_image');
    expect(spec.composition.type).toBe('single_scene_before_after');
    expect(spec.composition.layout).toBe('horizontal');
    expect(spec.copy.allowed_labels).toEqual(['BEFORE', 'AFTER']);
    expect(spec.copy.forbidden).toEqual(expect.arrayContaining([
      expect.stringMatching(/benefit|selling|icon/i),
    ]));
    expect(spec.panels.sku_inside_panels).toBe(false);
    expect(spec.product_overlay.enabled).toBe(true);
    expect(spec.product_overlay.scale).toMatch(/larger|hero|enlarged/i);
    expect(spec.product_overlay.instances).toBe(1);
    expect(spec.intensity).toBe('heavy');
    expect(spec.user_overrides.scene).toBe('stained bathroom tile');
  });

  it('disables product overlay when comparison showProduct is false', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_comparison_image',
      showProduct: false,
      comparisonLayout: 'vertical',
    }));

    expect(spec.product_overlay.enabled).toBe(false);
    expect(spec.panels.sku_inside_panels).toBe(false);
  });

  it('builds multi-scene JSON that forbids SKU and people', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_multi_scene',
      multiSceneLayout: 'grid',
      prompt: 'kitchen and bathroom surfaces',
      negativePrompt: 'marketing text',
      variantIndex: 1,
      variantTotal: 2,
    }));

    expect(spec.task).toBe('product_multi_scene');
    expect(spec.composition.layout).toBe('grid');
    expect(spec.composition.sku_in_frame).toBe(false);
    expect(spec.composition.people_allowed).toBe(false);
    expect(spec.negative_prompt).toEqual(expect.arrayContaining([
      expect.stringMatching(/SKU|product packaging|branded bottle/i),
      expect.stringMatching(/people|hands|handheld/i),
    ]));
    expect(spec.user_overrides.supplement).toBe('kitchen and bathroom surfaces');
    expect(spec.user_overrides.avoid).toBe('marketing text');
  });

  it('omits empty user override fields', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      prompt: '  ',
      negativePrompt: '',
      scenePrompt: '   ',
    }));

    expect(spec.user_overrides).not.toHaveProperty('scene');
    expect(spec.user_overrides).not.toHaveProperty('supplement');
    expect(spec.user_overrides).not.toHaveProperty('avoid');
    expect(spec.user_overrides.priority).toEqual(expect.any(String));
  });

  it('marks later cycles when variantIndex exceeds three directions', () => {
    const spec = parseProductSetJsonPrompt(buildProductSetJsonPrompt({
      feature: 'product_main_image',
      variantIndex: 4,
      variantTotal: 6,
    }));

    expect(spec.variant.index).toBe(4);
    expect(spec.variant.total).toBe(6);
    expect(spec.variant.cycle).toBe(2);
    expect(spec.variant.directive).toMatch(/cycle|round|previously unused/i);
  });
});
