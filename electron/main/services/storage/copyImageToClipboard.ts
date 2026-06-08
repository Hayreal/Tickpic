import fs from 'node:fs';
import path from 'node:path';
import { clipboard, nativeImage } from 'electron';
import { assertPathsUnderAuthorizedRoots } from './pathAuthorization.js';

export interface CopyImageToClipboardInput {
  filePath: string;
}

export interface CopyImageToClipboardResult {
  copied: true;
}

function normalizeFilePath(filePath: string) {
  if (filePath.startsWith('file://')) {
    return decodeURIComponent(filePath.slice('file://'.length));
  }
  return filePath;
}

export function copyImageToClipboard(
  input: CopyImageToClipboardInput,
  authorizedRoots: string[],
): CopyImageToClipboardResult {
  if (typeof input.filePath !== 'string' || input.filePath.trim().length === 0) {
    throw new Error('图片路径不能为空');
  }

  const filePath = path.resolve(normalizeFilePath(input.filePath));
  assertPathsUnderAuthorizedRoots([filePath], authorizedRoots);

  if (!fs.existsSync(filePath)) {
    throw new Error(`图片不存在: ${filePath}`);
  }

  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) {
    throw new Error('无法读取图片内容');
  }

  clipboard.writeImage(image);
  return { copied: true };
}
