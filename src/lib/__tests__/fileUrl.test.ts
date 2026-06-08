import { describe, expect, it } from 'vitest';
import { resolveLocalFilePath, toDisplaySrc } from '../fileUrl';

describe('toDisplaySrc', () => {
  it('keeps browser-safe urls unchanged', () => {
    expect(toDisplaySrc('blob:http://localhost/image')).toBe('blob:http://localhost/image');
    expect(toDisplaySrc('https://example.com/image.png')).toBe('https://example.com/image.png');
  });

  it('encodes local mac paths with the desktop local image protocol', () => {
    const url = toDisplaySrc('/Users/lixin/Tickpic imports/贴纸复刻/img 2.png');

    expect(url).toBe('tickpic-file://image/%2FUsers%2Flixin%2FTickpic%20imports%2F%E8%B4%B4%E7%BA%B8%E5%A4%8D%E5%88%BB%2Fimg%202.png');
  });
});

describe('resolveLocalFilePath', () => {
  it('returns null for browser-only urls', () => {
    expect(resolveLocalFilePath('blob:http://localhost/image')).toBeNull();
    expect(resolveLocalFilePath('https://example.com/image.png')).toBeNull();
  });

  it('decodes tickpic-file and file urls', () => {
    expect(resolveLocalFilePath('tickpic-file://image/%2Ftmp%2Fa.png')).toBe('/tmp/a.png');
    expect(resolveLocalFilePath('file:///tmp/a.png')).toBe('/tmp/a.png');
    expect(resolveLocalFilePath('/tmp/a.png')).toBe('/tmp/a.png');
  });
});
