import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveImportBatch } from './importStorage';

let tmpDir: string;

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('importStorage', () => {
  it('saves import batch files to disk and returns metadata', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-import-'));
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

    const result = saveImportBatch(tmpDir, {
      page: 'home',
      feature: 'sticker',
      files: [{ name: 'test.png', type: 'image/png', buffer }],
    });

    expect(result.page).toBe('home');
    expect(result.feature).toBe('sticker');
    expect(result.images).toHaveLength(1);
    expect(result.images[0].fileName).toBe('test.png');
    expect(result.images[0].mimeType).toBe('image/png');
    expect(result.images[0].fileSize).toBe(4);
    expect(fs.existsSync(result.images[0].filePath)).toBe(true);
  });

  it('creates nested directory structure', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-import-'));
    const buffer = new Uint8Array([0x01]).buffer;

    const result = saveImportBatch(tmpDir, {
      page: 'settings',
      feature: 'theme',
      files: [{ name: 'icon.svg', type: 'image/svg+xml', buffer }],
    });

    const filePath = result.images[0].filePath;
    expect(filePath).toContain(path.join('settings', 'theme'));
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
