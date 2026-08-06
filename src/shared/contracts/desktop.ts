import type { TaskRecord } from '../domain/tasks.js';
import type { ImportBatch, StoredImageRecord } from '../domain/images.js';
import type {
  ImageTaskRecord,
  ImageTaskRequest,
  ImageTaskSubmitResult,
} from '../domain/imageFeatureApi.js';
import type { AppLogEntry } from '../domain/appLog.js';
import type { AppSettings, RendererAppSettings } from '../domain/settings.js';

export const IPC_CHANNELS = {
  storage: {
    saveImportBatch: 'storage:save-import-batch',
    saveTaskOutputs: 'storage:save-task-outputs',
    openOutputDirectory: 'storage:open-output-directory',
    copyImageToClipboard: 'storage:copy-image-to-clipboard',
    openLocalImage: 'storage:open-local-image',
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
    pickWorkspaceDir: 'settings:pick-workspace-dir',
  },
  imageTask: {
    submit: 'image-task:submit',
    cancel: 'image-task:cancel',
    get: 'image-task:get',
    status: 'image-task:status',
  },
  appLog: {
    list: 'app-log:list',
    entry: 'app-log:entry',
  },
} as const;

export interface SaveImportBatchRequest {
  page: ImportBatch['page'];
  feature: string;
  files: { name: string; type: string; buffer: ArrayBuffer }[];
}

export interface SaveTaskOutputsRequest {
  taskId: string;
  page: ImportBatch['page'];
  feature: string;
  outputs: { name: string; buffer: ArrayBuffer }[];
}

export interface OpenOutputDirectoryRequest {
  outputDir?: string;
  filePaths?: string[];
}

export interface OpenOutputDirectoryResult {
  openedDir: string;
}

export interface CopyImageToClipboardRequest {
  filePath: string;
}

export interface CopyImageToClipboardResult {
  copied: true;
}

export interface OpenLocalImageRequest {
  filePath: string;
}

export interface OpenLocalImageResult {
  opened: true;
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
  pickWorkspaceDir(): Promise<string | null>;
}

export interface AppLogBridgeApi {
  list(): Promise<AppLogEntry[]>;
  onEntry(listener: (entry: AppLogEntry) => void): () => void;
}

export interface DesktopBridgeApi {
  platform: string;
  saveImportBatch(request: SaveImportBatchRequest): Promise<ImportBatch>;
  saveTaskOutputs(request: SaveTaskOutputsRequest): Promise<StoredImageRecord[]>;
  openOutputDirectory(request: OpenOutputDirectoryRequest): Promise<OpenOutputDirectoryResult>;
  copyImageToClipboard(request: CopyImageToClipboardRequest): Promise<CopyImageToClipboardResult>;
  openLocalImage(request: OpenLocalImageRequest): Promise<OpenLocalImageResult>;
  createTask(record: TaskRecord): Promise<void>;
  updateTask(record: TaskRecord): Promise<void>;
  listTasks(): Promise<TaskRecord[]>;
  settings: SettingsBridgeApi;
  imageTask: ImageTaskBridgeApi;
  logs: AppLogBridgeApi;
}
