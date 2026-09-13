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
    expect(spec.usage_scene_policy.join(' ')).toContain('Image 2 reference');
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
    const prompt = renderSkuHitMainExecutionPrompt(spec, 'Place the jar large in the foreground with a rebuilt wall repair scene.');

    expect(prompt).toContain('USAGE SCENE POLICY:');
    expect(prompt).toContain('MAIN IMAGE DESIGN PLAN:');
    expect(prompt).toContain('Place the jar large in the foreground with a rebuilt wall repair scene.');
    expect(prompt).toContain('Brand: "wkau"');
    expect(prompt).toContain('PHYSICS REALISM:');
    expect(prompt).toContain('floating scrapers');
    expect(prompt).toContain('FINAL CHECK:');
    expect(prompt).toContain('Physics realism and packaging lock override');
  });

  it('includes physics realism rules', () => {
    const spec = buildSkuHitMainConstraintSpec({
      feature: 'sku_hit_main_image',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    });

    expect(spec.physics_realism.join(' ')).toContain('floating scrapers');
    expect(spec.product_replacement.join(' ')).toContain('one primary Image 1 SKU');
    expect(spec.product_replacement.join(' ')).toContain('secondary product display');
    expect(spec.forbidden.join(' ')).not.toContain('Never duplicate the same SKU');
    expect(spec.final_check.join(' ')).not.toContain('exactly one Image 2 SKU instance');
    expect(spec.copy_overrides.join(' ')).not.toContain('rewrite the headline into natural English aligned with Image 2');
    expect(spec.copy_overrides.join(' ')).toContain('marketing wording actually visible in Image 2');
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
    expect(spec.copy_overrides.join(' ')).toContain('do not invent, translate, or promote Image 1 SKU label copy');
    expect(spec.usage_scene_policy.join(' ')).toContain('same localized area');
  });
});
