import type { TaskRecord } from '../domain/tasks';
import type { ImportBatch, StoredImageRecord } from '../domain/images';

export interface SaveImportBatchRequest {
  page: 'sticker' | 'product';
  feature: string;
  files: File[];
}

export interface SaveTaskOutputsRequest {
  taskId: string;
  page: 'sticker' | 'product';
  feature: string;
  outputs: { name: string; buffer: ArrayBuffer }[];
}

export interface DesktopBridgeApi {
  platform: string;
  saveImportBatch(request: SaveImportBatchRequest): Promise<ImportBatch>;
  saveTaskOutputs(request: SaveTaskOutputsRequest): Promise<StoredImageRecord[]>;
  createTask(record: TaskRecord): Promise<void>;
  updateTask(record: TaskRecord): Promise<void>;
  listTasks(): Promise<TaskRecord[]>;
}
