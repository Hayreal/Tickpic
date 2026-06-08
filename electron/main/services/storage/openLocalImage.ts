import fs from 'node:fs';
import path from 'node:path';
import { shell } from 'electron';
import { assertPathsUnderAuthorizedRoots } from './pathAuthorization.js';

export interface OpenLocalImageInput {
  filePath: string;
}

export interface OpenLocalImageResult {
  opened: true;
}

function normalizeFilePath(filePath: string) {
  if (filePath.startsWith('file://')) {
    return decodeURIComponent(filePath.slice('file://'.length));
  }
  return filePath;
}

export async function openLocalImage(
  input: OpenLocalImageInput,
  authorizedRoots: string[],
): Promise<OpenLocalImageResult> {
  if (typeof input.filePath !== 'string' || input.filePath.trim().length === 0) {
    throw new Error('图片路径不能为空');
  }

  const filePath = path.resolve(normalizeFilePath(input.filePath));
  assertPathsUnderAuthorizedRoots([filePath], authorizedRoots);

  if (!fs.existsSync(filePath)) {
    throw new Error(`图片不存在: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error('路径不是图片文件');
  }

  const errorMessage = await shell.openPath(filePath);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return { opened: true };
}
