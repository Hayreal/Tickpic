import { describe, expect, it } from 'vitest';
import {
  buildSkuLabelConstraintSpec,
  renderSkuLabelExecutionPrompt,
  resolveLockedCopy,
  sanitizePlannedInstructionForLockedCopy,
} from '../skuConstraintSpec';

describe('skuConstraintSpec', () => {
  it('builds structured label constraints with locked copy and batch slot', () => {
    const lockedCopy = resolveLockedCopy({
      feature: 'sku_variation',
      brand: 'wkau',
      productName: 'HEADLIGHT RESTORE',
      capacity: '45ML',
      count: 1,
      variantIndex: 2,
      variantTotal: 3,
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    }, {
      brand: 'old',
      productName: 'Old Name',
      capacity: '30ML',
    });

    const spec = buildSkuLabelConstraintSpec({
      feature: 'sku_variation',
      brand: 'wkau',
      productName: 'HEADLIGHT RESTORE',
      capacity: '45ML',
      count: 1,
      variantIndex: 2,
      variantTotal: 3,
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    }, lockedCopy);

    expect(spec.feature).toBe('sku_variation');
    expect(spec.locked_copy).toEqual({
      brand: 'wkau',
      product_name: 'HEADLIGHT RESTORE',
      capacity: 'NET: 45ML',
    });
    expect(spec.reference_policy?.length).toBeGreaterThan(0);
    expect(spec.batch_slot).toContain('batch output 2/3');
  });

  it('renders fallback execution prompt with label design plan section', () => {
    const lockedCopy = { brand: 'wkau', productName: 'Oil Cleaner', capacity: 'NET: 50ML' };
    const spec = buildSkuLabelConstraintSpec({
      feature: 'sku_original',
      productName: 'Oil Cleaner',
      images: [{ role: 'source', path: '/tmp/sku.png' }],
    }, lockedCopy);
    const creativePlan = sanitizePlannedInstructionForLockedCopy(
      'Use a bold diagonal label layout.',
      lockedCopy,
    );
    const prompt = renderSkuLabelExecutionPrompt(spec, creativePlan);

    expect(prompt).toContain('NON-NEGOTIABLE SOURCE LOCK:');
    expect(prompt).toContain('LABEL DESIGN PLAN:');
    expect(prompt).toContain('The exact capacity is "NET: 50ML".');
    expect(prompt).toContain('FORBIDDEN:');
    expect(prompt).toContain('3-icon feature rows');
  });

  it.each(['sku_replica', 'sku_variation', 'sku_original'] as const)(
    'includes anti-AI-template forbidden rules for %s',
    (feature) => {
      const spec = buildSkuLabelConstraintSpec({
        feature,
        images: [{ role: 'source', path: '/tmp/sku.png' }],
      }, {
        brand: 'wkau',
        productName: 'Oil Cleaner',
        capacity: 'NET: 45ML',
      });

      const forbidden = spec.forbidden.join(' ');
      expect(forbidden).toContain('3-icon feature rows');
      expect(forbidden).toContain('hex badge grids');
      expect(forbidden).toContain('Other label layouts');
    },
  );

  it('preserves bundle accessories for sku_variation and sku_replica', () => {
    for (const feature of ['sku_replica', 'sku_variation'] as const) {
      const spec = buildSkuLabelConstraintSpec({
        feature,
        images: [{ role: 'source', path: '/tmp/sku.png' }],
      }, {
        brand: 'wkau',
        productName: 'HEADLIGHT RESTORE',
        capacity: 'NET: 45ML',
      });

      const sourceLock = spec.source_lock.join(' ');
      expect(sourceLock).toContain('Preserve every non-label element in Image 1 exactly as uploaded');
      expect(sourceLock).toContain('This is a label-only edit');
      expect(sourceLock).not.toContain('Output only the primary SKU container on a clean background');
      expect(spec.final_check.join(' ')).toContain('Return Image 1 unchanged except for the primary SKU printed label');
    }
  });

  it('locks low jar geometry when container lock is provided', () => {
    const spec = buildSkuLabelConstraintSpec({
      feature: 'sku_replica',
      images: [{ role: 'source', path: '/tmp/sku.png' }],
    }, {
      brand: 'JOKJOK',
      productName: 'PLASTIC RENOVATION',
      capacity: 'NET: 40G',
    }, {
      form: 'jar',
      heightTier: 'low',
      shapeDescription: 'squat wide-mouth open jar, diameter greater than height',
    });
    const prompt = renderSkuLabelExecutionPrompt(spec, 'Use a bold label layout.');

    expect(prompt).toContain('Jar height tier: low');
    expect(prompt).toContain('squat wide-mouth open jar, diameter greater than height');
  });

  it('requires high-fidelity reference replication for sku_replica', () => {
    const spec = buildSkuLabelConstraintSpec({
      feature: 'sku_replica',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    }, {
      brand: 'wkau',
      productName: 'HEADLIGHT RESTORE',
      capacity: 'NET: 45ML',
    });

    expect(spec.reference_policy?.join(' ')).toContain('sole visual authority');
    expect(spec.forbidden.join(' ')).toContain('Never keep source-label category icons');
    expect(spec.mode_authority.join(' ')).toContain('Replace the entire source label');
    expect(spec.image_roles.reference_images).toContain('exact label artwork to transplant');
  });

  it('renders replica authority before subordinate design notes', () => {
    const spec = buildSkuLabelConstraintSpec({
      feature: 'sku_replica',
      brand: 'wkau',
      images: [
        { role: 'source', path: '/tmp/sku.png' },
        { role: 'reference', path: '/tmp/reference.png' },
      ],
    }, {
      brand: 'wkau',
      productName: 'HEADLIGHT RESTORE',
      capacity: 'NET: 45ML',
    });
    const prompt = renderSkuLabelExecutionPrompt(spec, 'Use a blue tube-style label layout.');

    expect(prompt.indexOf('MODE AUTHORITY:')).toBeLessThan(prompt.indexOf('LABEL DESIGN NOTES'));
    expect(prompt).toContain('match the reference label design system');
  });

  it('requires stronger batch diversity axes for sku_variation', () => {
    const spec = buildSkuLabelConstraintSpec({
      feature: 'sku_variation',
      count: 2,
      variantIndex: 2,
      variantTotal: 2,
      images: [{ role: 'source', path: '/tmp/sku.png' }],
    }, {
      brand: 'wkau',
      productName: 'HEADLIGHT RESTORE',
      capacity: 'NET: 45ML',
    });

    expect(spec.batch_slot).toContain('immediately distinguishable');
    expect(spec.batch_slot).toContain('layout axis');
  });
});
