import { describe, expect, it } from 'vitest';
import { buildSkuHitMainConstraintSpec } from '../skuHitMainConstraintSpec';
import { validateAssembledPrompt } from '../skuPromptAssembler';
import {
  buildHitMainVisionImageParts,
  buildSkuHitMainVisionSystemPrompt,
  buildSkuHitMainVisionUserText,
  finalizeSkuHitMainVisionInstruction,
  parseSkuHitMainVisionBatch,
} from '../skuHitMainVisionPrompt';

const baseRequest = {
  feature: 'sku_hit_main_image' as const,
  images: [
    { role: 'source' as const, path: '/authorized/input/sku.png' },
    { role: 'reference' as const, path: '/authorized/input/hit-main.png' },
  ],
};

describe('skuHitMainVisionPrompt', () => {
  it('plans English hit-main prompts in page upload order', () => {
    const systemPrompt = buildSkuHitMainVisionSystemPrompt();
    const userText = buildSkuHitMainVisionUserText(baseRequest, +2);
    const parts = buildHitMainVisionImageParts(baseRequest.images);

    expect(systemPrompt).toContain('Image 1 = new SKU product image');
    expect(systemPrompt).toContain('Image 2 = viral main-image reference');
    expect(systemPrompt).toContain('Image 2 reference image controls the advertised use case');
    expect(systemPrompt).toContain('Image 1 controls only the exact SKU product identity');
    expect(systemPrompt).toContain('original language');
    expect(systemPrompt).toContain('Never borrow, merge, or transplant');
    expect(systemPrompt).toContain('same localized area');
    expect(systemPrompt).not.toContain('Headlines must match Image 2 product category');
    expect(systemPrompt).not.toContain('exactly one Image 2 SKU instance');
    expect(systemPrompt).toContain('inherit Image 2 selling points, never inherit Image 2 layout');
    expect(userText).toContain('"requested_count": 2');
    expect(userText).toContain('"batch_diversity_plan"');
    expect(parts[0]?.caption).toContain('Image 1');
    expect(parts[1]?.caption).toContain('Image 2');
    expect(parts[0]?.image.role).toBe('source');
    expect(parts[1]?.image.role).toBe('reference');
  });

  it('renders fallback execution prompt with design plan section', () => {
    const planned = 'Place the jar large in the foreground with a rebuilt wall repair scene.';
    const prompt = finalizeSkuHitMainVisionInstruction({
      feature: 'sku_hit_main_image',
      brand: 'wkau',
      images: [
        { role: 'source', path: '/authorized/input/sku.png' },
        { role: 'reference', path: '/authorized/input/hit-main.png' },
      ],
    }, planned);

    expect(prompt).toContain('USAGE SCENE POLICY:');
    expect(prompt).toContain('MAIN IMAGE DESIGN PLAN:');
    expect(prompt).toContain(planned);
    expect(prompt).toContain('Brand: "wkau"');
  });

  it('parses one instruction batch and repairs Chinese execution text', () => {
    const batch = parseSkuHitMainVisionBatch(JSON.stringify({
      instructions: [
        { index: 1, prompt: 'Rebuild the scene with a new diagonal layout and larger SKU exposure.' },
      ],
    }), 1);

    expect(batch.instructions).toHaveLength(1);

    const repaired = parseSkuHitMainVisionBatch(
      '{"instructions":[{"index":1,"prompt":"只改主图"}]}',
      1,
    );
    expect(repaired.instructions[0]?.prompt).toContain('English-only main-image design plan');
    expect(repaired.instructions[0]?.prompt).not.toMatch(/\p{Script=Han}/u);
  });

  it('keeps quoted non-English reference copy instead of dropping it', () => {
    const batch = parseSkuHitMainVisionBatch(JSON.stringify({
      instructions: [
        { index: 1, prompt: 'Preserve the Image 2 reference copy "喷一喷 / 冰雪融化" exactly while rebuilding the scene.' },
      ],
    }), 1);

    expect(batch.instructions[0]?.prompt).toContain('喷一喷 / 冰雪融化');
  });
});
