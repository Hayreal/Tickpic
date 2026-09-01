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
  it('plans English hit-main prompts with reference as image 1', () => {
    const systemPrompt = buildSkuHitMainVisionSystemPrompt();
    const userText = buildSkuHitMainVisionUserText(baseRequest, +2);
    const parts = buildHitMainVisionImageParts(baseRequest.images);

    expect(systemPrompt).toContain('Image 1 = viral main-image reference');
    expect(systemPrompt).toContain('exactly one Image 2 SKU instance');
    expect(systemPrompt).toContain('inherit Image 1 selling points, never inherit Image 1 layout');
    expect(userText).toContain('"requested_count": 2');
    expect(userText).toContain('"batch_diversity_plan"');
    expect(parts[0]?.caption).toContain('Image 1');
    expect(parts[1]?.caption).toContain('Image 2');
    expect(parts[0]?.image.role).toBe('reference');
    expect(parts[1]?.image.role).toBe('source');
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

  it('parses one instruction batch and rejects Chinese execution text', () => {
    const batch = parseSkuHitMainVisionBatch(JSON.stringify({
      instructions: [
        { index: 1, prompt: 'Rebuild the scene with a new diagonal layout and larger SKU exposure.' },
      ],
    }), 1);

    expect(batch.instructions).toHaveLength(1);

    expect(() => parseSkuHitMainVisionBatch(
      '{"instructions":[{"index":1,"prompt":"只改主图"}]}',
      1,
    )).toThrow('English-only');
  });
});
