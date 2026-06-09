import { describe, expect, it } from 'vitest';
import { buildImageInstructionSystemPrompt } from '../imageInstructionPrompts';
import { IMAGE_FEATURES } from '../imageFeatureApi';
import { getImageFeatureDefinition } from '../imageFeatureApi';

describe('imageInstructionPrompts', () => {
  it('combines the compact base prompt with feature boundaries', () => {
    const prompt = buildImageInstructionSystemPrompt('replace_logo');

    expect(prompt).toContain('You write concise English prompts for a downstream image model.');
    expect(prompt).toContain('Feature: Replace Logo.');
    expect(prompt).toContain('Replace only the visible brand logo');
    expect(prompt).toContain('one short imperative sentence');
  });

  it('preserves prompt-only feature restriction for second-stage image input', () => {
    const prompt = buildImageInstructionSystemPrompt('prompt_only_main_asset');

    expect(prompt).toContain('Feature: Prompt-Only Main Image / Asset Generation.');
    expect(prompt).toContain('Use uploaded images only as optional style');
    expect(prompt).toContain('one or two short sentences');
  });

  it('requires each instruction to target one standalone output image', () => {
    const prompt = buildImageInstructionSystemPrompt('sticker_variation');

    expect(prompt).toContain('one standalone output image');
    expect(prompt).toContain('never request grids, collages, batches');
  });

  it('keeps sticker replica focused on extracting the product sticker', () => {
    const prompt = buildImageInstructionSystemPrompt('sticker_replica');

    expect(prompt).toContain('Extract the visible sticker from the source product or package.');
    expect(prompt).toContain('Output only that sticker as one standalone flat 2D label.');
    expect(prompt).toContain('Do not redesign it');
    expect(prompt).not.toContain('similar rectangular layout');
    expect(prompt).not.toContain('commercial style');
  });

  it('requires sticker variation to be a meaningful redesign rather than a near copy', () => {
    const prompt = buildImageInstructionSystemPrompt('sticker_variation');

    expect(prompt).toContain('Create a new flat 2D sticker in the same product-category mood.');
    expect(prompt).toContain('Use the source as mood reference only');
    expect(prompt).toContain('make a clearly different layout');
    expect(prompt).toContain('not a small text, icon, suit, or color swap');
    expect(prompt).not.toContain('substantially rework');
    expect(prompt).not.toContain('near-copy');
  });

  it('keeps original sticker typography proportional instead of oversized', () => {
    const prompt = buildImageInstructionSystemPrompt('sticker_original');

    expect(prompt).toContain('Use balanced typography');
    expect(prompt).toContain('product name can be prominent but must not dominate the whole sticker');
    expect(prompt).toContain('Keep supporting copy smaller and secondary');
    expect(prompt).toContain('Give icons, illustrations, shapes, and color blocks enough visual space');
    expect(prompt).not.toContain('Use sparse visible text');
    expect(prompt).not.toContain('at most one short category or benefit line');
  });

  it('keeps remove-product edits focused on the target product', () => {
    const prompt = buildImageInstructionSystemPrompt('remove_product');

    expect(prompt).toContain('Feature: Remove Product.');
    expect(prompt).toContain('product-emitted spray, mist, droplets');
    expect(prompt).toContain('keep unrelated background');
  });

  it('keeps all feature prompts compact', () => {
    for (const feature of IMAGE_FEATURES) {
      const prompt = buildImageInstructionSystemPrompt(feature);

      expect(prompt.length).toBeLessThan(1600);
      expect(prompt).not.toContain('Follow these rules strictly');
      expect(prompt).not.toContain('Use the structured parameters as input, including feature');
    }
  });

  it('requires concise single-sentence output for all edit features', () => {
    const editFeatures = IMAGE_FEATURES.filter(
      (feature) => getImageFeatureDefinition(feature).executionModel === 'edit',
    );

    for (const feature of editFeatures) {
      const prompt = buildImageInstructionSystemPrompt(feature);
      expect(prompt).toContain('one short imperative sentence');
    }
  });

  it('allows slightly longer output for generation features', () => {
    const generationFeatures = IMAGE_FEATURES.filter(
      (feature) => getImageFeatureDefinition(feature).executionModel === 'generation',
    );

    for (const feature of generationFeatures) {
      const prompt = buildImageInstructionSystemPrompt(feature);
      expect(prompt).toContain('one or two short sentences');
    }
  });
});
