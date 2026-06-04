import { describe, expect, it } from 'vitest';
import { buildImageInstructionSystemPrompt } from '../imageInstructionPrompts';

describe('imageInstructionPrompts', () => {
  it('combines the generic instruction generator prompt with feature boundaries', () => {
    const prompt = buildImageInstructionSystemPrompt('replace_logo');

    expect(prompt).toContain('Your task is not to generate images.');
    expect(prompt).toContain('You are performing the "Replace Logo" task.');
    expect(prompt).toContain('Replace only the obvious brand mark or logo.');
  });

  it('preserves prompt-only feature restriction for second-stage image input', () => {
    const prompt = buildImageInstructionSystemPrompt('prompt_only_main_asset');

    expect(prompt).toContain('You are performing the "Prompt-Only Main Image / Asset Generation" task.');
    expect(prompt).toContain('Do not require those images to be passed to the downstream image model.');
  });
});
