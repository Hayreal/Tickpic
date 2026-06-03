import * as fs from "node:fs";
import * as path from "node:path";

export type ImageDimensions = {
  width: number;
  height: number;
};

export function readImageAsDataUrl(inputPath: string): string {
  const resolvedInputPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInputPath)) {
    throw new Error(`找不到输入图像: ${resolvedInputPath}`);
  }

  const imageData = fs.readFileSync(resolvedInputPath);
  const extension = path.extname(resolvedInputPath).toLowerCase();
  const mimeType = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";

  return `data:${mimeType};base64,${imageData.toString("base64")}`;
}

export function readPngDimensions(buffer: Buffer): ImageDimensions | null {
  if (
    buffer.length < 24 ||
    buffer.readUInt32BE(0) !== 0x89504e47 ||
    buffer.readUInt32BE(4) !== 0x0d0a1a0a
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}
