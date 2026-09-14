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

    expect(systemPrompt).toContain('Image 1 = new SKU product photo only');
    expect(systemPrompt).toContain('Image 2 = viral main-image reference');
    expect(systemPrompt).toContain('Do not swap them');
    expect(systemPrompt).toContain('Image 2 reference image controls the advertised use case');
    expect(systemPrompt).toContain('Image 1 controls SKU appearance and product understanding');
    expect(systemPrompt).toContain('Never invent Chinese slogans');
    expect(systemPrompt).toContain('Never borrow, merge, or transplant');
    expect(systemPrompt).toContain('same cropped surface');
    expect(systemPrompt).toContain('Every plan must include one simple Before/After');
    expect(systemPrompt).not.toContain('Headlines must match Image 2 product category');
    expect(systemPrompt).not.toContain('exactly one Image 2 SKU instance');
    expect(systemPrompt).toContain('inherit Image 2 selling points and the same visible cropped surface');
    expect(systemPrompt).toContain('action + target + modification detail + scope/position limit');
    expect(systemPrompt).toContain('Never plan a handheld bottle');
    expect(systemPrompt).toContain('Do not copy the Image 2 holding hand');
    expect(systemPrompt).toContain('If structured_parameters.headline is present');
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

    expect(prompt).not.toContain('USAGE SCENE POLICY:');
    expect(prompt).not.toContain('IMAGE ROLES:');
    expect(prompt).toContain(planned);
    expect(prompt).toContain('Never add a standalone brand logo');
    expect(prompt).toContain('Do not copy Image 2 composition');
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
    expect(repaired.instructions[0]?.prompt).toContain('Composite Image 1 SKU as a floating graphic cutout');
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
