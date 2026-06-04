import { describe, expect, it } from 'vitest';
import { normalizeImageAspectRatio } from '../imageAspectRatio';

describe('imageAspectRatio', () => {
  it('normalizes square ratios to square OpenAI size', () => {
    expect(normalizeImageAspectRatio('1:1')).toEqual({
      aspectRatio: '1:1',
      orientation: 'square',
      openaiSize: '1024x1024',
    });
  });

  it('normalizes landscape and portrait ratios to supported execution sizes', () => {
    expect(normalizeImageAspectRatio('16:9')).toEqual({
      aspectRatio: '16:9',
      orientation: 'landscape',
      openaiSize: '1536x1024',
    });
    expect(normalizeImageAspectRatio('9:16')).toEqual({
      aspectRatio: '9:16',
      orientation: 'portrait',
      openaiSize: '1024x1536',
    });
  });

  it('rejects invalid ratio strings', () => {
    expect(() => normalizeImageAspectRatio('wide')).toThrow('aspectRatio must be in "width:height" format');
    expect(() => normalizeImageAspectRatio('1:0')).toThrow('aspectRatio values must be greater than zero');
  });
});
