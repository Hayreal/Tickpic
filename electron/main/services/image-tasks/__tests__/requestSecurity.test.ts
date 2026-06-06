import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateImageTaskRequestForMain } from '../requestSecurity';

const ONE_BY_ONE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY5UAAAAASUVORK5CYII=',
  'base64',
);

describe('requestSecurity', () => {
  let tempDir: string;
  let importsDir: string;
  let workspaceDir: string;
  let allowedImagePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'tickpic-request-security-'));
    importsDir = path.join(tempDir, 'imports');
    workspaceDir = path.join(tempDir, 'workspace');
    await writeFile(path.join(tempDir, 'placeholder'), '');
    await writeFile(path.join(tempDir, 'outside.png'), ONE_BY_ONE_PNG);

    await fsMkdirp(path.dirname(path.join(importsDir, 'sticker', 'feature', 'batch', 'input.png')));
    await fsMkdirp(workspaceDir);
    allowedImagePath = path.join(importsDir, 'sticker', 'feature', 'batch', 'input.png');
    await writeFile(allowedImagePath, ONE_BY_ONE_PNG);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('accepts images under authorized roots with in-bounds regions', async () => {
    await expect(validateImageTaskRequestForMain({
      request: {
        feature: 'remove_product',
        images: [{ role: 'source', path: allowedImagePath, mimeType: 'image/png' }],
        regions: [{ id: 'r1', imageRole: 'source', x: 0, y: 0, width: 1, height: 1 }],
      },
      authorizedRoots: [importsDir, workspaceDir],
    })).resolves.toBeUndefined();
  });

  it('rejects images outside authorized roots', async () => {
    await expect(validateImageTaskRequestForMain({
      request: {
        feature: 'remove_product',
        images: [{ role: 'source', path: path.join(tempDir, 'outside.png'), mimeType: 'image/png' }],
      },
      authorizedRoots: [importsDir, workspaceDir],
    })).rejects.toThrow('image path is outside authorized roots');
  });

  it('rejects missing image files', async () => {
    await expect(validateImageTaskRequestForMain({
      request: {
        feature: 'remove_product',
        images: [{ role: 'source', path: path.join(importsDir, 'missing.png'), mimeType: 'image/png' }],
      },
      authorizedRoots: [importsDir, workspaceDir],
    })).rejects.toThrow('image file does not exist');
  });

  it('rejects regions that reference a missing image role', async () => {
    await expect(validateImageTaskRequestForMain({
      request: {
        feature: 'remove_product',
        images: [{ role: 'source', path: allowedImagePath, mimeType: 'image/png' }],
        regions: [{ id: 'r1', imageRole: 'product', x: 0, y: 0, width: 1, height: 1 }],
      },
      authorizedRoots: [importsDir, workspaceDir],
    })).rejects.toThrow('region r1 references missing image role product');
  });

  it('rejects regions that exceed image bounds', async () => {
    await expect(validateImageTaskRequestForMain({
      request: {
        feature: 'remove_product',
        images: [{ role: 'source', path: allowedImagePath, mimeType: 'image/png' }],
        regions: [{ id: 'r1', imageRole: 'source', x: 1, y: 0, width: 1, height: 1 }],
      },
      authorizedRoots: [importsDir, workspaceDir],
    })).rejects.toThrow('region r1 exceeds bounds of image role source');
  });

  it('accepts in-bounds regions for jpeg images', async () => {
    const jpegPath = path.join(tempDir, 'sample.jpg');
    const fixturePath = path.join(process.cwd(), 'docs/docx_extract/contact_sheet.jpg');
    await writeFile(jpegPath, await readFile(fixturePath));

    await expect(validateImageTaskRequestForMain({
      request: {
        feature: 'remove_product',
        images: [{ role: 'source', path: jpegPath, mimeType: 'image/jpeg' }],
        regions: [{ id: 'r1', imageRole: 'source', x: 0, y: 0, width: 1, height: 1 }],
      },
      authorizedRoots: [tempDir, workspaceDir],
    })).resolves.toBeUndefined();
  });
});

async function fsMkdirp(dir: string) {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(dir, { recursive: true });
}
