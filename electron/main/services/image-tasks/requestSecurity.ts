import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageInput, ImageTaskRequest } from '../../../../src/shared/domain/imageFeatureApi.js';

export interface ValidateImageTaskRequestForMainInput {
  request: ImageTaskRequest;
  authorizedRoots: string[];
}

export async function validateImageTaskRequestForMain(
  input: ValidateImageTaskRequestForMainInput,
): Promise<void> {
  const imageByRole = new Map(input.request.images?.map((image) => [image.role, image]) ?? []);

  for (const image of input.request.images ?? []) {
    await validateAuthorizedImagePath(image, input.authorizedRoots);
  }

  for (const region of input.request.regions ?? []) {
    const targetImage = resolveRegionImage(region.imageRole, input.request.images ?? []);
    if (!targetImage) {
      throw new Error(
        `region ${region.id} references missing image role ${region.imageRole ?? '(default)'}`,
      );
    }

    const dimensions = await readImageDimensions(targetImage);
    if (region.x + region.width > dimensions.width || region.y + region.height > dimensions.height) {
      throw new Error(`region ${region.id} exceeds bounds of image role ${targetImage.role}`);
    }
  }
}

async function validateAuthorizedImagePath(image: ImageInput, authorizedRoots: string[]) {
  const resolvedPath = path.resolve(image.path);
  const normalizedRoots = authorizedRoots.map((root) => path.resolve(root));
  const isAuthorized = normalizedRoots.some((root) => (
    resolvedPath === root || resolvedPath.startsWith(`${root}${path.sep}`)
  ));

  if (!isAuthorized) {
    throw new Error('image path is outside authorized roots');
  }

  try {
    await access(resolvedPath);
  } catch {
    throw new Error('image file does not exist');
  }
}

function resolveRegionImage(role: ImageInput['role'] | undefined, images: ImageInput[]) {
  if (role) {
    return images.find((image) => image.role === role);
  }

  return images.find((image) => image.role === 'source') ?? images[0];
}

async function readImageDimensions(image: ImageInput) {
  const buffer = await readFile(image.path);
  if (isPng(buffer)) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  throw new Error(`unsupported image format for bounds check: ${image.path}`);
}

function isPng(buffer: Buffer) {
  return buffer.length >= 24
    && buffer.readUInt32BE(0) === 0x89504e47
    && buffer.readUInt32BE(4) === 0x0d0a1a0a;
}
