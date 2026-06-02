const MAX_IMPORT_IMAGES = 4;

export function collectImportFiles(files: File[]) {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'));
  const accepted = imageFiles.slice(0, MAX_IMPORT_IMAGES);

  return {
    accepted,
    rejectedCount: imageFiles.length - accepted.length,
    ignoredNonImages: files.length - imageFiles.length,
    hasOverflow: imageFiles.length > MAX_IMPORT_IMAGES,
  };
}
