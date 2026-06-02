export interface StoredImageRecord {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface ImportBatch {
  batchId: string;
  page: 'sticker' | 'product';
  feature: string;
  images: StoredImageRecord[];
  createdAt: string;
}
