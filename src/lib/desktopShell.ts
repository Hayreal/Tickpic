import type { ImportBatch, TaskRecord, StoredImageRecord } from '../types';

export interface DesktopShellApi {
  platform: string;
  saveImportBatch: (payload: {
    page: 'sticker' | 'product';
    feature: string;
    files: File[];
  }) => Promise<ImportBatch>;
  createTask: (record: TaskRecord) => Promise<void>;
  updateTask: (record: TaskRecord) => Promise<void>;
  listTasks: () => Promise<TaskRecord[]>;
  saveTaskOutputs: (payload: {
    taskId: string;
    page: 'sticker' | 'product';
    feature: string;
    outputs: { name: string; buffer: ArrayBuffer }[];
  }) => Promise<StoredImageRecord[]>;
}

declare global {
  interface Window {
    desktopShell?: DesktopShellApi;
  }
}

export function hasDesktopStorageApi(): boolean {
  return typeof window !== 'undefined' && Boolean(window.desktopShell?.saveImportBatch);
}

export function getDesktopShell(): DesktopShellApi | undefined {
  return typeof window !== 'undefined' ? window.desktopShell : undefined;
}
