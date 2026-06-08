import { describe, expect, it } from 'vitest';
import {
  getImageFeatureDefinition,
  getExecutionImageRoles,
  validateImageTaskRequest,
} from '../imageFeatureApi';

describe('image feature API contract', () => {
  it('routes prompt-only main asset as generation without second-stage image inputs', () => {
    const definition = getImageFeatureDefinition('prompt_only_main_asset');

    expect(definition.executionModel).toBe('generation');
    expect(getExecutionImageRoles({
      feature: 'prompt_only_main_asset',
      prompt: 'Create a pink laundry cleaning sheet ad asset',
      images: [
        { role: 'reference', path: '/authorized/input/style.png' },
        { role: 'style', path: '/authorized/input/light.png' },
      ],
    })).toEqual([]);
  });

  it('accepts replace logo only when source and logo images are present', () => {
    const request = validateImageTaskRequest({
      feature: 'replace_logo',
      images: [
        { role: 'source', path: '/authorized/input/original.png' },
        { role: 'logo', path: '/authorized/input/logo.png' },
      ],
      regions: [
        {
          id: 'logo',
          imageRole: 'source',
          x: 10,
          y: 20,
          width: 100,
          height: 50,
        },
      ],
    });

    expect(request.feature).toBe('replace_logo');
  });

  it('rejects image roles outside the feature contract', () => {
    expect(() => validateImageTaskRequest({
      feature: 'replace_logo',
      images: [
        { role: 'source', path: '/authorized/input/original.png' },
        { role: 'product', path: '/authorized/input/product.png' },
      ],
    })).toThrow('replace_logo does not accept image role product');
  });

  it('rejects invalid counts and negative region dimensions before queuing', () => {
    expect(() => validateImageTaskRequest({
      feature: 'remove_product',
      count: 0,
      images: [{ role: 'source', path: '/authorized/input/scene.png' }],
    })).toThrow('count must be a positive integer');

    expect(() => validateImageTaskRequest({
      feature: 'remove_product',
      images: [{ role: 'source', path: '/authorized/input/scene.png' }],
      regions: [
        {
          id: 'bad-region',
          x: 0,
          y: 0,
          width: -1,
          height: 20,
        },
      ],
    })).toThrow('region bad-region width must be a non-negative number');
  });

  it('routes sticker replica logo images to execution as logo role', () => {
    const roles = getExecutionImageRoles({
      feature: 'sticker_replica',
      images: [
        { role: 'source', path: '/authorized/input/package.png' },
        { role: 'logo', path: '/authorized/input/logo.png' },
      ],
    });

    expect(roles).toEqual(['source', 'logo']);
  });

  it('defines remove-product as a local in-place edit', () => {
    const definition = getImageFeatureDefinition('remove_product');

    expect(definition.mainPrompt).toContain('喷雾/雾气');
    expect(definition.mainPrompt).toContain('表面状态');
    expect(definition.mainPrompt).toContain('不顺带清洁');
  });
});
