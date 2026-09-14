export function resizeShowProductByIndex(
  current: boolean[] | undefined,
  count: number,
  fallback = true,
): boolean[] {
  return Array.from({ length: count }, (_, index) => current?.[index] ?? fallback);
}

export function formatShowProductByIndex(values: readonly boolean[]): string {
  return values.map((value, index) => `图${index + 1}：${value ? '展示' : '不展示'}`).join('、');
}

export function restoreMainShowProductByIndex(
  count: number,
  byIndex: boolean[] | undefined,
  legacyShowProduct?: boolean,
): boolean[] {
  if (byIndex?.length) {
    return resizeShowProductByIndex(byIndex, count);
  }
  const fallback = legacyShowProduct !== false;
  return Array.from({ length: count }, () => fallback);
}
