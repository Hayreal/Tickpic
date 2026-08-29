import { describe, expect, it } from 'vitest';
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
    expect(systemPrompt).toContain('inherit Image 1 selling points, never inherit Image 1 layout');
    expect(userText).toContain('"requested_count": 2');
    expect(userText).toContain('"batch_diversity_plan"');
    expect(parts[0]?.caption).toContain('Image 1');
    expect(parts[1]?.caption).toContain('Image 2');
    expect(parts[0]?.image.role).toBe('reference');
    expect(parts[1]?.image.role).toBe('source');
  });

  it('passes vision execution prompts through unchanged', () => {
    const planned = 'Place the SKU on the right with a rebuilt before/after radiator scene.';
    const prompt = finalizeSkuHitMainVisionInstruction(baseRequest, planned);

    expect(prompt).toBe(planned);
    expect(prompt).not.toContain('IMAGE ROLES:');
    expect(prompt).not.toContain('MAIN IMAGE DESIGN PLAN:');
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
