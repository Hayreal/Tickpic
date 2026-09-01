import type { SkuLabelConstraintSpec } from './skuConstraintSpec.js';

export function filterSkuLabelExecutionImages<T extends { role: string }>(
  executionImages: readonly T[],
): T[] {
  const sourceImages = executionImages.filter((image) => image.role === 'source');
  const referenceImages = executionImages.filter((image) => image.role === 'reference');
  if (sourceImages.length === 0) {
    return executionImages.slice(0, 1);
  }
  return [...sourceImages, ...referenceImages];
}

export function appendSkuExecutionImageRoles(
  prompt: string,
  feature: SkuLabelConstraintSpec['feature'],
  hasReference: boolean,
): string {
  if (!hasReference || prompt.includes('EXECUTION IMAGE ROLES:')) {
    return prompt;
  }

  const referenceRole = feature === 'sku_replica'
    ? 'Image 2+ = sole label design authority. Reproduce the reference label layout, hierarchy, palette, hero graphic, and decorative language faithfully on Image 1 printable area.'
    : feature === 'sku_variation'
      ? 'Image 2+ = label design system reference. Derive palette, typography mood, band language, and decorative identity from Image 2+ only; create a visibly different layout axis and never reuse Image 1 label structure.'
      : 'Image 2+ = label design system reference. Derive layout, hierarchy, palette, typography mood, band language, and decorative identity from Image 2+ only; never reuse Image 1 label structure or source-label category imagery.';

  const block = [
    'EXECUTION IMAGE ROLES:',
    'Image 1 = fixed SKU source canvas. Preserve exact container geometry, crop, and every non-label pixel.',
    'The visible label on Image 1 is replace-only; its layout, palette, bands, logo zone, headline placement, icons, hero graphics, and decorative motifs are forbidden visual input.',
    'The replacement label must conform to Image 1 printable-surface curvature, wrap perspective, edge foreshortening, highlights, shadows, and gloss; never paste a flat frontal rectangle.',
    referenceRole,
    'Never copy reference container shape, crop, scene, or secondary objects.',
  ].join(' ');

  return `${block}\n\n${prompt}`;
}
