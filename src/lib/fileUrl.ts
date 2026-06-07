export function toDisplaySrc(filePath: string) {
  if (filePath.startsWith('blob:') || filePath.startsWith('file:') || filePath.startsWith('http')) {
    return filePath;
  }
  return `file://${filePath}`;
}
