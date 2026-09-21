import { describe, expect, it } from 'vitest';
import {
  buildSkuHitMainConstraintSpec,
  renderSkuHitMainExecutionPrompt,
} from '../skuHitMainConstraintSpec';

describe('skuHitMainConstraintSpec', () => {
  it('keeps the reference image authoritative for the advertised scene', () => {
    const spec = buildSkuHitMainConstraintSpec({
      feature: 'sku_hit_main_image',
      brand: 'wkau',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    });

    expect(spec.authority_policy.join(' ')).toContain('Image 2 reference image controls');
    expect(spec.authority_policy.join(' ')).toContain('target object');
    expect(spec.usage_scene_policy.join(' ')).toContain('visible cropped surface');
    expect(spec.must_preserve.join(' ')).toContain('visible surface as a crop');
    expect(spec.usage_scene_policy.join(' ')).not.toContain('Image 1 SKU product category');
  });

  it('renders fallback execution prompt with design plan section', () => {
    const spec = buildSkuHitMainConstraintSpec({
      feature: 'sku_hit_main_image',
      brand: 'wkau',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    });
    const prompt = renderSkuHitMainExecutionPrompt(spec, 'Overlay Image 1 SKU as a foreground layer onto a rebuilt wall repair scene; keep Image 1 packaging pixel-identical without redrawing the bottle; place it in unused foreground space.');

    expect(prompt).not.toContain('USAGE SCENE POLICY:');
    expect(prompt).not.toContain('IMAGE ROLES:');
    expect(prompt).toContain('Overlay Image 1 SKU as a foreground layer');
    expect(prompt).toContain('Never add a standalone brand logo');
    expect(prompt).toContain('apply "wkau" only on the Image 1 cutout label');
    expect(prompt).toContain('without redrawing the bottle');
    expect(prompt).toContain('five complete fingers');
    expect(prompt).toContain('Always show one simple Before/After of the same cropped surface');
  });

  it('includes physics realism rules', () => {
    const spec = buildSkuHitMainConstraintSpec({
      feature: 'sku_hit_main_image',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    });

    expect(spec.physics_realism.join(' ')).toContain('five fingers');
    expect(spec.product_replacement.join(' ')).toContain('floating graphic cutout');
    expect(spec.product_replacement.join(' ')).toContain('do not redraw');
    expect(spec.forbidden.join(' ')).toContain('handheld second bottle');
    expect(spec.show_product).toBe(true);
    expect(spec.final_check.join(' ')).not.toContain('exactly one Image 2 SKU instance');
    expect(spec.copy_overrides.join(' ')).not.toContain('rewrite the headline into natural English aligned with Image 2');
    expect(spec.copy_overrides.join(' ')).toContain('marketing wording actually visible in Image 2');
    expect(spec.copy_overrides.join(' ')).toContain('level horizontal baseline');
    expect(spec.forbidden.join(' ')).toContain('Never tilt, italicize, skew');
  });

  it('locks the SKU dispensing mechanism, source copy, and same-area comparison', () => {
    const spec = buildSkuHitMainConstraintSpec({
      feature: 'sku_hit_main_image',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    });

    expect(spec.product_replacement.join(' ')).toContain('exact type and geometry from Image 1');
    expect(spec.product_replacement.join(' ')).toContain('Never borrow, merge, transplant, or retain any product part');
    expect(spec.copy_overrides.join(' ')).toContain('only marketing wording actually visible in Image 2');
    expect(spec.copy_overrides.join(' ')).toContain('do not invent or promote Image 1 SKU label copy');
    expect(spec.usage_scene_policy.join(' ')).toContain('same cropped surface');
  });
});
