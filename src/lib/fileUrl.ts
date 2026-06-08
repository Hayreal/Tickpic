export function resolveLocalFilePath(filePath: string): string | null {
  if (
    filePath.startsWith('blob:')
    || filePath.startsWith('data:')
    || filePath.startsWith('http://')
    || filePath.startsWith('https://')
  ) {
    return null;
  }

  if (filePath.startsWith('tickpic-file://image/')) {
    const encodedPath = filePath.slice('tickpic-file://image/'.length);
    return decodeURIComponent(encodedPath);
  }

  if (filePath.startsWith('file://')) {
    return decodeURIComponent(filePath.slice('file://'.length));
  }

  return filePath;
}

export function toDisplaySrc(filePath: string) {
  if (
    filePath.startsWith('blob:')
    || filePath.startsWith('data:')
    || filePath.startsWith('http://')
    || filePath.startsWith('https://')
    || filePath.startsWith('tickpic-file:')
  ) {
    return filePath;
  }

  const normalizedPath = filePath.startsWith('file://')
    ? decodeURIComponent(filePath.slice('file://'.length))
    : filePath;
  return `tickpic-file://image/${encodeURIComponent(normalizedPath)}`;
}
