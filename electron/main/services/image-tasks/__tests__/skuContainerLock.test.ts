import { describe, expect, it } from 'vitest';
import {
  buildContainerLockLines,
  normalizeSkuContainerLock,
  parseSkuContainerLock,
  appendSkuContainerLockSuffix,
} from '../skuContainerLock';

describe('skuContainerLock', () => {
  it('parses a low squat paste jar lock', () => {
    const lock = parseSkuContainerLock({
      form: 'jar',
      height_tier: 'low',
      shape_description: 'squat wide-mouth open jar, diameter greater than height, threaded neck without lid, visible black paste with swirled peak',
    });

    expect(lock).toEqual({
      form: 'jar',
      heightTier: 'low',
      shapeDescription: 'squat wide-mouth open jar, diameter greater than height, threaded neck without lid, visible black paste with swirled peak',
    });
  });

  it('requires height_tier for jar form', () => {
    expect(parseSkuContainerLock({
      form: 'jar',
      shape_description: 'open jar',
    })).toBeUndefined();
  });

  it('allows bottle form without height tier', () => {
    expect(parseSkuContainerLock({
      form: 'bottle',
      shape_description: 'tall cylindrical squeeze bottle with flip cap',
    })).toEqual({
      form: 'bottle',
      shapeDescription: 'tall cylindrical squeeze bottle with flip cap',
    });
  });

  it('builds low jar geometry guardrails', () => {
    const lines = buildContainerLockLines({
      form: 'jar',
      heightTier: 'low',
      shapeDescription: 'squat wide-mouth open jar, diameter greater than height',
    });

    expect(lines.join(' ')).toContain('Jar height tier: low');
    expect(lines.join(' ')).toContain('diameter must remain equal to or greater than height');
    expect(lines.join(' ')).toContain('Never elongate a low jar');
  });

  it('forces low tier when shape description says diameter exceeds height', () => {
    expect(normalizeSkuContainerLock({
      form: 'jar',
      heightTier: 'medium',
      shapeDescription: 'open squat wide-mouth jar, diameter greater than body height',
    })).toEqual({
      form: 'jar',
      heightTier: 'low',
      shapeDescription: 'open squat wide-mouth jar, diameter greater than body height',
    });
  });

  it('appends a hard container lock suffix after assembly', () => {
    const prompt = appendSkuContainerLockSuffix('Edit only the label.', {
      form: 'jar',
      heightTier: 'low',
      shapeDescription: 'squat wide-mouth open jar, diameter greater than height',
    });

    expect(prompt).toContain('HARD CONTAINER GEOMETRY LOCK:');
    expect(prompt).toContain('Jar height tier: low');
  });
});
