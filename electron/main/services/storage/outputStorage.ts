import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export interface SavedOutputImage {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export function saveTaskOutputs(
  outputsDir: string,
  payload: {
    taskId: string;
    page: string;
    feature: string;
    outputs: { name: string; buffer: ArrayBuffer }[];
  },
): SavedOutputImage[] {
  const outputDir = path.join(outputsDir, payload.page, payload.feature, payload.taskId);
  ensureDir(outputDir);

  return payload.outputs.map((file) => {
    const filePath = path.join(outputDir, file.name);
    fs.writeFileSync(filePath, Buffer.from(file.buffer));
    return {
      id: randomUUID(),
      fileName: file.name,
      filePath,
      fileSize: Buffer.from(file.buffer).byteLength,
      mimeType: 'image/png',
      createdAt: new Date().toISOString(),
    };
  });
}
