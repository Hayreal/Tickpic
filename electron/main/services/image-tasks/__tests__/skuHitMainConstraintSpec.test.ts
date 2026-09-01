import { describe, expect, it } from 'vitest';
import {
  buildSkuHitMainConstraintSpec,
  renderSkuHitMainExecutionPrompt,
} from '../skuHitMainConstraintSpec';

describe('skuHitMainConstraintSpec', () => {
  it('requires usage scene to follow image 2 product category', () => {
    const spec = buildSkuHitMainConstraintSpec({
      feature: 'sku_hit_main_image',
      brand: 'wkau',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    });

    expect(spec.usage_scene_policy.join(' ')).toContain('Image 2 SKU product category');
    expect(spec.usage_scene_policy.join(' ')).toContain('WALL REPAIR PUTTY');
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
    expect(spec.product_replacement.join(' ')).toContain('exactly one Image 2 SKU instance');
    expect(spec.forbidden.join(' ')).toContain('Never duplicate the same SKU');
    expect(spec.final_check.join(' ')).toContain('exactly one Image 2 SKU instance');
    expect(spec.copy_overrides.join(' ')).toContain('rewrite the headline into natural English aligned with Image 2');
  });
});
