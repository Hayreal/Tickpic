export interface TaskItem {
  id: string;
  category: string;
  feature: string;
  status: 'Running' | 'Completed' | 'Failed';
  time: string;
  batchId?: string;
  importCount?: number;
  outputCount?: number;
}

export interface AppSettings {
  apiKey: string;
  baseUrl: string;
  modelId: string;
}

export type ActiveTab = 'sticker' | 'product' | 'settings' | 'profile';

export type StickerSubTab = 'copy' | 'variation' | 'original';

export type ProductSubTab = 'remove' | 'replace' | 'logo' | 'theme' | 'scene';

export type TaskStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

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

export interface TaskRecord {
  taskId: string;
  batchId: string;
  category: string;
  feature: string;
  status: TaskStatus;
  imports: StoredImageRecord[];
  outputs: StoredImageRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ResultItem {
  id: string;
  imageUrl: string;
  taskId?: string;
  timestamp?: string;
  badge?: string;
}
