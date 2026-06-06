import type { TaskRecord } from '../domain/tasks.js';
import type { ImportBatch, StoredImageRecord } from '../domain/images.js';
import type {
  ImageTaskRecord,
  ImageTaskRequest,
  ImageTaskSubmitResult,
} from '../domain/imageFeatureApi.js';
import type { AppSettings, RendererAppSettings } from '../domain/settings.js';

export const IPC_CHANNELS = {
  storage: {
    saveImportBatch: 'storage:save-import-batch',
    saveTaskOutputs: 'storage:save-task-outputs',
  },
  tasks: {
    list: 'tasks:list',
    create: 'tasks:create',
    update: 'tasks:update',
  },
  settings: {
    get: 'settings:get',
    save: 'settings:save',
    testConnection: 'settings:test-connection',
  },
  imageTask: {
    submit: 'image-task:submit',
    cancel: 'image-task:cancel',
    get: 'image-task:get',
    status: 'image-task:status',
  },
} as const;

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

export interface ImageTaskBridgeApi {
  submit(request: ImageTaskRequest): Promise<ImageTaskSubmitResult>;
  cancel(taskId: string): Promise<ImageTaskRecord>;
  get(taskId: string): Promise<ImageTaskRecord | undefined>;
  onStatus(listener: (task: ImageTaskRecord) => void): () => void;
}

export interface SettingsBridgeApi {
  get(): Promise<RendererAppSettings>;
  save(settings: AppSettings): Promise<void>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}

export interface DesktopBridgeApi {
  platform: string;
  saveImportBatch(request: SaveImportBatchRequest): Promise<ImportBatch>;
  saveTaskOutputs(request: SaveTaskOutputsRequest): Promise<StoredImageRecord[]>;
  createTask(record: TaskRecord): Promise<void>;
  updateTask(record: TaskRecord): Promise<void>;
  listTasks(): Promise<TaskRecord[]>;
  settings: SettingsBridgeApi;
  imageTask: ImageTaskBridgeApi;
}
