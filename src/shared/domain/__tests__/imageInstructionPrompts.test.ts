import { describe, expect, it } from 'vitest';
import { buildImageInstructionSystemPrompt } from '../imageInstructionPrompts';
import { IMAGE_FEATURES } from '../imageFeatureApi';
import { getImageFeatureDefinition } from '../imageFeatureApi';

describe('imageInstructionPrompts', () => {
  it('combines the generic instruction generator prompt with feature boundaries', () => {
    const prompt = buildImageInstructionSystemPrompt('replace_logo');

    expect(prompt).toContain('Your task is not to generate images.');
    expect(prompt).toContain('You are performing the "Replace Logo" task.');
    expect(prompt).toContain('logo swap only');
    expect(prompt).toContain('under 35 words');
  });

  it('preserves prompt-only feature restriction for second-stage image input', () => {
    const prompt = buildImageInstructionSystemPrompt('prompt_only_main_asset');

    expect(prompt).toContain('You are performing the "Prompt-Only Main Image / Asset Generation" task.');
    expect(prompt).toContain('Do not require those images to be passed to the downstream image model.');
    expect(prompt).toContain('under 60 words total');
  });

  it('requires each instruction to target one standalone output image', () => {
    const prompt = buildImageInstructionSystemPrompt('sticker_variation');

    expect(prompt).toContain('ONE standalone output image');
    expect(prompt).toContain('Never describe a grid, contact sheet, collage');
  });

  it('keeps sticker replica focused on source layout and optional logo image', () => {
    const prompt = buildImageInstructionSystemPrompt('sticker_replica');

    expect(prompt).toContain('Edit the source packaging or sticker image');
    expect(prompt).toContain('do not use create, generate, or design');
    expect(prompt).toContain('do not treat the logo image as the layout reference');
    expect(prompt).toContain('rectangular label layout');
    expect(prompt).not.toContain('Replicate the reference sticker');
  });

  it('keeps remove-product edits focused on the target product', () => {
    const prompt = buildImageInstructionSystemPrompt('remove_product');

    expect(prompt).toContain('under 35 words');
    expect(prompt).toContain('foreground spray/mist overlays');
    expect(prompt).toContain('not only behind the product');
    expect(prompt).toContain('Do not stack repeated negatives');
    expect(prompt).not.toContain('strict local inpainting');
  });

  it('requires concise single-sentence output for all edit features', () => {
    const editFeatures = IMAGE_FEATURES.filter(
      (feature) => getImageFeatureDefinition(feature).executionModel === 'edit',
    );

    for (const feature of editFeatures) {
      const prompt = buildImageInstructionSystemPrompt(feature);
      expect(prompt).toContain('under 35 words');
      expect(prompt).toContain('Do not stack repeated negatives');
    }
  });

  it('allows slightly longer output for generation features', () => {
    const generationFeatures = IMAGE_FEATURES.filter(
      (feature) => getImageFeatureDefinition(feature).executionModel === 'generation',
    );

    for (const feature of generationFeatures) {
      const prompt = buildImageInstructionSystemPrompt(feature);
      expect(prompt).toContain('under 60 words total');
    }
  });
});
