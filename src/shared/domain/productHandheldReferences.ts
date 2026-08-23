export interface ProductHandheldReferenceDefinition {
  id: string;
  label: string;
  filename: string;
}

export const PRODUCT_HANDHELD_REFERENCES: readonly ProductHandheldReferenceDefinition[] = [
  { id: 'handheld-pump-foam', label: '按压泵瓶出泡', filename: 'handheld-pump-foam.png' },
  { id: 'handheld-spray-trigger', label: '食指按喷喷雾', filename: 'handheld-spray-trigger.png' },
  { id: 'handheld-cylinder-slanted', label: '斜握柱状瓶', filename: 'handheld-cylinder-slanted.png' },
  { id: 'handheld-tube-squeeze-dispense', label: '挤压软管出料', filename: 'handheld-tube-squeeze-dispense.png' },
  { id: 'handheld-tube-angled-hold', label: '斜握软管展示', filename: 'handheld-tube-angled-hold.png' },
  { id: 'handheld-dropper-tilt', label: '倾斜滴管滴液', filename: 'handheld-dropper-tilt.png' },
  { id: 'handheld-jar-palm-up', label: '掌心托举开罐', filename: 'handheld-jar-palm-up.png' },
  { id: 'handheld-tube-gel-drop', label: '软管滴凝胶', filename: 'handheld-tube-gel-drop.png' },
  { id: 'handheld-bottle-nozzle-down', label: '握持尖嘴瓶下倾', filename: 'handheld-bottle-nozzle-down.png' },
] as const;

export function findProductHandheldReferenceById(id: string | null | undefined) {
  if (!id?.trim()) {
    return undefined;
  }
  return PRODUCT_HANDHELD_REFERENCES.find((reference) => reference.id === id.trim());
}

export function findProductHandheldReferenceByPath(filePath: string | null | undefined) {
  if (!filePath?.trim()) {
    return undefined;
  }
  const normalized = filePath.replace(/\\/g, '/');
  return PRODUCT_HANDHELD_REFERENCES.find((reference) => normalized.endsWith(`/product/${reference.filename}`));
}
