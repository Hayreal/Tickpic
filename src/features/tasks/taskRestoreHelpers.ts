import type { ImageTaskRequest, ImageTaskRecord, ImageTaskStatus } from '../../shared/domain/imageFeatureApi';
import type { ImportBatch, StoredImageRecord } from '../../shared/domain/images';
import type { TaskRecord, TaskStatus } from '../../shared/domain/tasks';

function mapProfileStatusToImageTaskStatus(status: TaskStatus): ImageTaskStatus {
  switch (status) {
    case 'Pending':
      return 'queued';
    case 'Running':
      return 'running';
    case 'Completed':
      return 'completed';
    case 'Failed':
    default:
      return 'failed';
  }
}

export function createImportBatch(
  images: StoredImageRecord[],
  page: ImportBatch['page'],
  feature: string,
): ImportBatch | null {
  if (images.length === 0) {
    return null;
  }

  return {
    batchId: images[0].filePath,
    page,
    feature,
    images,
    createdAt: images[0].createdAt,
  };
}

export function findImportByRole(
  imports: StoredImageRecord[],
  role: string,
): ImportBatch | null {
  const image = imports.find((item) => item.id.startsWith(`${role}-`));
  if (!image) {
    return null;
  }
  return createImportBatch([image], 'sticker', role);
}

export function imageTaskRecordFromTaskRecord(task: TaskRecord): ImageTaskRecord | null {
  if (!task.request?.feature) {
    return null;
  }

  return {
    taskId: task.taskId,
    feature: task.request.feature,
    status: mapProfileStatusToImageTaskStatus(task.status),
    progress: task.outputs.length > 0
      ? {
        completed: task.outputs.length,
        total: task.request.count ?? task.outputs.length,
      }
      : undefined,
    model: undefined,
    protocol: undefined,
    outputDir: task.outputDir,
    images: task.outputs.map((output) => output.filePath),
    requestJsonPath: undefined,
    imageInstructionPath: undefined,
    outputJsonPath: undefined,
    textNotes: undefined,
    warnings: task.warnings,
    error: task.error,
    request: task.request,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function getImageByRole(request: ImageTaskRequest, role: string): StoredImageRecord | undefined {
  return getImagesByRole(request, role)[0];
}

export function getImagesByRole(request: ImageTaskRequest, role: string): StoredImageRecord[] {
  const images = (request.images ?? []).filter((item) => item.role === role);
  const createdAt = new Date().toISOString();

  return images.map((image, index) => ({
    id: `${role}-${index}`,
    fileName: image.path.split(/[\\/]/).pop() ?? image.path,
    filePath: image.path,
    fileSize: 0,
    mimeType: image.mimeType ?? 'image/png',
    createdAt,
  }));
}
