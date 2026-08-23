import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRODUCT_HANDHELD_REFERENCES,
  type ProductHandheldReferenceDefinition,
} from '../../../../src/shared/domain/productHandheldReferences.js';

export interface ResolvedProductHandheldReference extends ProductHandheldReferenceDefinition {
  path: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveAppResourcesDir() {
  // Align with electron/main/index.ts and createMainWindow icon resolution:
  // from electron/main/services/resources -> electron/main -> ../../../resources
  const mainProcessDir = path.join(moduleDir, '..', '..');
  return path.resolve(mainProcessDir, '..', '..', '..', 'resources');
}

export function resolveProductResourcePath(...segments: string[]) {
  return path.join(resolveAppResourcesDir(), ...segments);
}

export function listProductHandheldReferences(): ResolvedProductHandheldReference[] {
  const productDir = resolveProductResourcePath('product');
  return PRODUCT_HANDHELD_REFERENCES.map((reference) => ({
    ...reference,
    path: path.join(productDir, reference.filename),
  }));
}
