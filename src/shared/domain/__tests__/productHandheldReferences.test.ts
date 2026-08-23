import { describe, expect, it } from 'vitest';
import {
  findProductHandheldReferenceById,
  findProductHandheldReferenceByPath,
  PRODUCT_HANDHELD_REFERENCES,
} from '../productHandheldReferences';

describe('productHandheldReferences', () => {
  it('defines nine labeled handheld references with renamed files', () => {
    expect(PRODUCT_HANDHELD_REFERENCES).toHaveLength(9);
    expect(PRODUCT_HANDHELD_REFERENCES.map((reference) => reference.filename)).toEqual([
      'handheld-pump-foam.png',
      'handheld-spray-trigger.png',
      'handheld-cylinder-slanted.png',
      'handheld-tube-squeeze-dispense.png',
      'handheld-tube-angled-hold.png',
      'handheld-dropper-tilt.png',
      'handheld-jar-palm-up.png',
      'handheld-tube-gel-drop.png',
      'handheld-bottle-nozzle-down.png',
    ]);
  });

  it('resolves references by id and path', () => {
    const reference = findProductHandheldReferenceById('handheld-pump-foam');
    expect(reference?.label).toBe('按压泵瓶出泡');
    expect(findProductHandheldReferenceByPath('C:/app/resources/product/handheld-pump-foam.png')).toEqual(reference);
  });
});
