import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveTaskOutputs } from './outputStorage';

let tmpDir: string;

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('outputStorage', () => {
  it('saves task output files and returns metadata', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-output-'));
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

    const results = saveTaskOutputs(tmpDir, {
      taskId: 'task-123',
      page: 'home',
      feature: 'sticker',
      outputs: [{ name: 'result.png', buffer }],
    });

    expect(results).toHaveLength(1);
    expect(results[0].fileName).toBe('result.png');
    expect(results[0].mimeType).toBe('image/png');
    expect(results[0].fileSize).toBe(4);
    expect(fs.existsSync(results[0].filePath)).toBe(true);
  });

  it('groups outputs under page/feature/taskId', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tickpic-output-'));
    const buffer = new Uint8Array([0x01]).buffer;

    const results = saveTaskOutputs(tmpDir, {
      taskId: 'task-abc',
      page: 'gallery',
      feature: 'banner',
      outputs: [{ name: 'out.png', buffer }],
    });

    const filePath = results[0].filePath;
    expect(filePath).toContain(path.join('gallery', 'banner', 'task-abc'));
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
