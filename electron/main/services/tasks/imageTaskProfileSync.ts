import path from 'node:path';
import type { ImageTaskRecord } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { StoredImageRecord } from '../../../../src/shared/domain/images.js';
import { getImageFeatureLabel } from '../../../../src/shared/domain/imageFeatureLabels.js';
import type { TaskRecord, TaskStatus } from '../../../../src/shared/domain/tasks.js';
import type { TaskRepository } from './taskRepository.js';

function mapImageTaskStatus(status: ImageTaskRecord['status']): TaskStatus {
  switch (status) {
    case 'queued':
      return 'Pending';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
    case 'canceled':
      return 'Failed';
    default:
      return 'Pending';
  }
}

function toStoredImageRecord(filePath: string, index: number): StoredImageRecord {
  return {
    id: `output-${index}`,
    fileName: path.basename(filePath),
    filePath,
    fileSize: 0,
    mimeType: 'image/png',
    createdAt: new Date().toISOString(),
  };
}

export function imageTaskRecordToTaskRecord(task: ImageTaskRecord): TaskRecord {
  const labels = getImageFeatureLabel(task.feature);
  const imports = (task.request.images ?? []).map((image, index) => ({
    id: `${image.role}-${index}`,
    fileName: path.basename(image.path),
    filePath: image.path,
    fileSize: 0,
    mimeType: image.mimeType ?? 'image/png',
    createdAt: task.createdAt,
  }));

  return {
    taskId: task.taskId,
    batchId: imports[0]?.filePath ?? task.taskId,
    category: labels.category,
    feature: labels.feature,
    status: mapImageTaskStatus(task.status),
    imports,
    outputs: task.images.map(toStoredImageRecord),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function syncImageTaskToProfile(repo: TaskRepository, task: ImageTaskRecord) {
  const record = imageTaskRecordToTaskRecord(task);
  const existing = repo.list() as TaskRecord[];
  if (existing.some((item) => item.taskId === record.taskId)) {
    repo.update(record as unknown as Record<string, unknown>);
    return;
  }
  repo.create(record as unknown as Record<string, unknown>);
}
