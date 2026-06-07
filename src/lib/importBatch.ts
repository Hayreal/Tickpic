const MAX_IMPORT_IMAGES = 4;

const IMAGE_FILE_NAME_PATTERN = /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;

function isImageFile(file: File) {
  if (file.type.startsWith('image/')) {
    return true;
  }
  return IMAGE_FILE_NAME_PATTERN.test(file.name);
}

export function normalizePastedImageFile(file: File, index: number): File {
  const type = file.type.startsWith('image/') ? file.type : 'image/png';
  const extension = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  const name = file.name.trim() || `pasted-image-${Date.now()}-${index}.${extension}`;
  if (file.name === name && file.type === type) {
    return file;
  }
  return new File([file], name, { type });
}

export function extractClipboardImageFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) {
    return [];
  }

  const fromItems = Array.from(clipboardData.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null && isImageFile(file));

  if (fromItems.length > 0) {
    return fromItems.map((file, index) => normalizePastedImageFile(file, index));
  }

  return Array.from(clipboardData.files)
    .filter(isImageFile)
    .map((file, index) => normalizePastedImageFile(file, index));
}

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
