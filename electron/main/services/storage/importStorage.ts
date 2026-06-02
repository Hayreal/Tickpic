import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export interface SavedImportImage {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface ImportBatchResult {
  batchId: string;
  page: string;
  feature: string;
  images: SavedImportImage[];
  createdAt: string;
}

export function saveImportBatch(
  importsDir: string,
  payload: {
    page: string;
    feature: string;
    files: { name: string; type: string; buffer: ArrayBuffer }[];
  },
): ImportBatchResult {
  const batchId = randomUUID();
  const batchDir = path.join(importsDir, payload.page, payload.feature, batchId);
  ensureDir(batchDir);

  const images = payload.files.map((file) => {
    const filePath = path.join(batchDir, file.name);
    fs.writeFileSync(filePath, Buffer.from(file.buffer));
    return {
      id: randomUUID(),
      fileName: file.name,
      filePath,
      fileSize: Buffer.from(file.buffer).byteLength,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
    };
  });

  return {
    batchId,
    page: payload.page,
    feature: payload.feature,
    images,
    createdAt: new Date().toISOString(),
  };
}
