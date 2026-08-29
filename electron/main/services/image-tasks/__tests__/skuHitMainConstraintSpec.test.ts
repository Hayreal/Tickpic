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
    expect(prompt).toContain('FORBIDDEN:');
    expect(prompt).toContain('3-icon feature rows');
  });

  it('includes anti-AI-template forbidden rules', () => {
    const spec = buildSkuHitMainConstraintSpec({
      feature: 'sku_hit_main_image',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    });

    const forbidden = spec.forbidden.join(' ');
    expect(forbidden).toContain('hexagonal or circular icon badges');
    expect(forbidden).toContain('3-icon feature rows');
  });
});
